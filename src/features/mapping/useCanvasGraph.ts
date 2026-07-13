import { computed, ref, watch, type Ref } from 'vue'
import type { Edge, Node } from '@vue-flow/core'
import { isCanvasVisibleDataSource, type DataSource } from '@/domain/DataSource'
import type { NodeShape } from '@/domain/NodeShape'
import {
  applyDefaultExtensionEdgeStyle,
  buildCanvasShapeNodeId,
  buildCanvasMappingEdges,
  buildCanvasShapeNodes,
  buildCanvasSourceNodes,
  buildCanvasStructuralEdges,
  type ShapeCanvasNodeData,
  preserveCanvasNodePositions,
  shouldAutoLayoutCanvas,
} from '@/features/mapping/canvasGraphBuilders'
import {
  buildExtensionCanvasEdges,
  canvasEdgeTypes,
  buildExtensionCanvasNodes,
  canvasNodeTypes,
  defaultPositionForNodeType,
  findRuntimeHandler,
  type OpenSetupDialog,
} from '@/features/mapping/mappingExtensionRegistry'
import { useSourceGroupRefresh } from '@/features/mapping/useSourceGroupRefresh'
import { getDependentTransformationNodeIds, syncTransformationNodeMappings } from '@/services/mapping/mappingEdgeSync'
import { getGeoNamesNode, getGeoNamesUiEdges, GEONAMES_NODE_STATE_KEY, GEONAMES_UI_EDGE_STATE_KEY, syncGeoNamesShapeMappings } from '@/features/mapping/extensions/modules/nodes/geonames/workflow'
import { getLobidNode, getLobidUiEdges, LOBID_NODE_STATE_KEY, LOBID_UI_EDGE_STATE_KEY, syncLobidShapeMappings } from '@/features/mapping/extensions/modules/nodes/lobid/workflow'
import { TRANSFORMATION_NODE_STATE_KEY, TRANSFORMATION_UI_EDGE_STATE_KEY } from '@/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/state'
import type { TransformationUiEdge } from '@/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/types'
import type { useDataStore } from '@/stores/dataStore'
import type { useMappingStore } from '@/stores/mappingStore'
import { layoutMappingGraph } from '@/services/mapping/graphLayout'

type DataStore = ReturnType<typeof useDataStore>
type MappingStore = ReturnType<typeof useMappingStore>

interface ToastLike {
  add(message: {
    severity: string
    summary: string
    detail?: string
    life?: number
  }): void
}

interface ConfirmLike {
  require(options: {
    header: string
    message: string
    icon?: string
    acceptLabel?: string
    rejectLabel?: string
    acceptClass?: string
    accept: () => void
  }): void
}

interface UseCanvasGraphOptions {
  dataStore: DataStore
  mappingStore: MappingStore
  sources: Ref<DataSource[]>
  allShapes: Ref<NodeShape[]>
  canvasShapes: Ref<NodeShape[]>
  toast: ToastLike
  confirm: ConfirmLike
  openSetupDialog: OpenSetupDialog
  openTablePreview: (source: DataSource) => void
  openNodePreview: (nodeId: string) => void
  openShapePreview: (shape: NodeShape) => void | Promise<void>
}

