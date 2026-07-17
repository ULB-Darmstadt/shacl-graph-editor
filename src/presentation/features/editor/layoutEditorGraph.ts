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
const COLUMN_GAP = 180
const COLUMN_GROUPING_THRESHOLD = 80
const ROW_GAP = 44
const COMPONENT_GAP = 88
const PROPERTY_ROW_SPACING = 28
const DOMINANT_PARENT_WEIGHT = 0.72
const BARYCENTER_ITERATIONS = 4
const HEADER_HEIGHT = 49
const SECTION_LABEL_HEIGHT = 33
const PROPERTY_ROW_HEIGHT = 31
const ADD_FIELD_ROW_HEIGHT = 47
const NODE_VERTICAL_PADDING = 12

interface LayoutNode {
  id: string
  node: Node
  height: number
  incoming: LayoutEdge[]
  outgoing: LayoutEdge[]
  column: number
  desiredTop: number
  top: number
}

interface LayoutEdge {
  source: string
  target: string
  sourceHandle: string | null | undefined
}

interface LayoutComponent {
  nodes: LayoutNode[]
  roots: LayoutNode[]
}

/**
 * Auto-layouts the editor graph in parent-first columns from left to right.
 *
 * The layout keeps root nodes on the left, places linked nodes in the next
 * column, and orders each column top-to-bottom based on the vertical anchor
 * implied by the parent property row that references the child.
 */
export function layoutEditorGraph(nodes: Node[], edges: Edge[]): Node[] {
  const layoutNodes = createLayoutNodes(nodes, edges)
  if (layoutNodes.length === 0) return nodes

  const components = buildComponents(layoutNodes)
  const positionedNodes = new Map<string, Node>()
  let componentOffsetY = 24

  for (const component of components) {
    assignColumns(component)
    const columns = buildColumns(component)
    componentOffsetY = layoutComponentColumns(columns, componentOffsetY)

    for (const layoutNode of component.nodes) {
      positionedNodes.set(layoutNode.id, {
        ...layoutNode.node,
        position: {
          x: 24 + (layoutNode.column * (NODE_WIDTH + COLUMN_GAP)),
          y: layoutNode.top,
        },
      })
    }
  }

  return nodes.map(node => positionedNodes.get(node.id) ?? node)
}

export function resolveRenderedNodeOverlaps(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length < 2) return nodes

  const columns = groupPositionedNodesByColumn(nodes)
  if (columns.length === 0) return nodes

  const nextPositions = new Map<string, Node['position']>()

  for (const column of columns) {
    const sorted = [...column].sort((left, right) => left.position.y - right.position.y)
    if (sorted.length === 0) continue

    const columnCenter = positionedColumnCenter(sorted)
    const packed = packPositionedColumn(sorted)
    const packedCenter = positionedColumnCenter(packed)
    const shift = columnCenter - packedCenter

    for (const node of packed) {
      nextPositions.set(node.id, {
        x: node.position.x,
        y: node.position.y + shift,
      })
    }
  }

  const resolvedNodes = nodes.map(node => {
    const position = nextPositions.get(node.id)
    return position ? { ...node, position } : node
  })

  return alignRenderedRootParents(resolvedNodes, edges)
}

function createLayoutNodes(nodes: Node[], edges: Edge[]): LayoutNode[] {
  const map = new Map<string, LayoutNode>()

  for (const node of nodes) {
    map.set(node.id, {
      id: node.id,
      node,
      height: measuredOrEstimatedNodeHeight(node),
      incoming: [],
      outgoing: [],
      column: 0,
      desiredTop: 0,
      top: 0,
    })
  }

  for (const edge of edges) {
    const source = map.get(edge.source)
    const target = map.get(edge.target)
    if (!source || !target) continue

    const layoutEdge: LayoutEdge = {
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
    }

    source.outgoing.push(layoutEdge)
    target.incoming.push(layoutEdge)
  }

  return [...map.values()]
}

