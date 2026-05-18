import { createEnrichmentMappingEdge, mappingEnrichmentNodeId, type MappingEdge } from '@/domain/Mapping'
import type { GeoNamesNodeConfig, GeoNamesUiEdge } from '@/features/mapping/extensions/modules/nodes/geonames/types'

export function applyGeoNamesNodePatch(
  node: GeoNamesNodeConfig,
  patch: Partial<Omit<GeoNamesNodeConfig, 'id'>>,
  edges: GeoNamesUiEdge[],
): { nextNode: GeoNamesNodeConfig; nextEdges: GeoNamesUiEdge[] } {
  const nextNode: GeoNamesNodeConfig = {
    ...node,
    ...patch,
    stats: patch.stats ? { ...node.stats, ...patch.stats } : node.stats,
  }

  if (!patch.selectedOutputs) {
    return { nextNode, nextEdges: edges }
  }

  return {
    nextNode,
    nextEdges: edges.filter(edge =>
      edge.source !== node.id
      || !edge.sourceHandle.startsWith('h:')
      || patch.selectedOutputs?.includes(edge.sourceHandle.slice(2) as GeoNamesNodeConfig['selectedOutputs'][number]),
    ),
  }
}

export function buildGeoNamesShapeMappings(
  nodeId: string,
  outputSourceId: string | undefined,
  edges: GeoNamesUiEdge[],
): MappingEdge[] {
  if (!outputSourceId) return []

  return edges
    .filter(edge =>
      edge.source === nodeId
      && edge.sourceHandle.startsWith('h:')
      && edge.target.startsWith('shape:')
      && edge.targetHandle.startsWith('p:'),
    )
    .map(edge => createEnrichmentMappingEdge({
      sourceId: outputSourceId,
      sourceHeader: edge.sourceHandle.slice(2),
      shapeIri: edge.target.slice(6),
      propertyPath: edge.targetHandle.slice(2),
    }, { provider: 'geonames', nodeId }))
}

export function syncGeoNamesNodeMappings(
  existingEdges: MappingEdge[],
  nodeId: string,
  outputSourceId: string | undefined,
  uiEdges: GeoNamesUiEdge[],
): MappingEdge[] {
  return [
    ...existingEdges.filter(edge => mappingEnrichmentNodeId(edge, 'geonames') !== nodeId),
    ...buildGeoNamesShapeMappings(nodeId, outputSourceId, uiEdges),
  ]
}
