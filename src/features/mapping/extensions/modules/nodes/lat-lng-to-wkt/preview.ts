import type { DataSource } from '@/domain/DataSource'
import { mappingSecondarySourceHeader, mappingTransformId, mappingTransformNodeId } from '@/domain/Mapping'
import type { MappingNodePreviewContext } from '@/features/mapping/extensions/core/types'
import { resolveMaterializedNodeOutputSource } from '@/features/mapping/mappingExtensionRegistry'
import { LAT_LNG_TO_WKT_TRANSFORM_ID } from '@/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/state'

function resolveUpstreamOutputSource(
  nodeId: string,
  context: Pick<MappingNodePreviewContext, 'dataStore' | 'mappingStore' | 'sources'>,
): string | undefined {
  return resolveMaterializedNodeOutputSource(nodeId, {
    dataStore: context.dataStore,
    mappingStore: context.mappingStore,
    sources: context.sources,
  })
}

function buildInputPreviewSource(
  nodeId: string,
  name: string,
  source: DataSource,
  latHeader: string,
  lngHeader: string,
): DataSource | null {
  const latIdx = source.headers.indexOf(latHeader)
  const lngIdx = source.headers.indexOf(lngHeader)
  if (latIdx < 0 || lngIdx < 0) return null

  return {
    id: `${nodeId}:input-preview`,
    name,
    kind: 'tabular',
    role: 'derived',
    origin: { kind: 'generated', provider: LAT_LNG_TO_WKT_TRANSFORM_ID },
    headers: [latHeader, lngHeader],
    rows: source.rows.map(row => [row[latIdx], row[lngIdx]]),
  }
}

function buildOutputPreviewSource(nodeId: string, source: DataSource, latHeader: string, lngHeader: string): DataSource | null {
  const latIdx = source.headers.indexOf(latHeader)
  const lngIdx = source.headers.indexOf(lngHeader)
  if (latIdx < 0 || lngIdx < 0) return null

  return {
    id: `${nodeId}:output-preview`,
    name: 'WKT output',
    kind: 'tabular',
    role: 'derived',
    origin: { kind: 'generated', provider: LAT_LNG_TO_WKT_TRANSFORM_ID },
    headers: ['wkt'],
    rows: source.rows.map(row => {
      const lat = Number.parseFloat(String(row[latIdx] ?? '').trim())
      const lng = Number.parseFloat(String(row[lngIdx] ?? '').trim())
      return [Number.isFinite(lat) && Number.isFinite(lng) ? `POINT(${lng} ${lat})` : '']
    }),
  }
}

export function previewLatLngToWktNode(nodeId: string, context: MappingNodePreviewContext): void {
  const inputs = context.mappingStore.transformationInputsForNode(nodeId)
  let inputSource: DataSource | null = null
  let outputSource: DataSource | null = null

  if (inputs.lat?.source.startsWith('src:') && inputs.lng?.source.startsWith('src:') && inputs.lat.source === inputs.lng.source) {
    const baseSource = context.dataStore.findById(inputs.lat.source.slice(4))
    if (baseSource) {
      const latHeader = inputs.lat.sourceHandle.startsWith('h:') ? inputs.lat.sourceHandle.slice(2) : ''
      const lngHeader = inputs.lng.sourceHandle.startsWith('h:') ? inputs.lng.sourceHandle.slice(2) : ''
      inputSource = buildInputPreviewSource(nodeId, `${baseSource.name} · lat/lng`, baseSource, latHeader, lngHeader)
    }
  }

  if (inputs.lat?.source.startsWith('geonames:') && inputs.lng?.source.startsWith('geonames:') && inputs.lat.source === inputs.lng.source) {
    const geoSourceId = resolveUpstreamOutputSource(inputs.lat.source, context)
    if (geoSourceId) {
      const geoSource = context.dataStore.findById(geoSourceId)
      if (geoSource) {
        const latHeader = inputs.lat.sourceHandle.startsWith('h:') ? inputs.lat.sourceHandle.slice(2) : ''
        const lngHeader = inputs.lng.sourceHandle.startsWith('h:') ? inputs.lng.sourceHandle.slice(2) : ''
        inputSource = buildInputPreviewSource(nodeId, 'GeoNames output · lat/lng', geoSource, latHeader, lngHeader)
      }
    }
  }

  const transformEdge = context.mappingStore.state.edges.find(edge =>
    mappingTransformNodeId(edge) === nodeId
    && mappingTransformId(edge) === LAT_LNG_TO_WKT_TRANSFORM_ID)
  if (transformEdge) {
    const baseSource = context.dataStore.findById(transformEdge.sourceId)
    if (baseSource) {
      const secondaryHeader = mappingSecondarySourceHeader(transformEdge)
      if (secondaryHeader) {
        outputSource = buildOutputPreviewSource(nodeId, baseSource, transformEdge.sourceHeader, secondaryHeader)
      }
    }
  }

  context.openPairedSourcePreview(inputSource, outputSource)
}