function buildComponents(nodes: LayoutNode[]): LayoutComponent[] {
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const visited = new Set<string>()
  const components: LayoutComponent[] = []

  const sortedNodes = [...nodes].sort(compareRootCandidates)

  for (const start of sortedNodes) {
    if (visited.has(start.id)) continue

    const queue = [start]
    const componentNodes: LayoutNode[] = []
    visited.add(start.id)

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) continue
      componentNodes.push(current)

      for (const neighborId of neighborIds(current)) {
        if (visited.has(neighborId)) continue
        const neighbor = nodeMap.get(neighborId)
        if (!neighbor) continue
        visited.add(neighborId)
        queue.push(neighbor)
      }
    }

    const roots = componentNodes
      .filter(node => node.incoming.length === 0)
      .sort(compareRootCandidates)

    components.push({
      nodes: componentNodes,
      roots: roots.length > 0 ? roots : [pickFallbackRoot(componentNodes)],
    })
  }

  return components.sort((left, right) => compareRootCandidates(left.roots[0], right.roots[0]))
}

function neighborIds(node: LayoutNode): string[] {
  return [
    ...node.outgoing.map(edge => edge.target),
    ...node.incoming.map(edge => edge.source),
  ]
}

function pickFallbackRoot(nodes: LayoutNode[]): LayoutNode {
  return [...nodes].sort(compareRootCandidates)[0]
}

function compareRootCandidates(left: LayoutNode, right: LayoutNode): number {
  const incomingDelta = left.incoming.length - right.incoming.length
  if (incomingDelta !== 0) return incomingDelta

  const outgoingDelta = right.outgoing.length - left.outgoing.length
  if (outgoingDelta !== 0) return outgoingDelta

  return nodeLabel(left).localeCompare(nodeLabel(right), 'en')
}

function assignColumns(component: LayoutComponent): void {
  const stronglyConnectedComponents = collectStronglyConnectedComponents(component.nodes)
  const componentIndexByNodeId = new Map<string, number>()

  stronglyConnectedComponents.forEach((group, index) => {
    for (const node of group) componentIndexByNodeId.set(node.id, index)
  })

  const dagNodes = stronglyConnectedComponents.map((group, index) => ({
    index,
    nodes: group,
    outgoing: new Set<number>(),
    incomingCount: 0,
    column: 0,
  }))

  for (const node of component.nodes) {
    const sourceComponent = componentIndexByNodeId.get(node.id)
    if (sourceComponent === undefined) continue

    for (const edge of node.outgoing) {
      const targetComponent = componentIndexByNodeId.get(edge.target)
      if (targetComponent === undefined || targetComponent === sourceComponent) continue
      dagNodes[sourceComponent]?.outgoing.add(targetComponent)
    }
  }

  for (const dagNode of dagNodes) {
    for (const targetIndex of dagNode.outgoing) {
      const target = dagNodes[targetIndex]
      if (target) target.incomingCount += 1
    }
  }

  const queue = dagNodes.filter(dagNode => dagNode.incomingCount === 0)
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue

    for (const targetIndex of current.outgoing) {
      const target = dagNodes[targetIndex]
      if (!target) continue
      target.column = Math.max(target.column, current.column + 1)
      target.incomingCount -= 1
      if (target.incomingCount === 0) queue.push(target)
    }
  }

  for (const dagNode of dagNodes) {
    for (const node of dagNode.nodes) {
      node.column = dagNode.column
    }
  }
}

