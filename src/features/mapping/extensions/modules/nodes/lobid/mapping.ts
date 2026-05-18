import { createEnrichmentMappingEdge, mappingEnrichmentNodeId, type MappingEdge } from '@/domain/Mapping'
import type { LobidNodeConfig, LobidUiEdge } from '@/features/mapping/extensions/modules/nodes/lobid/types'

export function applyLobidNodePatch(
  node: LobidNodeConfig,
  patch: Partial<Omit<LobidNodeConfig, 'id'>>,
  edges: LobidUiEdge[],
): { nextNode: LobidNodeConfig; nextEdges: LobidUiEdge[] } {
  const nextNode: LobidNodeConfig = {
    ...node,
    ...patch,
    stats: patch.stats ? { ...node.stats, ...patch.stats } : node.stats,
  }

  if (!patch.selectedProperties) {
    return { nextNode, nextEdges: edges }
  }

  return {
    nextNode,
    nextEdges: edges.filter(edge =>
      edge.source !== node.id
      || !edge.sourceHandle.startsWith('h:')
      || patch.selectedProperties?.includes(edge.sourceHandle.slice(2)),
    ),
  }
}

export function buildLobidShapeMappings(
  nodeId: string,
  outputSourceId: string | undefined,
  edges: LobidUiEdge[],
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
    }, { provider: 'lobid', nodeId }))
}

export function syncLobidNodeMappings(
  existingEdges: MappingEdge[],
  nodeId: string,
  outputSourceId: string | undefined,
  uiEdges: LobidUiEdge[],
): MappingEdge[] {
  return [
    ...existingEdges.filter(edge => mappingEnrichmentNodeId(edge, 'lobid') !== nodeId),
    ...buildLobidShapeMappings(nodeId, outputSourceId, uiEdges),
  ]
}
