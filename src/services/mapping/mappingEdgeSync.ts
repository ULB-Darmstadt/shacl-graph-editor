import {
  createTransformMappingEdge,
  mappingTransformNodeId,
  type MappingEdge,
} from '@/domain/Mapping'
import type { TransformationUiEdge } from '@/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/types'

interface UiEdgeLike {
  id: string
  target: string
  targetHandle: string
}

export interface TransformationNodeInputs {
  lat?: TransformationUiEdge
  lng?: TransformationUiEdge
}

export function upsertUiEdge<EdgeType extends UiEdgeLike>(
  edges: EdgeType[],
  edge: EdgeType,
): EdgeType[] {
  const nextEdges = edges.filter(candidate =>
    !(candidate.target === edge.target && candidate.targetHandle === edge.targetHandle),
  )
  nextEdges.push(edge)
  return nextEdges
}

export function removeUiEdgeById<EdgeType extends UiEdgeLike>(
  edges: EdgeType[],
  edgeId: string,
): { nextEdges: EdgeType[]; removed?: EdgeType } {
  const removed = edges.find(edge => edge.id === edgeId)
  return {
    nextEdges: edges.filter(edge => edge.id !== edgeId),
    removed,
  }
}

export interface TransformationMappingInput {
  sourceId: string
  latHeader: string
  lngHeader: string
}

export function getTransformationNodeInputs(
  nodeId: string,
  edges: TransformationUiEdge[],
): TransformationNodeInputs {
  const nodeEdges = edges.filter(edge => edge.target === nodeId)
  return {
    lat: nodeEdges.find(edge => edge.targetHandle === 'lat-input'),
    lng: nodeEdges.find(edge => edge.targetHandle === 'lng-input'),
  }
}

export function getDependentTransformationNodeIds(
  sourceNodeId: string,
  edges: TransformationUiEdge[],
): string[] {
  return [...new Set(
    edges
      .filter(edge => edge.source === sourceNodeId && edge.target.startsWith('transform:'))
      .map(edge => edge.target),
  )]
}

export function resolveTransformationMappingInput(
  nodeId: string,
  edges: TransformationUiEdge[],
  resolveNodeOutputSource: (nodeId: string) => string | undefined,
): TransformationMappingInput | undefined {
  const { lat, lng } = getTransformationNodeInputs(nodeId, edges)
  const hasMatchingInputs = Boolean(
    lat && lng
    && lat.source === lng.source
    && lat.sourceHandle.startsWith('h:')
    && lng.sourceHandle.startsWith('h:'),
  )

  if (!hasMatchingInputs) return undefined

  if (lat!.source.startsWith('src:')) {
    return {
      sourceId: lat!.source.slice(4),
      latHeader: lat!.sourceHandle.slice(2),
      lngHeader: lng!.sourceHandle.slice(2),
    }
  }

  const sourceId = resolveNodeOutputSource(lat!.source)
  if (!sourceId) return undefined

  return {
    sourceId,
    latHeader: lat!.sourceHandle.slice(2),
    lngHeader: lng!.sourceHandle.slice(2),
  }
}

export function syncTransformationNodeMappings(
  existingEdges: MappingEdge[],
  nodeId: string,
  input: TransformationMappingInput | undefined,
  transformId: string,
): MappingEdge[] {
  if (!input) {
    return existingEdges.filter(edge => mappingTransformNodeId(edge) !== nodeId)
  }

  return existingEdges.map(edge => mappingTransformNodeId(edge) !== nodeId
    ? edge
    : createTransformMappingEdge({
        ...edge,
        sourceId: input.sourceId,
        sourceHeader: input.latHeader,
      }, {
        nodeId,
        transformId,
        secondarySourceHeader: input.lngHeader,
      }))
}