function collectStronglyConnectedComponents(nodes: LayoutNode[]): LayoutNode[][] {
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const visited = new Set<string>()
  const order: string[] = []

  function visitForward(nodeId: string): void {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const node = nodeById.get(nodeId)
    if (!node) return

    for (const edge of node.outgoing) {
      visitForward(edge.target)
    }

    order.push(nodeId)
  }

  for (const node of nodes) visitForward(node.id)

  const reverseAdjacency = new Map<string, string[]>()
  for (const node of nodes) {
    if (!reverseAdjacency.has(node.id)) reverseAdjacency.set(node.id, [])
    for (const edge of node.outgoing) {
      const list = reverseAdjacency.get(edge.target) ?? []
      list.push(node.id)
      reverseAdjacency.set(edge.target, list)
    }
  }

  const assigned = new Set<string>()
  const components: LayoutNode[][] = []

  function visitReverse(nodeId: string, component: LayoutNode[]): void {
    if (assigned.has(nodeId)) return
    assigned.add(nodeId)
    const node = nodeById.get(nodeId)
    if (!node) return
    component.push(node)

    for (const sourceId of reverseAdjacency.get(nodeId) ?? []) {
      visitReverse(sourceId, component)
    }
  }

  for (let index = order.length - 1; index >= 0; index -= 1) {
    const nodeId = order[index]
    if (!nodeId || assigned.has(nodeId)) continue
    const component: LayoutNode[] = []
    visitReverse(nodeId, component)
    if (component.length > 0) components.push(component)
  }

  return components
}

function buildColumns(component: LayoutComponent): LayoutNode[][] {
  const columnMap = new Map<number, LayoutNode[]>()

  for (const node of component.nodes) {
    const columnNodes = columnMap.get(node.column) ?? []
    columnNodes.push(node)
    columnMap.set(node.column, columnNodes)
  }

  return [...columnMap.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, nodes]) => nodes)
}

function layoutComponentColumns(columns: LayoutNode[][], startY: number): number {
  if (columns.length === 0) return startY
  const nodeById = buildLayoutNodeLookup(columns)

  const firstColumn = columns[0] ?? []
  sortColumn(firstColumn, nodeById)
  placeColumnSequentially(firstColumn, startY)

  optimizeColumnOrdering(columns)

  for (let index = 1; index < columns.length; index += 1) {
    const column = columns[index] ?? []
    const previousColumns = columns.slice(0, index)
    updateDesiredPositions(column, previousColumns)
    sortColumn(column, nodeById)
    placeColumnByDesiredTop(column, startY)
  }

  centerColumnsVertically(columns, startY)
  resolveColumnOverlaps(columns, startY)

  return maxBottom(columns) + COMPONENT_GAP
}

function sortColumn(nodes: LayoutNode[], nodeById: Map<string, LayoutNode>): void {
  nodes.sort((left, right) => {
    const dominantParentOrderDelta = dominantParentOrderScore(left, nodeById) - dominantParentOrderScore(right, nodeById)
    if (dominantParentOrderDelta !== 0) return dominantParentOrderDelta

    if (left.desiredTop !== right.desiredTop) return left.desiredTop - right.desiredTop

    const barycenterDelta = barycenterScore(left) - barycenterScore(right)
    if (barycenterDelta !== 0) return barycenterDelta

    const anchorDelta = averagePropertyAnchor(left) - averagePropertyAnchor(right)
    if (anchorDelta !== 0) return anchorDelta

    return nodeLabel(left).localeCompare(nodeLabel(right), 'en')
  })
}

function placeColumnSequentially(nodes: LayoutNode[], startY: number): void {
  let cursor = startY
  for (const node of nodes) {
    node.top = cursor
    node.desiredTop = cursor
    cursor += node.height + ROW_GAP
  }
}

