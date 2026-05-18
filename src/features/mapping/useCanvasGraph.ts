import { computed, ref, watch, type Ref } from 'vue'
import type { Edge, Node } from '@vue-flow/core'
import { isCanvasVisibleDataSource, type DataSource } from '@/domain/DataSource'
import type { NodeShape } from '@/domain/NodeShape'
import {
  applyDefaultExtensionEdgeStyle,
  buildCanvasMappingEdges,
  buildCanvasShapeNodes,
  buildCanvasSourceNodes,
  buildCanvasStructuralEdges,
  preserveCanvasNodePositions,
  shouldAutoLayoutCanvas,
} from '@/features/mapping/canvasGraphBuilders'
import {
  buildExtensionCanvasEdges,
  buildExtensionCanvasNodes,
  canvasNodeTypes,
  defaultPositionForNodeType,
  findRuntimeHandler,
  type OpenSetupDialog,
} from '@/features/mapping/mappingExtensionRegistry'
import { useSourceGroupRefresh } from '@/features/mapping/useSourceGroupRefresh'
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

interface UseCanvasGraphOptions {
  dataStore: DataStore
  mappingStore: MappingStore
  sources: Ref<DataSource[]>
  canvasShapes: Ref<NodeShape[]>
  toast: ToastLike
  openSetupDialog: OpenSetupDialog
  openTablePreview: (source: DataSource) => void
  openNodePreview: (nodeId: string) => void
  openShapePreview: (shape: NodeShape) => void | Promise<void>
}

export function useCanvasGraph(options: UseCanvasGraphOptions) {
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeTypes: any = canvasNodeTypes
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
    return defaultPositionForNodeType(node.type, index)
  }

  function autoLayoutNodes(nextNodes: Node[], nextEdges: Edge[]): Node[] {
    const layout = layoutMappingGraph as unknown as (nodes: Node[], edges: Edge[]) => Node[]
    return layout(nextNodes, nextEdges)
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

  function rebuildGraph(): void {
    const extensionNodes: Node[] = buildExtensionCanvasNodes({
      dataStore: options.dataStore,
      mappingStore: options.mappingStore,
      visibleSources: visibleSources.value,
      openSetupDialog: options.openSetupDialog,
      openNodePreview: options.openNodePreview,
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
      isRefreshingSourceGroup,
      refreshSourceGroup: refreshProviderSourceGroup,
      setSourceGroupEdgeVisibility,
      runNode,
    }).map(edge => applyDefaultExtensionEdgeStyle(edge))

    const tableNodes: Node[] = buildCanvasSourceNodes(visibleSources.value, options.openTablePreview)
    const shapeNodes: Node[] = buildCanvasShapeNodes(options.canvasShapes.value, options.openShapePreview)

    const nextNodes: Node[] = [...extensionNodes, ...tableNodes, ...shapeNodes]
    const visibleNodeIds = new Set(nextNodes.map(node => node.id))

    const mappingEdges: Edge[] = buildCanvasMappingEdges(
      options.mappingStore.state.edges,
      options.canvasShapes.value,
      visibleNodeIds,
    )
    const structuralEdges: Edge[] = buildCanvasStructuralEdges(visibleSources.value, options.canvasShapes.value)

    const allEdges: Edge[] = [...mappingEdges, ...structuralEdges, ...extensionEdges]
      .filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))

    const existingNodes = nodes.value as Node[]

    if (shouldAutoLayoutCanvas(existingNodes, nextNodes)) {
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
      options.canvasShapes,
      () => options.mappingStore.state.edges.length,
    ],
    rebuildGraph,
    { immediate: true },
  )

  return {
    nodes,
    edges,
    nodeTypes,
  }
}

function isVisibleSource(source: DataSource): boolean {
  return isCanvasVisibleDataSource(source)
}


