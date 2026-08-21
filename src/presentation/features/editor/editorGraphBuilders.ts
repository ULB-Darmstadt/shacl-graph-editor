import type { Edge, Node } from '@vue-flow/core'
import type { NodeShape, PropertyShape } from '@/domain/profiles'
import { applyDefaultEditorEdgeStyle, propertyRelationshipLabel, type EditorEdgeKind } from '@/presentation/features/editor/editorEdgeLabels'
import { EDITOR_EDGE_STYLES } from '@/presentation/features/editor/editorGraphTheme'
import {
  buildEditorShapeNodeId,
  buildEditorQualifiedProxyNodeId,
  buildInheritedPropertyGroups,
  buildOwnProperties,
  collectReachableShapeIris,
  collectVisibleShapeNodeDescriptors,
  inheritedOriginShapesForRoot,
  inheritedPropertyPrefixCount,
  parseEditorShapeNodeTarget,
  propertyGraphTargetIris,
  type ShapeEditorNodeData,
} from '@/presentation/features/editor/inheritanceEditorGraph'
import type { EditorReviewSeverity } from '@/presentation/features/editor/editorReview'

export interface EditorShapeReviewAnnotation {
  shapeSeverity?: EditorReviewSeverity | null
  propertySeverities?: Record<string, EditorReviewSeverity>
}

function reviewAnnotationsRecord(
  annotations: Map<string, EditorShapeReviewAnnotation> | undefined,
): Record<string, EditorShapeReviewAnnotation> {
  return Object.fromEntries(annotations?.entries() ?? [])
}

export function buildEditorShapeNodes(
  rootShapes: NodeShape[],
  allShapes: NodeShape[],
  expandedShapeNodeIds: Set<string>,
  openShapePreview: (shape: NodeShape) => void | Promise<void>,
  interactive: boolean,
  addField?: (shapeIri: string) => void,
  selectShape?: (shape: NodeShape) => void,
  selectProperty?: (shape: NodeShape, property: PropertyShape) => void,
  renameShape?: (shapeIri: string, label: string) => void,
  renameProperty?: (shapeIri: string, propertyNodeId: string, name: string) => void,
  commitDraftProperty?: (propertyNodeId: string) => void,
  deleteProperty?: (shapeIri: string, propertyNodeId: string) => boolean,
  openShapeHeaderMenu?: (shape: NodeShape, event: MouseEvent, options?: { allowDelete?: boolean }) => void,
  moveProperty?: (sourceShapeIri: string, propertyNodeId: string, targetShapeIri: string, targetIndex?: number) => boolean,
  selectedShapeIri?: string | null,
  selectedPropertyKey?: string | null,
  draftPropertyNodeId?: string | null,
  reviewMode = false,
  reviewAnnotations?: Map<string, EditorShapeReviewAnnotation>,
): Node[] {
  const descriptors = collectVisibleShapeNodeDescriptors(rootShapes, allShapes, expandedShapeNodeIds)
  const reviewAnnotationsByShape = reviewAnnotationsRecord(reviewAnnotations)

  return descriptors.map(descriptor => ({
    id: descriptor.nodeId,
    type: 'shapeNode',
    position: { x: 0, y: 0 },
    data: {
      shape: descriptor.shape,
      ownerShapeIri: descriptor.ownerShapeIri,
      representedShapeIri: descriptor.representedShapeIri,
      inheritedOriginShapes: inheritedOriginShapesForRoot(descriptor.shape, allShapes),
      inheritedPropertyCount: inheritedPropertyPrefixCount(descriptor.shape, allShapes),
      inheritedGroups: buildInheritedPropertyGroups(descriptor.shape, allShapes),
      ownProperties: buildOwnProperties(descriptor.shape, allShapes),
      interactive,
      onPreview: () => openShapePreview(descriptor.shape),
      onAddField: interactive && addField
        ? (shapeIri: string) => addField(shapeIri)
        : undefined,
      onSelectShape: selectShape,
      onSelectProperty: selectProperty,
      onRenameShape: interactive ? renameShape : undefined,
      onRenameProperty: interactive ? renameProperty : undefined,
      onCommitDraftProperty: interactive ? commitDraftProperty : undefined,
      onDeleteProperty: interactive ? deleteProperty : undefined,
      onShapeHeaderContextMenu: interactive ? openShapeHeaderMenu : undefined,
      onMoveProperty: interactive ? moveProperty : undefined,
      selected: descriptor.representedShapeIri === selectedShapeIri,
      selectedShapeIri: selectedShapeIri ?? null,
      selectedPropertyKey: descriptor.representedShapeIri === selectedShapeIri ? selectedPropertyKey ?? null : null,
      draftPropertyNodeId: draftPropertyNodeId ?? null,
      reviewMode,
      reviewShapeSeverity: reviewAnnotations?.get(descriptor.representedShapeIri)?.shapeSeverity ?? null,
      reviewPropertySeverities: reviewAnnotations?.get(descriptor.representedShapeIri)?.propertySeverities ?? {},
      reviewAnnotationsByShape,
    } satisfies ShapeEditorNodeData,
  }))
}