function updateDesiredPositions(nodes: LayoutNode[], previousColumns: LayoutNode[][]): void {
  const previousNodeMap = new Map(previousColumns.flat().map(node => [node.id, node]))

  for (const node of nodes) {
    const anchors = node.incoming
      .map(edge => {
        const parent = previousNodeMap.get(edge.source)
        if (!parent) return null
        return parent.top + propertyIndexForHandle(parent.node, edge.sourceHandle) * PROPERTY_ROW_SPACING
      })
      .filter((value): value is number => Number.isFinite(value))

    const dominantParent = dominantParentNode(node, previousNodeMap)
    const dominantCenter = dominantParent ? nodeCenter(dominantParent) : null
    const anchorCenter = anchors.length > 0
      ? anchors.reduce((sum, value) => sum + value, 0) / anchors.length
      : null

    const preferredCenter =
      dominantCenter !== null && anchorCenter !== null
        ? (dominantCenter * DOMINANT_PARENT_WEIGHT) + (anchorCenter * (1 - DOMINANT_PARENT_WEIGHT))
        : dominantCenter ?? anchorCenter

    node.desiredTop = preferredCenter !== null
      ? preferredCenter - (node.height / 2)
      : node.top
  }
}

function placeColumnByDesiredTop(nodes: LayoutNode[], startY: number): void {
  let cursor = startY

  for (const node of nodes) {
    const top = Math.max(cursor, node.desiredTop)
    node.top = top
    cursor = top + node.height + ROW_GAP
  }

  for (let index = nodes.length - 2; index >= 0; index -= 1) {
    const current = nodes[index]
    const next = nodes[index + 1]
    const maxTop = next.top - current.height - ROW_GAP
    if (current.top <= maxTop) continue
    current.top = Math.max(startY, maxTop)
  }

  for (let index = 1; index < nodes.length; index += 1) {
    const previous = nodes[index - 1]
    const current = nodes[index]
    const minTop = previous.top + previous.height + ROW_GAP
    if (current.top >= minTop) continue
    current.top = minTop
  }
}

function maxBottom(columns: LayoutNode[][]): number {
  return columns.reduce((maximum, column) => {
    const bottom = column.reduce((columnMaximum, node) => Math.max(columnMaximum, node.top + node.height), 0)
    return Math.max(maximum, bottom)
  }, 0)
}

function optimizeColumnOrdering(columns: LayoutNode[][]): void {
  if (columns.length < 2) return

  for (let iteration = 0; iteration < BARYCENTER_ITERATIONS; iteration += 1) {
    for (let columnIndex = 1; columnIndex < columns.length; columnIndex += 1) {
      sortColumnByBarycenter(columns, columnIndex, 'incoming')
    }

    for (let columnIndex = columns.length - 2; columnIndex >= 0; columnIndex -= 1) {
      sortColumnByBarycenter(columns, columnIndex, 'outgoing')
    }
  }
}

function sortColumnByBarycenter(
  columns: LayoutNode[][],
  columnIndex: number,
  direction: 'incoming' | 'outgoing',
): void {
  const column = columns[columnIndex] ?? []
  if (column.length < 2) return

  const orderByNodeId = buildOrderIndex(columns)
  const nodeById = buildLayoutNodeLookup(columns)

  column.sort((left, right) => {
    const dominantParentOrderDelta = dominantParentOrderScore(left, nodeById) - dominantParentOrderScore(right, nodeById)
    if (dominantParentOrderDelta !== 0) return dominantParentOrderDelta

    const leftScore = barycenterScoreForDirection(left, direction, orderByNodeId)
    const rightScore = barycenterScoreForDirection(right, direction, orderByNodeId)

    if (leftScore !== rightScore) return leftScore - rightScore

    const leftParent = dominantNeighborScore(left, direction, orderByNodeId)
    const rightParent = dominantNeighborScore(right, direction, orderByNodeId)
    if (leftParent !== rightParent) return leftParent - rightParent

    return nodeLabel(left).localeCompare(nodeLabel(right), 'en')
  })
}

function buildOrderIndex(columns: LayoutNode[][]): Map<string, number> {
  const orderByNodeId = new Map<string, number>()

  for (const column of columns) {
    column.forEach((node, index) => {
      orderByNodeId.set(node.id, index)
    })
  }

  return orderByNodeId
}

function buildLayoutNodeLookup(columns: LayoutNode[][]): Map<string, LayoutNode> {
  const nodeById = new Map<string, LayoutNode>()

  for (const column of columns) {
    for (const node of column) {
      nodeById.set(node.id, node)
    }
  }

  return nodeById
}

