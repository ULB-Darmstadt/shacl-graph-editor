import type { NodeShape, PropertyShape } from '@/domain/profiles'

export interface ShapeEditorNodeData {
  shape: NodeShape
  ownerShapeIri: string
  representedShapeIri: string
  inheritedOriginShapes?: NodeShape[]
  inheritedPropertyCount?: number
  inheritedGroups?: InheritedPropertyGroup[]
  ownProperties?: PropertyShape[]
  interactive?: boolean
  onPreview?: () => void | Promise<void>
  onAddField?: () => void
  onSelectShape?: (shape: NodeShape) => void
  onSelectProperty?: (shape: NodeShape, property: PropertyShape) => void
  selected?: boolean
  selectedShapeIri?: string | null
  selectedPropertyKey?: string | null
}

export interface InheritedPropertyGroup {
  shape: NodeShape
  label: string
  properties: PropertyShape[]
  children: InheritedPropertyGroup[]
}

interface VisibleShapeNodeDescriptor {
  nodeId: string
  shape: NodeShape
  ownerShapeIri: string
  representedShapeIri: string
}

export function buildEditorShapeNodeId(shapeIri: string): string {
  return `shape:${shapeIri}`
}

export function parseEditorShapeNodeTarget(nodeId: string): { representedShapeIri: string } | null {
  if (!nodeId.startsWith('shape:')) return null
  return { representedShapeIri: nodeId.slice('shape:'.length) }
}

export function collectVisibleShapeNodeDescriptors(
  rootShapes: NodeShape[],
  _allShapes: NodeShape[],
  _expandedShapeNodeIds: Set<string>,
): VisibleShapeNodeDescriptor[] {
  return rootShapes.map(shape => ({
    nodeId: buildEditorShapeNodeId(shape.nodeId.value),
    shape,
    ownerShapeIri: shape.nodeId.value,
    representedShapeIri: shape.nodeId.value,
  }))
}

export function inheritedOriginShapesForRoot(shape: NodeShape, allShapes: NodeShape[]): NodeShape[] {
  return (shape.inheritedShapeIris ?? [])
    .map(iri => allShapes.find(candidate => candidate.nodeId.value === iri))
    .filter((candidate): candidate is NodeShape => candidate !== undefined)
}

export function inheritedPropertyPrefixCount(shape: NodeShape, _allShapes: NodeShape[]): number {
  return shape.properties.filter(property => property.inherited).length
}

export function buildInheritedPropertyGroups(shape: NodeShape, allShapes: NodeShape[]): InheritedPropertyGroup[] {
  return inheritedOriginShapesForRoot(shape, allShapes).map(inheritedShape =>
    buildInheritedPropertyGroup(shape, inheritedShape, allShapes),
  )
}

export function buildOwnProperties(shape: NodeShape, _allShapes: NodeShape[]): PropertyShape[] {
  return shape.properties.filter(property => !property.inherited)
}

function buildInheritedPropertyGroup(rootShape: NodeShape, inheritedShape: NodeShape, allShapes: NodeShape[]): InheritedPropertyGroup {
  return {
    shape: inheritedShape,
    label: inheritedShape.label ?? inheritedShape.nodeId.value,
    properties: rootShape.properties.filter(property => property.inherited && property.inheritedFromShapeIri === inheritedShape.nodeId.value),
    children: inheritedOriginShapesForRoot(inheritedShape, allShapes).map(child =>
      buildInheritedPropertyGroup(rootShape, child, allShapes),
    ),
  }
}
