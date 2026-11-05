import { nextTick, ref, watch, type Ref } from 'vue'
import type { Edge, Node } from '@vue-flow/core'
import type { NodeShape } from '@/domain/profiles'
import {
  buildEditorShapeNodes,
  buildEditorStructuralEdges,
  type EditorShapeReviewAnnotation,
  preserveEditorNodePositions,
  representedShapeIriFromNode,
  shouldAutoLayoutEditorGraph,
} from '@/presentation/features/editor/editorGraphBuilders'
import {
  editorEdgeTypes,
  editorNodeTypes,
  defaultPositionForEditorNodeType,
} from '@/presentation/features/editor/editorGraphRegistry'
import { layoutEditorGraph } from '@/presentation/features/editor/layoutEditorGraph'
import { resolveRenderedNodeOverlaps } from '@/presentation/features/editor/layoutEditorGraph'
import type { ShapeEditorNodeData } from '@/presentation/features/editor/inheritanceEditorGraph'
import { collapsePropertyConnections } from '@/presentation/features/editor/collapsedPropertyConnections'

interface UseEditorGraphOptions {
  allShapes: Ref<NodeShape[]>
  canvasShapes: Ref<NodeShape[]>
  relayoutRequestTick?: Ref<number>
  clearRequestedNodePositions?: () => void
  readOnlyMode?: Ref<boolean>
  lockedShapeIris?: Ref<Set<string>>
  canEditProperty?: (shapeIri: string, propertyNodeId: string) => boolean
  reviewMode?: Ref<boolean>
  showClassRelations?: Ref<boolean>
  showQualifiedValueShapes?: Ref<boolean>
  collapsedPropertyConnections?: Ref<Set<string>>
  reviewAnnotations?: Ref<Map<string, EditorShapeReviewAnnotation>>
  openShapePreview: (shape: NodeShape) => void | Promise<void>
  addField?: (shapeIri: string) => void
  renameShape?: (shapeIri: string, label: string) => void
  renameProperty?: (shapeIri: string, propertyNodeId: string, name: string) => void
  commitDraftProperty?: (propertyNodeId: string) => void
  deleteProperty?: (shapeIri: string, propertyNodeId: string) => boolean
  removeReferenceEdge?: (shapeIri: string, propertyNodeId: string, targetShapeIri: string) => void
  requestedNodePositions?: Ref<Record<string, Node['position']>>
  selectedShapeIri?: Ref<string | null>
  highlightedShapeIri?: Ref<string | null>
  selectedPropertyKey?: Ref<string | null>
  draftPropertyNodeId?: Ref<string | null>
  selectShape?: (shape: NodeShape) => void
  selectProperty?: (shape: NodeShape, property: import('@/domain/profiles').PropertyShape) => void
  openShapeHeaderMenu?: (shape: NodeShape, event: MouseEvent, options?: { allowDelete?: boolean; connectionShapeIri?: string }) => void
  openPropertyMenu?: ShapeEditorNodeData['onPropertyContextMenu']
  moveProperty?: (sourceShapeIri: string, propertyNodeId: string, targetShapeIri: string, targetIndex?: number) => boolean
}