function barycenterScore(node: LayoutNode): number {
  return averagePropertyAnchor(node)
}

function barycenterScoreForDirection(
  node: LayoutNode,
  direction: 'incoming' | 'outgoing',
  orderByNodeId: Map<string, number>,
): number {
  const edges = direction === 'incoming' ? node.incoming : node.outgoing
  if (edges.length === 0) return Number.POSITIVE_INFINITY

  const scores = edges
    .map(edge => {
      const neighborId = direction === 'incoming' ? edge.source : edge.target
      return orderByNodeId.get(neighborId)
    })
    .filter((value): value is number => value !== undefined)

  if (scores.length === 0) return Number.POSITIVE_INFINITY
  return scores.reduce((sum, value) => sum + value, 0) / scores.length
}

function dominantNeighborScore(
  node: LayoutNode,
  direction: 'incoming' | 'outgoing',
  orderByNodeId: Map<string, number>,
): number {
  const edges = direction === 'incoming' ? node.incoming : node.outgoing
  if (edges.length === 0) return Number.POSITIVE_INFINITY

  const edge = edges[0]
  const neighborId = direction === 'incoming' ? edge.source : edge.target
  return orderByNodeId.get(neighborId) ?? Number.POSITIVE_INFINITY
}

function centerColumnsVertically(columns: LayoutNode[][], minimumTop: number): void {
  const minTop = columns.reduce((minimum, column) => Math.min(minimum, columnTop(column)), Number.POSITIVE_INFINITY)
  const maxBottomValue = maxBottom(columns)
  const componentCenter = (minTop + maxBottomValue) / 2

  for (const column of columns) {
    const shift = componentCenter - columnCenter(column)
    for (const node of column) {
      node.top += shift
    }
  }

  const centeredMinTop = columns.reduce((minimum, column) => Math.min(minimum, columnTop(column)), Number.POSITIVE_INFINITY)
  if (centeredMinTop < minimumTop) {
    const correction = minimumTop - centeredMinTop
    for (const column of columns) {
      for (const node of column) {
        node.top += correction
      }
    }
  }
}

function resolveColumnOverlaps(columns: LayoutNode[][], minimumTop: number): void {
  for (const column of columns) {
    if (column.length < 2) continue

    column.sort((left, right) => left.top - right.top)
    enforceMinimumGapForward(column, minimumTop)
    enforceMinimumGapBackward(column, minimumTop)
    enforceMinimumGapForward(column, minimumTop)
  }
}

function enforceMinimumGapForward(column: LayoutNode[], minimumTop: number): void {
  let cursor = minimumTop

  for (const node of column) {
    if (node.top < cursor) {
      node.top = cursor
    }
    cursor = node.top + node.height + ROW_GAP
  }
}

function enforceMinimumGapBackward(column: LayoutNode[], minimumTop: number): void {
  const bottom = column.reduce((maximum, node) => Math.max(maximum, node.top + node.height), minimumTop)
  let cursor = bottom

  for (let index = column.length - 1; index >= 0; index -= 1) {
    const node = column[index]
    const maxTop = cursor - node.height
    if (node.top > maxTop) {
      node.top = maxTop
    }
    cursor = Math.max(minimumTop, node.top - ROW_GAP)
  }
}

function columnTop(column: LayoutNode[]): number {
  return column.reduce((minimum, node) => Math.min(minimum, node.top), Number.POSITIVE_INFINITY)
}

function columnCenter(column: LayoutNode[]): number {
  const top = columnTop(column)
  const bottom = column.reduce((maximum, node) => Math.max(maximum, node.top + node.height), 0)
  return (top + bottom) / 2
}

function averagePropertyAnchor(node: LayoutNode): number {
  if (node.incoming.length === 0) return node.top
  return node.incoming.reduce((sum, edge) => sum + propertyIndexForHandle(node.node, edge.sourceHandle), 0) / node.incoming.length
}

