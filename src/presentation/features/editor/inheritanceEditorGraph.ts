import type { NodeShape, PropertyShape } from '@/domain/profiles'
import { propertyNodeTargets } from '@/domain/profiles'

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
  onAddField?: (shapeIri: string) => void
  onSelectShape?: (shape: NodeShape) => void
  onSelectProperty?: (shape: NodeShape, property: PropertyShape) => void
  onRenameShape?: (shapeIri: string, label: string) => void
  onRenameProperty?: (shapeIri: string, propertyNodeId: string, name: string) => void
  onCommitDraftProperty?: (propertyNodeId: string) => void
  onDeleteProperty?: (shapeIri: string, propertyNodeId: string) => boolean
  onShapeHeaderContextMenu?: (shape: NodeShape, event: MouseEvent, options?: { allowDelete?: boolean }) => void
  onMoveProperty?: (sourceShapeIri: string, propertyNodeId: string, targetShapeIri: string, targetIndex?: number) => boolean
  selected?: boolean
  highlighted?: boolean
  selectedShapeIri?: string | null
  selectedPropertyKey?: string | null
  draftPropertyNodeId?: string | null
  reviewMode?: boolean
  reviewShapeSeverity?: 'urgent' | 'warning' | null
  reviewPropertySeverities?: Record<string, 'urgent' | 'warning'>
  reviewAnnotationsByShape?: Record<string, {
    shapeSeverity?: 'urgent' | 'warning' | null
    propertySeverities?: Record<string, 'urgent' | 'warning'>
  }>
  showClassRelations?: boolean
  showBlankNodeRelations?: boolean
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

export function collectReachableShapeIris(
  rootShapes: NodeShape[],
  allShapes: NodeShape[],
  includeClassRelations = false,
  includeBlankNodeRelations = false,
): string[] {
  const allShapesByIri = new Map(allShapes.map(shape => [shape.nodeId.value, shape]))
  const queue = rootShapes.map(shape => shape.nodeId.value)
  const visited = new Set<string>()
  const ordered: string[] = []

  while (queue.length > 0) {
    const shapeIri = queue.shift()
    if (!shapeIri || visited.has(shapeIri)) continue

    visited.add(shapeIri)
    ordered.push(shapeIri)

    const shape = allShapesByIri.get(shapeIri)
    if (!shape) continue

    for (const property of shape.properties) {
      for (const targetIri of propertyGraphTargetIris(property, allShapes, includeClassRelations, includeBlankNodeRelations)) {
        if (visited.has(targetIri)) continue
        if (!allShapesByIri.has(targetIri)) continue
        queue.push(targetIri)
      }
    }
  }

  return ordered
}

export function buildEditorShapeNodeId(shapeIri: string): string {
  return `shape:${shapeIri}`
}

export function buildEditorQualifiedProxyNodeId(shapeIri: string): string {
  return `shape-proxy:${shapeIri}`
}

export function parseEditorShapeNodeTarget(nodeId: string): { representedShapeIri: string; proxy: boolean } | null {
  if (nodeId.startsWith('shape-proxy:')) {
    return { representedShapeIri: nodeId.slice('shape-proxy:'.length), proxy: true }
  }
  if (nodeId.startsWith('shape:')) {
    return { representedShapeIri: nodeId.slice('shape:'.length), proxy: false }
  }
  return null
}

export function collectVisibleShapeNodeDescriptors(
  rootShapes: NodeShape[],
  allShapes: NodeShape[],
  _expandedShapeNodeIds: Set<string>,
  includeClassRelations = false,
  includeBlankNodeRelations = false,
): VisibleShapeNodeDescriptor[] {
  const reachableShapeIris = collectReachableShapeIris(rootShapes, allShapes, includeClassRelations, includeBlankNodeRelations)
  const rootShapeIris = new Set(rootShapes.map(shape => shape.nodeId.value))
  const allShapesByIri = new Map(allShapes.map(shape => [shape.nodeId.value, shape]))

  const descriptors = rootShapes.map(shape => ({
    nodeId: buildEditorShapeNodeId(shape.nodeId.value),
    shape,
    ownerShapeIri: shape.nodeId.value,
    representedShapeIri: shape.nodeId.value,
  }))

  for (const targetIri of reachableShapeIris) {
    if (rootShapeIris.has(targetIri)) continue
    const targetShape = allShapesByIri.get(targetIri)
    if (!targetShape) continue
    descriptors.push({
      nodeId: buildEditorQualifiedProxyNodeId(targetIri),
      shape: targetShape,
      ownerShapeIri: targetShape.nodeId.value,
      representedShapeIri: targetShape.nodeId.value,
    })
  }

  return descriptors
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

export function propertyClassTargetIris(property: PropertyShape, allShapes: NodeShape[]): string[] {
  if (!property.cls?.value) return []

  const matchingShapes = allShapes.filter(shape => shape.targetClass?.value === property.cls?.value)
  return matchingShapes.length === 1 ? [matchingShapes[0].nodeId.value] : []
}

export function propertyGraphTargetIris(
  property: PropertyShape,
  allShapes: NodeShape[],
  includeClassRelations = false,
  includeBlankNodeRelations = false,
): string[] {
  const targets = new Set(propertyNodeTargets(property).map(target => target.value))

  if (property.qualifiedValueShape?.inlineNodeShape && !includeBlankNodeRelations) {
    const qualifiedTarget = property.qualifiedValueShape.node?.value
    if (qualifiedTarget && property.node?.value !== qualifiedTarget) targets.delete(qualifiedTarget)
  }

  if (includeClassRelations) {
    for (const targetIri of propertyClassTargetIris(property, allShapes)) targets.add(targetIri)
  }

  return [...targets]
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
