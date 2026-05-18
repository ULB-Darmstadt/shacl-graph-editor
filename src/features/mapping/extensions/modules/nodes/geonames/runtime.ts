import type { DataSource } from '@/domain/DataSource'
import {
  alignedRecordIdsForSource,
  buildEnrichmentOutputRows,
  resolveConnectedSourceColumn,
} from '@/services/mapping/enrichmentRuntime'
import { fetchGeoNameFeatures, type GeoNameFeature, type GeoNamesOutputField } from '@/features/mapping/extensions/modules/nodes/geonames/client'

export interface GeoNamesRuntimeResult {
  inputSourceId: string
  inputHeader: string
  outputSourceId: string
  results: Record<string, GeoNameFeature>
  totalCount: number
  processedCount: number
  cachedCount: number
}

export async function runGeoNamesRuntime(options: {
  nodeId: string
  username: string
  selectedOutputs: GeoNamesOutputField[]
  inputSourceId: string
  inputHeader: string
  sources: DataSource[]
  forceRefresh?: boolean
  onProgress?: (progress: { processedCount: number; totalCount: number; cachedCount: number }) => void
  addResultSource: (nodeId: string, headers: string[], rows: unknown[][], recordIds?: string[]) => string
}): Promise<GeoNamesRuntimeResult> {
  const connectedInput = resolveConnectedSourceColumn(
    options.sources,
    options.inputSourceId,
    options.inputHeader,
    'The connected source column does not contain any GeoNames IDs.',
  )

  const batch = await fetchGeoNameFeatures(connectedInput.values, options.username, {
    forceRefresh: options.forceRefresh,
    onProgress: progress => {
      options.onProgress?.({
        processedCount: progress.processedCount,
        totalCount: progress.totalCount,
        cachedCount: progress.cachedCount,
      })
    },
  })

  const outputRows = buildEnrichmentOutputRows(
    connectedInput.source,
    connectedInput.headerIndex,
    batch.results,
    options.selectedOutputs,
    (feature, output) => feature?.[output as GeoNamesOutputField] ?? '',
  )
  const alignedRecordIds = alignedRecordIdsForSource(connectedInput.source)
  const outputSourceId = options.addResultSource(options.nodeId, [...options.selectedOutputs], outputRows, alignedRecordIds)

  return {
    inputSourceId: connectedInput.source.id,
    inputHeader: connectedInput.sourceHeader,
    outputSourceId,
    results: batch.results,
    totalCount: batch.totalCount,
    processedCount: batch.processedCount,
    cachedCount: batch.cachedCount,
  }
}
