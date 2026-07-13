import type { Edge } from '@vue-flow/core'
import type { NodeShape, PropertyShape } from '@/domain/NodeShape'

const ROOT_SHAPE_NODE_PREFIX = 'shape:'
const INHERITED_SHAPE_NODE_PREFIX = 'inherited:'

export interface ShapeCanvasNodeData {
  shape: NodeShape
  ownerShapeIri: string
  representedShapeIri: string
  inheritedOriginShapes?: NodeShape[]
  inheritedPropertyCount?: number
  interactive?: boolean
  anchorNodeId?: string
  inheritedIndex?: number
  canToggleInherited?: boolean
  inheritedExpanded?: boolean
  isInheritedProxy?: boolean
  onToggleInherited?: () => void
  onPreview?: () => void
}

export interface ShapeCanvasNodeDescriptor {
  nodeId: string
  ownerShapeIri: string
  representedShapeIri: string
  shape: NodeShape
  anchorNodeId?: string
  inheritedIndex?: number
  inheritedExpanded: boolean
  canToggleInherited: boolean
  isInheritedProxy: boolean
}

export function buildCanvasShapeNodeId(shapeIri: string): string {
  return `${ROOT_SHAPE_NODE_PREFIX}${shapeIri}`
}

export function buildCanvasInheritedShapeNodeId(ownerShapeIri: string, branchShapeIris: string[]): string {
  return `${INHERITED_SHAPE_NODE_PREFIX}${encodeSegment(ownerShapeIri)}::${branchShapeIris.map(encodeSegment).join('::')}`
}

export function parseCanvasShapeNodeTarget(nodeId: string): { ownerShapeIri: string; representedShapeIri: string } | null {
  if (nodeId.startsWith(ROOT_SHAPE_NODE_PREFIX)) {
    const shapeIri = nodeId.slice(ROOT_SHAPE_NODE_PREFIX.length)
    return {
      ownerShapeIri: shapeIri,
      representedShapeIri: shapeIri,
    }
  }

  if (!nodeId.startsWith(INHERITED_SHAPE_NODE_PREFIX)) return null

  const rawSegments = nodeId.slice(INHERITED_SHAPE_NODE_PREFIX.length).split('::').filter(Boolean)
  if (rawSegments.length < 2) return null

  const decodedSegments = rawSegments.map(decodeSegment)
  return {
    ownerShapeIri: decodedSegments[0],
    representedShapeIri: decodedSegments[decodedSegments.length - 1],
  }
}

export function collectVisibleShapeNodeDescriptors(
  rootShapes: NodeShape[],
  allShapes: NodeShape[],
  expandedShapeNodeIds: Set<string>,
): ShapeCanvasNodeDescriptor[] {
  const allShapesByIri = new Map(allShapes.map(shape => [shape.nodeId.value, shape]))
  const descriptors: ShapeCanvasNodeDescriptor[] = []

  for (const rootShape of rootShapes) {
    const rootNodeId = buildCanvasShapeNodeId(rootShape.nodeId.value)
    descriptors.push({
      nodeId: rootNodeId,
      ownerShapeIri: rootShape.nodeId.value,
      representedShapeIri: rootShape.nodeId.value,
      shape: rootShape,
      anchorNodeId: undefined,
      inheritedIndex: undefined,
      inheritedExpanded: expandedShapeNodeIds.has(rootNodeId),
      canToggleInherited: (rootShape.inheritedShapeIris?.length ?? 0) > 0,
      isInheritedProxy: false,
    })

    collectInheritedChildDescriptors({
      descriptors,
      ownerShapeIri: rootShape.nodeId.value,
      parentShape: rootShape,
      parentNodeId: rootNodeId,
      branchShapeIris: [],
      allShapesByIri,
      expandedShapeNodeIds,
    })
  }

  return descriptors
}

export function inheritedOriginShapesForRoot(shape: NodeShape, allShapes: NodeShape[]): NodeShape[] {
  const allShapesByIri = new Map(allShapes.map(candidate => [candidate.nodeId.value, candidate]))
  return (shape.inheritedShapeIris ?? [])
    .map(inheritedShapeIri => allShapesByIri.get(inheritedShapeIri))
    .filter((candidate): candidate is NodeShape => Boolean(candidate))
}

export function inheritedPropertyPrefixCount(shape: NodeShape, allShapes: NodeShape[]): number {
  const inheritedOriginShapes = inheritedOriginShapesForRoot(shape, allShapes)
  let longestPrefix = 0

  for (const inheritedShape of inheritedOriginShapes) {
    const prefixLength = sharedPropertyPrefixLength(shape.properties, inheritedShape.properties)
    if (prefixLength > longestPrefix) longestPrefix = prefixLength
  }

  if (longestPrefix > 0) return longestPrefix
  return shape.properties.filter(property => property.inherited).length
}

