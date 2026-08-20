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

interface UseEditorGraphOptions {
  allShapes: Ref<NodeShape[]>
  canvasShapes: Ref<NodeShape[]>
  relayoutRequestTick?: Ref<number>
  clearRequestedNodePositions?: () => void
  readOnlyMode?: Ref<boolean>
  reviewMode?: Ref<boolean>
  reviewAnnotations?: Ref<Map<string, EditorShapeReviewAnnotation>>
  openShapePreview: (shape: NodeShape) => void | Promise<void>
  addField?: (shapeIri: string) => void
  renameShape?: (shapeIri: string, label: string) => void
  renameProperty?: (shapeIri: string, propertyNodeId: string, name: string) => void
  removeReferenceEdge?: (shapeIri: string, propertyNodeId: string, targetShapeIri: string) => void
  requestedNodePositions?: Ref<Record<string, Node['position']>>
  selectedShapeIri?: Ref<string | null>
  selectedPropertyKey?: Ref<string | null>
  selectShape?: (shape: NodeShape) => void
  selectProperty?: (shape: NodeShape, property: import('@/domain/profiles').PropertyShape) => void
  openShapeHeaderMenu?: (shape: NodeShape, event: MouseEvent, options?: { allowDelete?: boolean }) => void
  moveProperty?: (sourceShapeIri: string, propertyNodeId: string, targetShapeIri: string, targetIndex?: number) => boolean
}

export function useEditorGraph(options: UseEditorGraphOptions) {
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])
  let pendingRenderedLayoutPass = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeTypes: any = editorNodeTypes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edgeTypes: any = editorEdgeTypes

  function positionForNewNode(node: Node, index: number): Node['position'] {
    const requestedPosition = options.requestedNodePositions?.value[node.id]
    if (requestedPosition) return requestedPosition
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
      node.data.selectedShapeIri = selectedShapeIri
      node.data.selectedPropertyKey = representedShapeIri === selectedShapeIri ? selectedPropertyKey : null
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

  function rebuildGraph(forceAutoLayout = false): void {
    const shapeNodes: Node[] = buildEditorShapeNodes(
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
      options.openShapeHeaderMenu,
      options.moveProperty,
      options.selectedShapeIri?.value,
      options.selectedPropertyKey?.value,
      options.reviewMode?.value ?? false,
      options.reviewAnnotations?.value,
    )

    const visibleNodeIds = new Set(shapeNodes.map(node => node.id))
    const nextEdges = buildEditorStructuralEdges(
      options.canvasShapes.value,
      options.allShapes.value,
      visibleNodeIds,
      options.removeReferenceEdge,
      options.selectedShapeIri?.value,
      options.selectedPropertyKey?.value,
    ).filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))

    const existingNodes = nodes.value as Node[]
    const existingIds = new Set(existingNodes.map(node => node.id))
    const newNodes = shapeNodes.filter(node => !existingIds.has(node.id))
    const existingShapeIris = new Set(existingNodes.map(representedShapeIriFromNode).filter((value): value is string => Boolean(value)))
    const hasNewRepresentedShapes = shapeNodes.some(node => {
      const representedShapeIri = representedShapeIriFromNode(node)
      return !representedShapeIri || !existingShapeIris.has(representedShapeIri)
    })
    const allNewNodesHaveRequestedPositions = newNodes.length > 0 && newNodes.every(node => Boolean(options.requestedNodePositions?.value[node.id]))
    const shouldRunAutoLayout = (shouldAutoLayoutEditorGraph(existingNodes, shapeNodes) || forceAutoLayout) && !allNewNodesHaveRequestedPositions
    const shouldRunRenderedLayoutPass = forceAutoLayout || (hasNewRepresentedShapes && !allNewNodesHaveRequestedPositions)

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
  watch(options.reviewMode ?? ref(false), () => rebuildGraph())
  watch(options.reviewAnnotations ?? ref(new Map<string, EditorShapeReviewAnnotation>()), () => rebuildGraph())
  watch([options.selectedShapeIri ?? ref(null), options.selectedPropertyKey ?? ref(null)], () => {
    updateSelectionState()
    rebuildGraph()
  })
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
  }
}