export function useEditorGraph(options: UseEditorGraphOptions) {
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])
  const hiddenProfileCount = ref(0)
  const rememberedPositions = new Map<string, Node['position']>()
  let pendingRenderedLayoutPass = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeTypes: any = editorNodeTypes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edgeTypes: any = editorEdgeTypes

  function positionForNewNode(node: Node, index: number): Node['position'] {
    const requestedPosition = options.requestedNodePositions?.value[node.id]
    if (requestedPosition) return requestedPosition
    const remembered = rememberedPositions.get(node.id)
    if (remembered) return remembered
    return defaultPositionForEditorNodeType(node.type, index)
  }

  function autoLayoutNodes(nextNodes: Node[], nextEdges: Edge[]): Node[] {
    const layout = layoutEditorGraph as unknown as (nodes: Node[], edges: Edge[]) => Node[]
    return layout(nextNodes, nextEdges)
  }

  function applyRenderedLayoutPass(passId: number): void {
    if (passId !== pendingRenderedLayoutPass) return

    const resolved = resolveRenderedNodeOverlaps(nodes.value as Node[], edges.value as Edge[])
    const hasPositionChanges = resolved.some((node, index) => {
      const current = (nodes.value as Node[])[index]
      return current && (current.position.x !== node.position.x || current.position.y !== node.position.y)
    })

    if (hasPositionChanges) {
      nodes.value = resolved
    }
  }

  function updateSelectionState(): void {
    const selectedShapeIri = options.selectedShapeIri?.value ?? null
    const selectedPropertyKey = options.selectedPropertyKey?.value ?? null

    for (const node of nodes.value as Array<Node & { data?: Record<string, unknown> }>) {
      if (!node.data) continue

      const representedShapeIri = typeof node.data.representedShapeIri === 'string'
        ? node.data.representedShapeIri
        : null

      node.data.selected = representedShapeIri === selectedShapeIri
      node.data.highlighted = representedShapeIri === (options.highlightedShapeIri?.value ?? null)
      node.data.selectedShapeIri = selectedShapeIri
      node.data.selectedPropertyKey = representedShapeIri === selectedShapeIri ? selectedPropertyKey : null
      node.data.draftPropertyNodeId = options.draftPropertyNodeId?.value ?? null
      node.data.reviewMode = options.reviewMode?.value ?? false
      node.data.reviewShapeSeverity = representedShapeIri
        ? options.reviewAnnotations?.value.get(representedShapeIri)?.shapeSeverity ?? null
        : null
      node.data.reviewPropertySeverities = representedShapeIri
        ? options.reviewAnnotations?.value.get(representedShapeIri)?.propertySeverities ?? {}
        : {}
    }
  }

  function scheduleRenderedLayoutPass(): void {
    pendingRenderedLayoutPass += 1
    const passId = pendingRenderedLayoutPass

    void nextTick(() => {
      if (passId !== pendingRenderedLayoutPass) return

      requestAnimationFrame(() => {
        if (passId !== pendingRenderedLayoutPass) return
        applyRenderedLayoutPass(passId)

        requestAnimationFrame(() => {
          if (passId !== pendingRenderedLayoutPass) return
          applyRenderedLayoutPass(passId)
        })
      })
    })
  }

  function rebuildGraph(forceAutoLayout = false, preserveLayout = false): void {
    const reviewMode = options.reviewMode?.value ?? false
    const showClassRelations = reviewMode || (options.showClassRelations?.value ?? false)
    const showQualifiedValueShapes = reviewMode || (options.showQualifiedValueShapes?.value ?? false)
    let shapeNodes: Node[] = buildEditorShapeNodes(
      options.canvasShapes.value,
      options.allShapes.value,
      new Set(),
      options.openShapePreview,
      !(options.readOnlyMode?.value ?? false),
      options.addField,
      options.selectShape,
      options.selectProperty,
      options.renameShape,
      options.renameProperty,
      options.commitDraftProperty,
      options.deleteProperty,
      options.openShapeHeaderMenu,
      options.moveProperty,
      options.selectedShapeIri?.value,
      options.selectedPropertyKey?.value,
      options.draftPropertyNodeId?.value,
      options.reviewMode?.value ?? false,
      options.reviewAnnotations?.value,
      showClassRelations,
      showQualifiedValueShapes,
      options.highlightedShapeIri?.value,
      options.openPropertyMenu,
    )

    const visibleNodeIds = new Set(shapeNodes.map(node => node.id))
    let nextEdges = buildEditorStructuralEdges(
      options.canvasShapes.value,
      options.allShapes.value,
      visibleNodeIds,
      options.removeReferenceEdge,
      options.selectedShapeIri?.value,
      options.selectedPropertyKey?.value,
      showClassRelations,
      showQualifiedValueShapes,
      options.canEditProperty,
    ).filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))

    const collapsed = collapsePropertyConnections(shapeNodes, nextEdges, reviewMode ? new Set() : options.collapsedPropertyConnections?.value ?? new Set())
    hiddenProfileCount.value = shapeNodes.length - collapsed.nodes.length
    shapeNodes = collapsed.nodes
    nextEdges = collapsed.edges

    const existingNodes = nodes.value as Node[]
    for (const node of existingNodes) rememberedPositions.set(node.id, { ...node.position })
    if (!options.allShapes.value.length) rememberedPositions.clear()
    const existingIds = new Set(existingNodes.map(node => node.id))
    const newNodes = shapeNodes.filter(node => !existingIds.has(node.id))
    const existingShapeIris = new Set(existingNodes.map(representedShapeIriFromNode).filter((value): value is string => Boolean(value)))
    const hasNewRepresentedShapes = shapeNodes.some(node => {
      const representedShapeIri = representedShapeIriFromNode(node)
      return !representedShapeIri || !existingShapeIris.has(representedShapeIri)
    })
    const allNewNodesHaveRequestedPositions = newNodes.length > 0 && newNodes.every(node => Boolean(options.requestedNodePositions?.value[node.id]))
    const shouldRunAutoLayout = !preserveLayout && (shouldAutoLayoutEditorGraph(existingNodes, shapeNodes) || forceAutoLayout) && !allNewNodesHaveRequestedPositions
    const shouldRunRenderedLayoutPass = !preserveLayout && (forceAutoLayout || (hasNewRepresentedShapes && !allNewNodesHaveRequestedPositions))

    nodes.value = shouldRunAutoLayout
      ? autoLayoutNodes(shapeNodes, nextEdges)
      : preserveEditorNodePositions(existingNodes, shapeNodes, positionForNewNode)
    edges.value = nextEdges
    if (shouldRunRenderedLayoutPass) {
      scheduleRenderedLayoutPass()
    }
  }

  watch([options.canvasShapes, options.allShapes], () => rebuildGraph(), { immediate: true })
  watch(options.relayoutRequestTick ?? ref(0), tick => {
    if (tick <= 0) return
    options.clearRequestedNodePositions?.()
    rebuildGraph(true)
  })
  watch(options.readOnlyMode ?? ref(false), () => rebuildGraph())
  watch(options.collapsedPropertyConnections ?? ref(new Set<string>()), () => rebuildGraph(false, true))
  watch(options.lockedShapeIris ?? ref(new Set<string>()), () => rebuildGraph())
  watch(options.reviewMode ?? ref(false), () => rebuildGraph(false, true))
  watch(options.showClassRelations ?? ref(false), () => rebuildGraph(true))
  watch(options.showQualifiedValueShapes ?? ref(false), () => rebuildGraph(true))
  watch(options.reviewAnnotations ?? ref(new Map<string, EditorShapeReviewAnnotation>()), () => rebuildGraph())
  watch(options.draftPropertyNodeId ?? ref(null), () => rebuildGraph())
  watch([options.selectedShapeIri ?? ref(null), options.selectedPropertyKey ?? ref(null)], () => {
    updateSelectionState()
    rebuildGraph()
  })
  watch(options.highlightedShapeIri ?? ref(null), updateSelectionState)
  watch(() => {
    const requestedPositions = (options.requestedNodePositions?.value ?? {}) as Record<string, { x: number; y: number }>
    return Object.entries(requestedPositions)
      .map(([nodeId, position]) => `${nodeId}:${position.x},${position.y}`)
      .sort()
      .join('|')
  }, () => {
    const requestedPositions = options.requestedNodePositions?.value as Record<string, Node['position']> | undefined
    if (!requestedPositions || Object.keys(requestedPositions).length === 0) return

    const nextNodes = (nodes.value as Array<Node & { id: string }>).map(node => {
      const requestedPosition = requestedPositions[node.id]
      return requestedPosition
        ? { ...node, position: requestedPosition }
        : node
    })
    nodes.value = nextNodes as Node[]
  })

  return {
    nodes,
    edges,
    nodeTypes,
    edgeTypes,
    hiddenProfileCount,
  }
}