export function buildEditorStructuralEdges(
  rootShapes: NodeShape[],
  allShapes: NodeShape[] = rootShapes,
  visibleNodeIds?: Set<string>,
  onRemoveReferenceEdge?: (shapeIri: string, propertyNodeId: string, targetShapeIri: string) => void,
  selectedShapeIri?: string | null,
  selectedPropertyKey?: string | null,
): Edge[] {
  return buildShapeReferenceEdges(rootShapes, allShapes, visibleNodeIds, onRemoveReferenceEdge, selectedShapeIri, selectedPropertyKey)
}

function buildShapeReferenceEdges(
  rootShapes: NodeShape[],
  allShapes: NodeShape[],
  visibleNodeIds?: Set<string>,
  onRemoveReferenceEdge?: (shapeIri: string, propertyNodeId: string, targetShapeIri: string) => void,
  selectedShapeIri?: string | null,
  selectedPropertyKey?: string | null,
): Edge[] {
  const edges: Edge[] = []
  const reachableShapeIris = collectReachableShapeIris(rootShapes, allShapes)
  const reachableShapes = reachableShapeIris
    .map(shapeIri => allShapes.find(shape => shape.nodeId.value === shapeIri))
    .filter((shape): shape is NodeShape => shape !== undefined)

  for (const shape of reachableShapes) {
    for (const property of shape.properties) {
      const targetIris = propertyGraphTargetIris(property, allShapes)
      if (targetIris.length === 0) continue
      const source = findVisibleShapeNodeId(shape.nodeId.value, visibleNodeIds, allShapes)
      for (const targetIri of targetIris) {
        const target = findVisibleShapeNodeId(targetIri, visibleNodeIds, allShapes)
        if (!source || !target) continue
        const isSelectedOutgoingProperty = selectedShapeIri === shape.nodeId.value && selectedPropertyKey === property.nodeId.value
        const isSelectedIncomingShape = selectedShapeIri === targetIri && !selectedPropertyKey
        const isSelectedEdge = isSelectedOutgoingProperty || isSelectedIncomingShape
        edges.push({
          id: `ref:${shape.nodeId.value}::${property.nodeId.value}->${targetIri}`,
          source,
          sourceHandle: `ref:${property.nodeId.value}`,
          target,
          targetHandle: 'shape-header',
          label: propertyRelationshipLabel(property),
          type: 'default',
          animated: false,
          style: isSelectedEdge ? EDITOR_EDGE_STYLES.selected : EDITOR_EDGE_STYLES.structural,
          data: {
            relationLabel: propertyRelationshipLabel(property),
            edgeKind: 'structural' satisfies EditorEdgeKind,
            selected: isSelectedEdge,
            onRemove: onRemoveReferenceEdge
              ? () => onRemoveReferenceEdge(shape.nodeId.value, property.nodeId.value, targetIri)
              : undefined,
          },
        })
      }
    }
  }

  return edges
}

