import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@vue-flow/core'
import type { NodeShape } from '@/domain/profiles'
import {
  buildInheritedPropertyGroups,
  buildOwnProperties,
  inheritedPropertyPrefixCount,
  type InheritedPropertyGroup,
  type ShapeEditorNodeData,
} from '@/presentation/features/editor/inheritanceEditorGraph'

const NODE_WIDTH = 340
const NODE_MIN_HEIGHT = 180
const COLUMN_GAP = 5
const ROW_GAP = 44
const HEADER_HEIGHT = 49
const SECTION_LABEL_HEIGHT = 33
const PROPERTY_ROW_HEIGHT = 31
const ADD_FIELD_ROW_HEIGHT = 47
const NODE_VERTICAL_PADDING = 12

/**
 * Auto-layouts the editor graph with dagre in parent-first columns from left to right.
 */
export function layoutEditorGraph(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes

  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: 'LR',
    nodesep: COLUMN_GAP,
    ranksep: ROW_GAP + 350,
    marginx: 24,
    marginy: 24,
    ranker: 'network-simplex',
  })

  for (const node of nodes) {
    graph.setNode(node.id, {
      width: NODE_WIDTH,
      height: measuredOrEstimatedNodeHeight(node),
    })
  }

  for (const edge of edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  return nodes.map(node => {
    const positioned = graph.node(node.id) as { x: number; y: number } | undefined
    if (!positioned) return node

    return {
      ...node,
      position: {
        x: positioned.x - (NODE_WIDTH / 2),
        y: positioned.y - (measuredOrEstimatedNodeHeight(node) / 2),
      },
    }
  })
}

export function resolveRenderedNodeOverlaps(nodes: Node[], _edges: Edge[]): Node[] {
  return nodes
}

function estimateNodeHeight(node: Node): number {
  const data = node.data as ShapeEditorNodeData | undefined
  if (!data) return NODE_MIN_HEIGHT
  return estimateEditorShapeHeight(
    data.shape,
    data.inheritedGroups ?? [],
    data.inheritedPropertyCount,
    data.ownProperties?.length,
  )
}

function measuredOrEstimatedNodeHeight(node: Node): number {
  const dimensions = (node as Node & { dimensions?: { height?: number } }).dimensions
  const measuredHeight = dimensions?.height
  if (typeof measuredHeight === 'number' && Number.isFinite(measuredHeight) && measuredHeight > 0) {
    return measuredHeight
  }
  return estimateNodeHeight(node)
}

function countInheritedSections(groups: InheritedPropertyGroup[]): number {
  return groups.reduce((count, group) => count + 1 + countInheritedSections(group.children), 0)
}

export function estimateEditorShapeHeight(
  shape: NodeShape,
  allShapesOrInheritedGroups: NodeShape[] | InheritedPropertyGroup[],
  inheritedPropertyCountOverride?: number,
  ownPropertyCountOverride?: number,
): number {
  const inheritedGroups = isInheritedGroupCollection(allShapesOrInheritedGroups)
    ? allShapesOrInheritedGroups
    : buildInheritedPropertyGroups(shape, allShapesOrInheritedGroups)
  const inheritedPropertyCount = inheritedPropertyCountOverride
    ?? (isInheritedGroupCollection(allShapesOrInheritedGroups)
      ? shape.properties.filter(property => property.inherited).length
      : inheritedPropertyPrefixCount(shape, allShapesOrInheritedGroups))
  const ownPropertyCount = ownPropertyCountOverride
    ?? (isInheritedGroupCollection(allShapesOrInheritedGroups)
      ? shape.properties.filter(property => !property.inherited).length
      : buildOwnProperties(shape, allShapesOrInheritedGroups).length)
  const inheritedSectionCount = countInheritedSections(inheritedGroups)
  const hasOwnDivider = inheritedPropertyCount > 0 && ownPropertyCount > 0

  const estimated =
    HEADER_HEIGHT +
    (inheritedSectionCount * SECTION_LABEL_HEIGHT) +
    (inheritedPropertyCount * PROPERTY_ROW_HEIGHT) +
    (hasOwnDivider ? SECTION_LABEL_HEIGHT : 0) +
    (ownPropertyCount * PROPERTY_ROW_HEIGHT) +
    ADD_FIELD_ROW_HEIGHT +
    NODE_VERTICAL_PADDING

  return Math.max(NODE_MIN_HEIGHT, estimated)
}

function isInheritedGroupCollection(
  value: NodeShape[] | InheritedPropertyGroup[],
): value is InheritedPropertyGroup[] {
  const first = value[0]
  return Boolean(first && 'properties' in first && 'children' in first && 'shape' in first)
}