export function useCanvasGraph(options: UseCanvasGraphOptions) {
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])
  const expandedShapeNodeIds = ref<Set<string>>(new Set())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeTypes: any = canvasNodeTypes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edgeTypes: any = canvasEdgeTypes
  const visibleSources = computed(() => options.sources.value.filter(isVisibleSource))
  const {
    isRefreshingSourceGroup,
    refreshProviderSourceGroup,
    refreshingSourceGroups,
    setSourceGroupEdgeVisibility,
  } = useSourceGroupRefresh({
    dataStore: options.dataStore,
    toast: options.toast,
    readEdges: () => edges.value as Array<{ id: string; style?: unknown }>,
    writeEdges: nextEdges => {
      edges.value = nextEdges as Edge[]
    },
  })

  function positionForNewNode(node: Node, index: number): Node['position'] {
    if (node.type === 'shapeNode' && node.data && typeof node.data === 'object') {
      const shapeData = node.data as ShapeCanvasNodeData
      if (shapeData.anchorNodeId) {
        let anchorNode: Node | undefined
        for (const candidate of nodes.value as Node[]) {
          if (candidate.id === shapeData.anchorNodeId) {
            anchorNode = candidate
            break
          }
        }
        if (anchorNode) {
          return {
            x: anchorNode.position.x + 440,
            y: anchorNode.position.y + ((shapeData.inheritedIndex ?? 0) * 180),
          }
        }
      }
    }
    return defaultPositionForNodeType(node.type, index)
  }

  function autoLayoutNodes(nextNodes: Node[], nextEdges: Edge[]): Node[] {
    const layout = layoutMappingGraph as unknown as (nodes: Node[], edges: Edge[]) => Node[]
    return layout(nextNodes, nextEdges)
  }

  function toggleInherited(nodeId: string): void {
    const next = new Set(expandedShapeNodeIds.value)
    if (next.has(nodeId)) next.delete(nodeId)
    else next.add(nodeId)
    expandedShapeNodeIds.value = next
  }

  async function runNode(nodeId: string): Promise<void> {
    const runtimeHandler = findRuntimeHandler(nodeId)
    if (!runtimeHandler) return

    try {
      const result = await runtimeHandler.run(nodeId, {
        dataStore: options.dataStore,
        mappingStore: options.mappingStore,
        sources: options.sources.value,
      })
      options.toast.add({
        severity: 'success',
        summary: result.successSummary,
        detail: result.successDetail,
        life: 3500,
      })
    } catch (err) {
      options.toast.add({
        severity: 'error',
        summary: runtimeHandler.errorSummary,
        detail: err instanceof Error ? err.message : String(err),
        life: 5000,
      })
    }
  }

  function deleteNode(nodeId: string): void {
    const confirmation = deleteConfirmationForNode(nodeId)
    if (!confirmation) return

    options.confirm.require({
      header: 'Delete node',
      message: confirmation.message,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptClass: 'p-button-danger',
      accept: () => {
        confirmation.accept()
        options.toast.add({ severity: 'success', summary: 'Node deleted', detail: confirmation.successDetail, life: 2500 })
      },
    })
  }

  function deleteConfirmationForNode(nodeId: string): { message: string; successDetail: string; accept: () => void } | null {
    if (nodeId.startsWith('geonames:')) {
      return {
        message: 'Delete this GeoNames node and all of its generated connections?',
        successDetail: 'GeoNames node removed.',
        accept: () => { deleteGeoNamesNode(nodeId) },
      }
    }

    if (nodeId.startsWith('lobid:')) {
      return {
        message: 'Delete this Lobid node and all of its generated connections?',
        successDetail: 'Lobid node removed.',
        accept: () => { deleteLobidNode(nodeId) },
      }
    }

    if (nodeId.startsWith('transform:')) {
      return {
        message: 'Delete this transformation node and its canvas connections?',
        successDetail: 'Transformation node removed.',
        accept: () => { deleteTransformationNode(nodeId) },
      }
    }

    return null
  }

  function deleteGeoNamesNode(nodeId: string): void {
    const transformationUiEdges = options.mappingStore.getExtensionState(TRANSFORMATION_UI_EDGE_STATE_KEY, [] as TransformationUiEdge[])
    const dependentTransformIds = getDependentTransformationNodeIds(nodeId, transformationUiEdges)
    const node = getGeoNamesNode(options.mappingStore, nodeId)

    options.mappingStore.removeExtensionNode(GEONAMES_NODE_STATE_KEY, nodeId)
    options.mappingStore.setExtensionState(
      GEONAMES_UI_EDGE_STATE_KEY,
      getGeoNamesUiEdges(options.mappingStore).filter(edge => edge.source !== nodeId && edge.target !== nodeId),
    )
    options.mappingStore.setExtensionState(
      TRANSFORMATION_UI_EDGE_STATE_KEY,
      transformationUiEdges.filter(edge => edge.source !== nodeId && edge.target !== nodeId),
    )
    options.dataStore.remove(node?.outputSourceId ?? `geonames-output:${nodeId}`)
    options.dataStore.removeNodeOutputSources(nodeId)
    options.mappingStore.state.edges = syncGeoNamesShapeMappingsRemoval(nodeId)

    for (const transformId of dependentTransformIds) {
      options.mappingStore.syncTransformationMappings(transformId, options.sources.value)
    }
  }

  function deleteLobidNode(nodeId: string): void {
    const node = getLobidNode(options.mappingStore, nodeId)

    options.mappingStore.removeExtensionNode(LOBID_NODE_STATE_KEY, nodeId)
    options.mappingStore.setExtensionState(
      LOBID_UI_EDGE_STATE_KEY,
      getLobidUiEdges(options.mappingStore).filter(edge => edge.source !== nodeId && edge.target !== nodeId),
    )
    options.dataStore.remove(node?.outputSourceId ?? `lobid-output:${nodeId}`)
    options.dataStore.removeNodeOutputSources(nodeId)
    options.mappingStore.state.edges = syncLobidShapeMappingsRemoval(nodeId)
  }

  function deleteTransformationNode(nodeId: string): void {
    const transformationUiEdges = options.mappingStore.getExtensionState(TRANSFORMATION_UI_EDGE_STATE_KEY, [] as TransformationUiEdge[])
    options.mappingStore.removeExtensionNode(TRANSFORMATION_NODE_STATE_KEY, nodeId)
    options.mappingStore.setExtensionState(
      TRANSFORMATION_UI_EDGE_STATE_KEY,
      transformationUiEdges.filter(edge => edge.source !== nodeId && edge.target !== nodeId),
    )
    options.mappingStore.state.edges = syncTransformationNodeMappings(options.mappingStore.state.edges, nodeId, undefined, '')
  }

  function syncGeoNamesShapeMappingsRemoval(nodeId: string) {
    syncGeoNamesShapeMappings(options.mappingStore, options.dataStore, nodeId, options.sources.value)
    return options.mappingStore.state.edges
  }

  function syncLobidShapeMappingsRemoval(nodeId: string) {
    syncLobidShapeMappings(options.mappingStore, options.dataStore, nodeId, options.sources.value)
    return options.mappingStore.state.edges
  }

  function rebuildGraph(): void {
    const extensionNodes: Node[] = buildExtensionCanvasNodes({
      dataStore: options.dataStore,
      mappingStore: options.mappingStore,
      visibleSources: visibleSources.value,
      openSetupDialog: options.openSetupDialog,
      openNodePreview: options.openNodePreview,
      deleteNode,
      isRefreshingSourceGroup,
      refreshSourceGroup: refreshProviderSourceGroup,
      setSourceGroupEdgeVisibility,
      runNode,
    })
    const extensionEdges: Edge[] = buildExtensionCanvasEdges({
      dataStore: options.dataStore,
      mappingStore: options.mappingStore,
      visibleSources: visibleSources.value,
      openSetupDialog: options.openSetupDialog,
      openNodePreview: options.openNodePreview,
      deleteNode,
      isRefreshingSourceGroup,
      refreshSourceGroup: refreshProviderSourceGroup,
      setSourceGroupEdgeVisibility,
      runNode,
    }).map(edge => applyDefaultExtensionEdgeStyle(edge))

    const tableNodes: Node[] = buildCanvasSourceNodes(visibleSources.value, options.openTablePreview)
    const shapeNodes: Node[] = buildCanvasShapeNodes(
      options.canvasShapes.value,
      options.allShapes.value,
      expandedShapeNodeIds.value,
      options.openShapePreview,
      toggleInherited,
    )

    const nextNodes: Node[] = [...extensionNodes, ...tableNodes, ...shapeNodes]
    const visibleNodeIds = new Set(nextNodes.map(node => node.id))

    const mappingEdges: Edge[] = buildCanvasMappingEdges(
      options.mappingStore.state.edges,
      options.allShapes.value,
      visibleNodeIds,
    )
    const structuralEdges: Edge[] = buildCanvasStructuralEdges(
      visibleSources.value,
      options.canvasShapes.value,
      options.allShapes.value,
      expandedShapeNodeIds.value,
      visibleNodeIds,
    )

    const allEdges: Edge[] = [...mappingEdges, ...structuralEdges, ...extensionEdges]
      .filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))

    const existingNodes = nodes.value as Node[]
    const inheritedPreviewOnlyDelta = isOnlyInheritedPreviewDelta(existingNodes, nextNodes)

    if (shouldAutoLayoutCanvas(existingNodes, nextNodes) && !inheritedPreviewOnlyDelta) {
      nodes.value = autoLayoutNodes(nextNodes, allEdges)
    } else {
      nodes.value = preserveCanvasNodePositions(existingNodes, nextNodes, positionForNewNode)
    }
    edges.value = allEdges
  }

  watch(
    [
      () => options.sources.value.length,
      () => options.sources.value.map(source => source.id).join('|'),
      () => refreshingSourceGroups.value.join('|'),
      () => options.mappingStore.extensionStateRevision,
      () => Array.from(expandedShapeNodeIds.value).sort().join('|'),
      options.canvasShapes,
      options.allShapes,
      () => options.mappingStore.state.edges.length,
    ],
    rebuildGraph,
    { immediate: true },
  )

  watch(
    options.canvasShapes,
    nextShapes => {
      const nextVisibleIds = new Set<string>()
      for (const shape of nextShapes) {
        nextVisibleIds.add(buildCanvasShapeNodeId(shape.nodeId.value))
      }
      expandedShapeNodeIds.value = new Set(
        Array.from(expandedShapeNodeIds.value).filter(nodeId => {
          if (nodeId.startsWith('shape:')) return nextVisibleIds.has(nodeId)
          return true
        }),
      )
    },
    { immediate: false },
  )

  return {
    nodes,
    edges,
    nodeTypes,
    edgeTypes,
    expandedShapeNodeIds,
    toggleInherited,
  }
}

function isVisibleSource(source: DataSource): boolean {
  return isCanvasVisibleDataSource(source)
}

function isOnlyInheritedPreviewDelta(existingNodes: Node[], nextNodes: Node[]): boolean {
  const existingIds = new Set(existingNodes.map(node => node.id))
  const nextIds = new Set(nextNodes.map(node => node.id))
  const added = nextNodes.filter(node => !existingIds.has(node.id))
  const removed = existingNodes.filter(node => !nextIds.has(node.id))
  const delta = [...added, ...removed]

  return delta.length > 0 && delta.every(node => node.id.startsWith('inherited:'))
}