function dominantParentNode(node: LayoutNode, previousNodeMap: Map<string, LayoutNode>): LayoutNode | null {
  const candidates = dominantParentCandidates(node, previousNodeMap)

  if (candidates.length === 0) return null

  return candidates[0]?.parent ?? null
}

function dominantParentOrderScore(node: LayoutNode, nodeById: Map<string, LayoutNode>): number {
  const parentOrders = node.incoming
    .map(edge => ({
      source: edge.source,
      propertyIndex: sourcePropertyOrderScore(edge, nodeById),
    }))
    .filter(entry => Number.isFinite(entry.propertyIndex))

  if (parentOrders.length === 0) return Number.POSITIVE_INFINITY

  parentOrders.sort((left, right) => {
    if (left.propertyIndex !== right.propertyIndex) return left.propertyIndex - right.propertyIndex
    return left.source.localeCompare(right.source, 'en')
  })

  const dominant = parentOrders[0]
  return (dominant.propertyIndex * 10_000) + stableStringScore(dominant.source)
}

function dominantParentCandidates(
  node: LayoutNode,
  previousNodeMap: Map<string, LayoutNode>,
): Array<{ parent: LayoutNode; columnDistance: number; propertyIndex: number; outDegree: number }> {
  return node.incoming
    .map(edge => {
      const parent = previousNodeMap.get(edge.source)
      if (!parent) return null
      return {
        parent,
        columnDistance: Math.max(0, node.column - parent.column),
        propertyIndex: propertyIndexForHandle(parent.node, edge.sourceHandle),
        outDegree: parent.outgoing.length,
      }
    })
    .filter((value): value is { parent: LayoutNode; columnDistance: number; propertyIndex: number; outDegree: number } => value !== null)
    .sort((left, right) => {
      if (left.columnDistance !== right.columnDistance) return left.columnDistance - right.columnDistance
      if (left.outDegree !== right.outDegree) return right.outDegree - left.outDegree
      if (left.propertyIndex !== right.propertyIndex) return left.propertyIndex - right.propertyIndex
      return nodeLabel(left.parent).localeCompare(nodeLabel(right.parent), 'en')
    })
}

function sourcePropertyOrderScore(edge: LayoutEdge, nodeById: Map<string, LayoutNode>): number {
  if (!edge.sourceHandle?.startsWith('ref:')) return Number.POSITIVE_INFINITY
  const sourceNode = nodeById.get(edge.source)?.node
  if (!sourceNode) return Number.POSITIVE_INFINITY
  return propertyIndexForHandle(sourceNode, edge.sourceHandle)
}

function nodeCenter(node: LayoutNode): number {
  return node.top + (node.height / 2)
}

function stableStringScore(value: string): number {
  let score = 0
  for (let index = 0; index < value.length; index += 1) {
    score += value.charCodeAt(index)
  }
  return score
}


