import type { Connection } from '@vue-flow/core'
import type { MappingConnectionContext } from '@/features/mapping/extensions/core/types'
import { resolveMaterializedNodeOutputSource } from '@/features/mapping/mappingExtensionRegistry'
import {
  LAT_LNG_TO_WKT_TRANSFORM_ID,
  TRANSFORMATION_UI_EDGE_STATE_KEY,
} from '@/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/state'

function resolveUpstreamOutputSource(connectionSource: string, context: MappingConnectionContext): string | undefined {
  return resolveMaterializedNodeOutputSource(connectionSource, {
    dataStore: context.dataStore,
    mappingStore: context.mappingStore,
    sources: context.sources,
  })
}

export function connectLatLngToWktNode(connection: Connection, context: MappingConnectionContext): boolean {
  const sourceHandle = connection.sourceHandle ?? ''
  const targetHandle = connection.targetHandle ?? ''

  if ((connection.source?.startsWith('src:') || connection.source?.startsWith('geonames:')) && connection.target?.startsWith('transform:')) {
    if (!sourceHandle.startsWith('h:') || !['lat-input', 'lng-input'].includes(targetHandle)) return false
    context.mappingStore.upsertExtensionUiEdge(TRANSFORMATION_UI_EDGE_STATE_KEY, {
      id: `transform-ui:${connection.target}:${targetHandle}`,
      source: connection.source,
      sourceHandle,
      target: connection.target,
      targetHandle,
    })
    return true
  }

  if (connection.source?.startsWith('transform:') && connection.target?.startsWith('shape:')) {
    if (sourceHandle !== 'h:wkt' || !targetHandle.startsWith('p:')) return false

    const shapeIri = connection.target.slice(6)
    const propertyPath = targetHandle.slice(2)
    const inputs = context.mappingStore.transformationInputsForNode(connection.source)
    if (!inputs.lat || !inputs.lng) {
      context.toast.add({
        severity: 'warn',
        summary: 'WKT transform incomplete',
        detail: 'Connect both lat and lng before mapping the WKT output.',
        life: 4000,
      })
      return true
    }
    if (inputs.lat.source !== inputs.lng.source) {
      context.toast.add({
        severity: 'error',
        summary: 'WKT transform invalid',
        detail: 'Lat and lng must come from the same source table.',
        life: 5000,
      })
      return true
    }

    if (inputs.lat.source.startsWith('geonames:')) {
      const materializedSourceId = resolveUpstreamOutputSource(inputs.lat.source, context)
      if (!materializedSourceId) {
        context.toast.add({
          severity: 'warn',
          summary: 'Run GeoNames first',
          detail: 'Execute the GeoNames node once so its lat/lng outputs are available for the WKT transform.',
          life: 4500,
        })
        return true
      }
    }

    context.mappingStore.set({
      sourceId: inputs.lat.source.startsWith('src:')
        ? inputs.lat.source.slice(4)
        : (resolveUpstreamOutputSource(inputs.lat.source, context) ?? ''),
      sourceHeader: inputs.lat.sourceHandle.slice(2),
      secondarySourceHeader: inputs.lng.sourceHandle.slice(2),
      shapeIri,
      propertyPath,
      transform: LAT_LNG_TO_WKT_TRANSFORM_ID,
      transformNodeId: connection.source,
    })
    return true
  }

  return false
}

export function deleteLatLngToWktUiEdge(edgeId: string, context: MappingConnectionContext): boolean {
  if (!edgeId.startsWith('transform-ui:')) return false
  context.mappingStore.removeExtensionUiEdge(TRANSFORMATION_UI_EDGE_STATE_KEY, edgeId)
  return true
}