export function preserveEditorNodePositions(
  existingNodes: Node[],
  nextNodes: Node[],
  positionForNewNode: (node: Node, index: number) => Node['position'],
): Node[] {
  const existingNodesById = new Map<string, Node & { dimensions?: { width?: number; height?: number } }>()
  const existingNodesByShapeIri = new Map<string, Node & { dimensions?: { width?: number; height?: number } }>()
  for (const node of existingNodes) {
    const typedNode = node as Node & { dimensions?: { width?: number; height?: number } }
    existingNodesById.set(node.id, typedNode)

    const representedShapeIri = representedShapeIriFromNode(node)
    if (representedShapeIri && !existingNodesByShapeIri.has(representedShapeIri)) {
      existingNodesByShapeIri.set(representedShapeIri, typedNode)
    }
  }

  return nextNodes.map((node, index) => {
    const existingNode = existingNodesById.get(node.id)
      ?? (representedShapeIriFromNode(node)
        ? existingNodesByShapeIri.get(representedShapeIriFromNode(node) as string)
        : undefined)

    return {
      ...node,
      ...(existingNode?.dimensions ? { dimensions: existingNode.dimensions } : {}),
      position: existingNode?.position ?? positionForNewNode(node, index),
    }
  })
}

export function shouldAutoLayoutEditorGraph(existingNodes: Node[], nextNodes: Node[]): boolean {
  if (existingNodes.length === 0) return nextNodes.length > 0

  const existingIds = new Set(existingNodes.map(node => node.id))
  const existingShapeIris = new Set(existingNodes.map(representedShapeIriFromNode).filter((value): value is string => Boolean(value)))

  return nextNodes.some(node => {
    if (existingIds.has(node.id)) return false
    const representedShapeIri = representedShapeIriFromNode(node)
    return !representedShapeIri || !existingShapeIris.has(representedShapeIri)
  })
}

function representedShapeIriFromNode(node: Node): string | null {
  const data = node.data as { representedShapeIri?: unknown } | undefined
  return typeof data?.representedShapeIri === 'string' ? data.representedShapeIri : null
}

function findVisibleShapeNodeId(shapeIri: string, visibleNodeIds: Set<string> | undefined, allShapes: NodeShape[]): string | null {
  if (!visibleNodeIds || visibleNodeIds.size === 0) return buildEditorShapeNodeId(shapeIri)

  const preferredNodeId = buildEditorShapeNodeId(shapeIri)
  if (visibleNodeIds.has(preferredNodeId)) return preferredNodeId

  for (const nodeId of visibleNodeIds) {
    const target = parseEditorShapeNodeTarget(nodeId)
    if (target?.representedShapeIri === shapeIri) return nodeId
  }

  const visibleSpecializations = [...visibleNodeIds].filter(nodeId => {
    const target = parseEditorShapeNodeTarget(nodeId)
    if (!target?.representedShapeIri) return false
    return shapeInheritsFrom(target.representedShapeIri, shapeIri, allShapes)
  })

  if (visibleSpecializations.length === 1) return visibleSpecializations[0]

  return null
}

function shapeInheritsFrom(shapeIri: string, ancestorIri: string, allShapes: NodeShape[], visited = new Set<string>()): boolean {
  if (shapeIri === ancestorIri) return true
  if (visited.has(shapeIri)) return false

  const shape = allShapes.find(candidate => candidate.nodeId.value === shapeIri)
  if (!shape) return false

  const nextVisited = new Set(visited)
  nextVisited.add(shapeIri)

  return (shape.inheritedShapeIris ?? []).some(inheritedIri =>
    inheritedIri === ancestorIri || shapeInheritsFrom(inheritedIri, ancestorIri, allShapes, nextVisited),
  )
}

export {
  applyDefaultEditorEdgeStyle,
  buildEditorShapeNodeId,
  buildEditorQualifiedProxyNodeId,
  parseEditorShapeNodeTarget,
  representedShapeIriFromNode,
}
export type { ShapeEditorNodeData }