function groupPositionedNodesByColumn(nodes: Node[]): Node[][] {
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

function packPositionedColumn(nodes: Node[]): Node[] {
  const packed = nodes.map(node => ({
    ...node,
    position: { ...node.position },
  }))

  let cursor = packed[0]?.position.y ?? 0
  for (const node of packed) {
    if (node.position.y < cursor) {
      node.position.y = cursor
    }
    cursor = node.position.y + measuredOrEstimatedNodeHeight(node) + ROW_GAP
  }

  return packed
}

function alignRenderedRootParents(nodes: Node[], edges: Edge[]): Node[] {
  const columns = groupPositionedNodesByColumn(nodes)
  const rootColumn = columns[0] ?? []
  if (rootColumn.length === 0) return nodes
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const columnIndexByNodeId = new Map<string, number>()
  const incomingCountByNodeId = new Map<string, number>()

  columns.forEach((column, columnIndex) => {
    for (const node of column) {
      columnIndexByNodeId.set(node.id, columnIndex)
    }
  })

  for (const edge of edges) {
    incomingCountByNodeId.set(edge.target, (incomingCountByNodeId.get(edge.target) ?? 0) + 1)
  }

  const adjustedNodes = new Map(nodes.map(node => [node.id, {
    ...node,
    position: { ...node.position },
  }]))

  const rootEntries = rootColumn
      .map(node => adjustedNodes.get(node.id) ?? node)
      .map(node => {
        const isRoot = (incomingCountByNodeId.get(node.id) ?? 0) === 0
        if (!isRoot) return null

        const sourceColumnIndex = columnIndexByNodeId.get(node.id)
        if (sourceColumnIndex === undefined) return null

        const outgoingEdges = edges
          .filter(edge => edge.source === node.id)
          .map(edge => ({
            edge,
            target: nodeById.get(edge.target),
            targetColumnIndex: columnIndexByNodeId.get(edge.target),
          }))
          .filter((entry): entry is { edge: Edge; target: Node; targetColumnIndex: number } =>
            entry.target !== undefined
            && entry.targetColumnIndex !== undefined
            && entry.targetColumnIndex > sourceColumnIndex,
          )

        if (outgoingEdges.length === 0) return null

        const nearestTargetColumnIndex = outgoingEdges.reduce(
          (minimum, entry) => Math.min(minimum, entry.targetColumnIndex),
          Number.POSITIVE_INFINITY,
        )

        const directTargets = outgoingEdges
          .filter(entry => entry.targetColumnIndex === nearestTargetColumnIndex)
          .map(entry => entry.target)

        if (directTargets.length === 0) return null

        const targetCenter = directTargets.reduce((sum, target) => sum + positionedNodeCenter(target), 0) / directTargets.length
        return {
          node,
          desiredTop: targetCenter - (measuredOrEstimatedNodeHeight(node) / 2),
        }
      })
      .filter((entry): entry is { node: Node; desiredTop: number } => entry !== null)
      .sort((left, right) => left.desiredTop - right.desiredTop)

  if (rootEntries.length === 0) return nodes

  let cursor = rootEntries[0]?.desiredTop ?? 0
  for (const entry of rootEntries) {
    entry.node.position.y = Math.max(cursor, entry.desiredTop)
    cursor = entry.node.position.y + measuredOrEstimatedNodeHeight(entry.node) + ROW_GAP
  }

  const repackedColumn = packPositionedColumn(
    rootColumn
      .map(node => adjustedNodes.get(node.id) ?? node)
      .sort((left, right) => left.position.y - right.position.y),
  )

  for (const repackedNode of repackedColumn) {
    adjustedNodes.set(repackedNode.id, repackedNode)
  }

  return nodes.map(node => adjustedNodes.get(node.id) ?? node)
}

function positionedColumnCenter(nodes: Node[]): number {
  const top = Math.min(...nodes.map(node => node.position.y))
  const bottom = Math.max(...nodes.map(node => node.position.y + measuredOrEstimatedNodeHeight(node)))
  return (top + bottom) / 2
}

function positionedNodeCenter(node: Node): number {
  return node.position.y + (measuredOrEstimatedNodeHeight(node) / 2)
}

function propertyIndexForHandle(node: Node, sourceHandle: string | null | undefined): number {
  if (!sourceHandle?.startsWith('ref:')) return 0

  const propertyNodeId = sourceHandle.slice('ref:'.length)
  const shape = shapeFromNode(node)
  if (!shape) return 0

  const index = shape.properties.findIndex(property => property.nodeId.value === propertyNodeId)
  return index >= 0 ? index + 1 : 0
}

function shapeFromNode(node: Node): NodeShape | null {
  const data = node.data as { shape?: NodeShape } | undefined
  return data?.shape ?? null
}

function nodeLabel(node: LayoutNode): string {
  const shape = shapeFromNode(node.node)
  return shape?.label ?? node.id
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