export function buildInheritedOriginEdges(
  rootShapes: NodeShape[],
  allShapes: NodeShape[],
  expandedShapeNodeIds: Set<string>,
  visibleNodeIds: Set<string> | undefined,
  style: Edge['style'],
): Edge[] {
  const edges: Edge[] = []
  const allShapesByIri = new Map(allShapes.map(shape => [shape.nodeId.value, shape]))

  for (const shape of rootShapes) {
    collectInheritedOriginEdges({
      edges,
      ownerShapeIri: shape.nodeId.value,
      parentShape: shape,
      parentNodeId: buildCanvasShapeNodeId(shape.nodeId.value),
      branchShapeIris: [],
      allShapesByIri,
      expandedShapeNodeIds,
      visibleNodeIds,
      style,
    })
  }

  return edges
}

function collectInheritedChildDescriptors(options: {
  descriptors: ShapeCanvasNodeDescriptor[]
  ownerShapeIri: string
  parentShape: NodeShape
  parentNodeId: string
  branchShapeIris: string[]
  allShapesByIri: Map<string, NodeShape>
  expandedShapeNodeIds: Set<string>
}): void {
  if (!options.expandedShapeNodeIds.has(options.parentNodeId)) return

  const availableChildren = (options.parentShape.inheritedShapeIris ?? [])
    .map(childIri => options.allShapesByIri.get(childIri))
    .filter((childShape): childShape is NodeShape => Boolean(childShape))

  for (const [index, childShape] of availableChildren.entries()) {
    const childBranchShapeIris = [...options.branchShapeIris, childShape.nodeId.value]
    const childNodeId = buildCanvasInheritedShapeNodeId(options.ownerShapeIri, childBranchShapeIris)
    options.descriptors.push({
      nodeId: childNodeId,
      ownerShapeIri: options.ownerShapeIri,
      representedShapeIri: childShape.nodeId.value,
      shape: childShape,
      anchorNodeId: options.parentNodeId,
      inheritedIndex: index,
      inheritedExpanded: options.expandedShapeNodeIds.has(childNodeId),
      canToggleInherited: (childShape.inheritedShapeIris?.length ?? 0) > 0,
      isInheritedProxy: true,
    })

    collectInheritedChildDescriptors({
      descriptors: options.descriptors,
      ownerShapeIri: options.ownerShapeIri,
      parentShape: childShape,
      parentNodeId: childNodeId,
      branchShapeIris: childBranchShapeIris,
      allShapesByIri: options.allShapesByIri,
      expandedShapeNodeIds: options.expandedShapeNodeIds,
    })
  }
}

function collectInheritedOriginEdges(options: {
  edges: Edge[]
  ownerShapeIri: string
  parentShape: NodeShape
  parentNodeId: string
  branchShapeIris: string[]
  allShapesByIri: Map<string, NodeShape>
  expandedShapeNodeIds: Set<string>
  visibleNodeIds?: Set<string>
  style: Edge['style']
}): void {
  if (!options.expandedShapeNodeIds.has(options.parentNodeId)) return

  const availableChildren = (options.parentShape.inheritedShapeIris ?? [])
    .map(childIri => options.allShapesByIri.get(childIri))
    .filter((childShape): childShape is NodeShape => Boolean(childShape))

  for (const childShape of availableChildren) {
    const childBranchShapeIris = [...options.branchShapeIris, childShape.nodeId.value]
    const childNodeId = buildCanvasInheritedShapeNodeId(options.ownerShapeIri, childBranchShapeIris)
    if (!options.visibleNodeIds || (options.visibleNodeIds.has(options.parentNodeId) && options.visibleNodeIds.has(childNodeId))) {
      options.edges.push({
        id: `inh:${options.parentNodeId}->${childNodeId}`,
        source: options.parentNodeId,
        sourceHandle: 'inheritance-source',
        target: childNodeId,
        targetHandle: 'inheritance-target',
        label: 'sh:node',
        type: 'default',
        animated: false,
        style: options.style,
        data: {
          relationLabel: 'sh:node',
          edgeKind: 'inherited',
        },
      })
    }

    collectInheritedOriginEdges({
      edges: options.edges,
      ownerShapeIri: options.ownerShapeIri,
      parentShape: childShape,
      parentNodeId: childNodeId,
      branchShapeIris: childBranchShapeIris,
      allShapesByIri: options.allShapesByIri,
      expandedShapeNodeIds: options.expandedShapeNodeIds,
      visibleNodeIds: options.visibleNodeIds,
      style: options.style,
    })
  }
}

function sharedPropertyPrefixLength(parentProperties: PropertyShape[], inheritedShapeProperties: PropertyShape[]): number {
  const length = Math.min(parentProperties.length, inheritedShapeProperties.length)
  let index = 0

  while (index < length) {
    if (!propertiesMatch(parentProperties[index], inheritedShapeProperties[index])) break
    index += 1
  }

  return index
}

function propertiesMatch(left: PropertyShape, right: PropertyShape): boolean {
  const leftKey = left.path?.value ?? left.nodeId.value
  const rightKey = right.path?.value ?? right.nodeId.value
  if (leftKey === rightKey) return true

  const leftLabel = left.name ?? leftKey
  const rightLabel = right.name ?? rightKey
  return leftLabel === rightLabel
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value)
}

function decodeSegment(value: string): string {
  return decodeURIComponent(value)
}