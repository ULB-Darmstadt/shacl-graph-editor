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
const COLUMN_GROUPING_THRESHOLD = 80
const PROPERTY_ROW_SPACING = 28
const HEADER_HEIGHT = 49
const SECTION_LABEL_HEIGHT = 33
const PROPERTY_ROW_HEIGHT = 31
const ADD_FIELD_ROW_HEIGHT = 47
const NODE_VERTICAL_PADDING = 12

/**
 * Auto-layouts the editor graph using Dagre with left-to-right flow.
 */
export function layoutEditorGraph(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 56,
    ranksep: 120,
    marginx: 24,
    marginy: 24,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  const nodeHeights = new Map<string, number>()
  for (const node of nodes) {
    const height = estimateNodeHeight(node)
    nodeHeights.set(node.id, height)
    graph.setNode(node.id, { width: NODE_WIDTH, height })
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  const laidOutNodes = nodes.map(node => {
    const positioned = graph.node(node.id)
    const height = nodeHeights.get(node.id) ?? NODE_MIN_HEIGHT
    if (!positioned) return node
    return {
      ...node,
      position: {
        x: positioned.x - NODE_WIDTH / 2,
        y: positioned.y - height / 2,
      },
    }
  })

  return reorderNodesWithinColumns(laidOutNodes, edges)
}

function reorderNodesWithinColumns(nodes: Node[], edges: Edge[]): Node[] {
  const nodesById = new Map(nodes.map(node => [node.id, node]))
  const columns = groupNodesByColumn(nodes)

  for (const column of columns.slice(1)) {
    const targetPositions = [...column]
      .map(node => node.position.y)
      .sort((left, right) => left - right)

    const sortedByScore = [...column].sort((left, right) => {
      const leftScore = desiredVerticalScore(left, edges, nodesById)
      const rightScore = desiredVerticalScore(right, edges, nodesById)

      if (leftScore === rightScore) return left.position.y - right.position.y
      return leftScore - rightScore
    })

    sortedByScore.forEach((node, index) => {
      node.position = {
        ...node.position,
        y: targetPositions[index] ?? node.position.y,
      }
    })
  }

  return nodes
}

function groupNodesByColumn(nodes: Node[]): Node[][] {
  const sorted = [...nodes].sort((left, right) => left.position.x - right.position.x)
  const columns: Node[][] = []

  for (const node of sorted) {
    const currentColumn = columns.at(-1)
    if (!currentColumn) {
      columns.push([node])
      continue
    }

    const referenceX = currentColumn[0]?.position.x ?? node.position.x
    if (Math.abs(node.position.x - referenceX) <= COLUMN_GROUPING_THRESHOLD) {
      currentColumn.push(node)
      continue
    }

    columns.push([node])
  }

  return columns
}

function desiredVerticalScore(node: Node, edges: Edge[], nodesById: Map<string, Node>): number {
  const incoming = edges.filter(edge => edge.target === node.id)
  if (incoming.length === 0) return node.position.y

  const scores = incoming
    .map(edge => incomingEdgeScore(edge, nodesById))
    .filter((score): score is number => Number.isFinite(score))

  if (scores.length === 0) return node.position.y
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

function incomingEdgeScore(edge: Edge, nodesById: Map<string, Node>): number | null {
  const sourceNode = nodesById.get(edge.source)
  if (!sourceNode) return null

  const propertyIndex = propertyIndexForHandle(sourceNode, edge.sourceHandle)
  return sourceNode.position.y + (propertyIndex * PROPERTY_ROW_SPACING)
}

function propertyIndexForHandle(node: Node, sourceHandle: string | null | undefined): number {
  if (!sourceHandle?.startsWith('ref:')) return 0

  const propertyNodeId = sourceHandle.slice('ref:'.length)
  const shape = shapeFromNode(node)
  if (!shape) return 0

  const index = shape.properties.findIndex(property => property.nodeId.value === propertyNodeId)
  return index >= 0 ? index : 0
}

function shapeFromNode(node: Node): NodeShape | null {
  const data = node.data as { shape?: NodeShape } | undefined
  return data?.shape ?? null
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
