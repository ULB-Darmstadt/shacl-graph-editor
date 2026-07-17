import { nextTick, ref, watch, type Ref } from 'vue'
import type { Edge, Node } from '@vue-flow/core'
import type { NodeShape } from '@/domain/profiles'
import {
  buildEditorShapeNodes,
  buildEditorStructuralEdges,
  preserveEditorNodePositions,
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
  openShapePreview: (shape: NodeShape) => void | Promise<void>
  addField?: (shapeIri: string) => void
  removeReferenceEdge?: (shapeIri: string, propertyNodeId: string, targetShapeIri: string) => void
  requestedNodePositions?: Ref<Record<string, Node['position']>>
  selectedShapeIri?: Ref<string | null>
  selectedPropertyKey?: Ref<string | null>
  selectShape?: (shape: NodeShape) => void
  selectProperty?: (shape: NodeShape, property: import('@/domain/profiles').PropertyShape) => void
}

export function useEditorGraph(options: UseEditorGraphOptions) {
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])
  const viewportRefreshTick = ref(0)
  let pendingRenderedLayoutPass = 0
  let pendingFullRelayoutPass = 0
  let lastFullRelayoutSignature = ''

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

  function graphStructureSignature(nextNodes: Node[], nextEdges: Edge[]): string {
    return [
      nextNodes.map(node => node.id).sort().join('|'),
      nextEdges.map(edge => `${edge.source}->${edge.target}:${edge.sourceHandle ?? ''}`).sort().join('|'),
    ].join('::')
  }

  function scheduleFullRelayout(nextNodes: Node[], nextEdges: Edge[]): void {
    const signature = graphStructureSignature(nextNodes, nextEdges)
    if (signature === lastFullRelayoutSignature) return

    lastFullRelayoutSignature = signature
    pendingFullRelayoutPass += 1
    const passId = pendingFullRelayoutPass

    void nextTick(() => {
      if (passId !== pendingFullRelayoutPass) return

      requestAnimationFrame(() => {
        if (passId !== pendingFullRelayoutPass) return

        requestAnimationFrame(() => {
          if (passId !== pendingFullRelayoutPass) return
          rebuildGraph(true)
          viewportRefreshTick.value += 1
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
      options.addField,
      options.selectShape,
      options.selectProperty,
      options.selectedShapeIri?.value,
      options.selectedPropertyKey?.value,
    )

    const visibleNodeIds = new Set(shapeNodes.map(node => node.id))
    const nextEdges = buildEditorStructuralEdges(
      options.canvasShapes.value,
      options.allShapes.value,
      visibleNodeIds,
      options.removeReferenceEdge,
    ).filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))

    const existingNodes = nodes.value as Node[]
    const existingIds = new Set(existingNodes.map(node => node.id))
    const newNodes = shapeNodes.filter(node => !existingIds.has(node.id))
    const allNewNodesHaveRequestedPositions = newNodes.length > 0 && newNodes.every(node => Boolean(options.requestedNodePositions?.value[node.id]))
    const shouldRunAutoLayout = (shouldAutoLayoutEditorGraph(existingNodes, shapeNodes) || forceAutoLayout) && !allNewNodesHaveRequestedPositions

    nodes.value = shouldRunAutoLayout
      ? autoLayoutNodes(shapeNodes, nextEdges)
      : preserveEditorNodePositions(existingNodes, shapeNodes, positionForNewNode)
    edges.value = nextEdges
    scheduleRenderedLayoutPass()

    if (!forceAutoLayout && shouldRunAutoLayout) {
      scheduleFullRelayout(shapeNodes, nextEdges)
    }
  }

  watch([options.canvasShapes, options.allShapes], () => rebuildGraph(), { immediate: true })
  watch([options.selectedShapeIri ?? ref(null), options.selectedPropertyKey ?? ref(null)], () => rebuildGraph())
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
    viewportRefreshTick,
  }
}
