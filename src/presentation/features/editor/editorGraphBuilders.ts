import type { Edge, Node } from '@vue-flow/core'
import { propertyNodeTargets, type NodeShape, type PropertyShape } from '@/domain/profiles'
import { applyDefaultEditorEdgeStyle, propertyRelationshipLabel, type EditorEdgeKind } from '@/presentation/features/editor/editorEdgeLabels'
import { EDITOR_EDGE_STYLES } from '@/presentation/features/editor/editorGraphTheme'
import {
  buildEditorShapeNodeId,
  buildInheritedPropertyGroups,
  buildOwnProperties,
  collectVisibleShapeNodeDescriptors,
  inheritedOriginShapesForRoot,
  inheritedPropertyPrefixCount,
  parseEditorShapeNodeTarget,
  type ShapeEditorNodeData,
} from '@/presentation/features/editor/inheritanceEditorGraph'

export function buildEditorShapeNodes(
  rootShapes: NodeShape[],
  allShapes: NodeShape[],
  expandedShapeNodeIds: Set<string>,
  openShapePreview: (shape: NodeShape) => void | Promise<void>,
  addField?: (shapeIri: string) => void,
  selectShape?: (shape: NodeShape) => void,
  selectProperty?: (shape: NodeShape, property: PropertyShape) => void,
  selectedShapeIri?: string | null,
  selectedPropertyKey?: string | null,
): Node[] {
  const descriptors = collectVisibleShapeNodeDescriptors(rootShapes, allShapes, expandedShapeNodeIds)

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
      interactive: true,
      onPreview: () => openShapePreview(descriptor.shape),
      onAddField: addField ? () => addField(descriptor.shape.nodeId.value) : undefined,
      onSelectShape: selectShape,
      onSelectProperty: selectProperty,
      selected: descriptor.shape.nodeId.value === selectedShapeIri,
      selectedShapeIri: selectedShapeIri ?? null,
      selectedPropertyKey: descriptor.shape.nodeId.value === selectedShapeIri ? selectedPropertyKey ?? null : null,
    } satisfies ShapeEditorNodeData,
  }))
}

export function buildEditorStructuralEdges(
  rootShapes: NodeShape[],
  allShapes: NodeShape[] = rootShapes,
  visibleNodeIds?: Set<string>,
  onRemoveReferenceEdge?: (shapeIri: string, propertyNodeId: string, targetShapeIri: string) => void,
): Edge[] {
  return buildShapeReferenceEdges(rootShapes, allShapes, visibleNodeIds, onRemoveReferenceEdge)
}

function buildShapeReferenceEdges(
  rootShapes: NodeShape[],
  allShapes: NodeShape[],
  visibleNodeIds?: Set<string>,
  onRemoveReferenceEdge?: (shapeIri: string, propertyNodeId: string, targetShapeIri: string) => void,
): Edge[] {
  const edges: Edge[] = []

  for (const shape of rootShapes) {
    for (const property of shape.properties) {
      const targetNodes = propertyNodeTargets(property)
      if (targetNodes.length === 0) continue
      const source = buildEditorShapeNodeId(shape.nodeId.value)
      for (const targetNode of targetNodes) {
        const target = findVisibleShapeNodeId(targetNode.value, visibleNodeIds)
        if (!source || !target) continue
        edges.push({
          id: `ref:${shape.nodeId.value}::${property.nodeId.value}->${targetNode.value}`,
          source,
          sourceHandle: `ref:${property.nodeId.value}`,
          target,
          targetHandle: 'shape-header',
          label: propertyRelationshipLabel(property),
          type: 'default',
          animated: false,
          style: EDITOR_EDGE_STYLES.structural,
          data: {
            relationLabel: propertyRelationshipLabel(property),
            edgeKind: 'structural' satisfies EditorEdgeKind,
            onRemove: onRemoveReferenceEdge
              ? () => onRemoveReferenceEdge(shape.nodeId.value, property.nodeId.value, targetNode.value)
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
  const existingPositions = new Map<string, Node['position']>()
  for (const node of existingNodes) {
    existingPositions.set(node.id, node.position)
  }

  return nextNodes.map((node, index) => ({
    ...node,
    position: existingPositions.get(node.id) ?? positionForNewNode(node, index),
  }))
}

export function shouldAutoLayoutEditorGraph(existingNodes: Node[], nextNodes: Node[]): boolean {
  if (existingNodes.length === 0) return nextNodes.length > 0

  const existingIds = new Set(existingNodes.map(node => node.id))
  return nextNodes.some(node => !existingIds.has(node.id))
}

function findVisibleShapeNodeId(shapeIri: string, visibleNodeIds?: Set<string>): string | null {
  if (!visibleNodeIds || visibleNodeIds.size === 0) return buildEditorShapeNodeId(shapeIri)

  const preferredNodeId = buildEditorShapeNodeId(shapeIri)
  if (visibleNodeIds.has(preferredNodeId)) return preferredNodeId

  for (const nodeId of visibleNodeIds) {
    const target = parseEditorShapeNodeTarget(nodeId)
    if (target?.representedShapeIri === shapeIri) return nodeId
  }

  return null
}

export {
  applyDefaultEditorEdgeStyle,
  buildEditorShapeNodeId,
  parseEditorShapeNodeTarget,
}
export type { ShapeEditorNodeData }
