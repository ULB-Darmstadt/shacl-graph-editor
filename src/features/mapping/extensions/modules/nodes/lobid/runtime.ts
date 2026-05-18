import type { DataSource } from '@/domain/DataSource'
import {
  alignedRecordIdsForSource,
  buildEnrichmentOutputRows,
  resolveConnectedSourceColumn,
} from '@/services/mapping/enrichmentRuntime'
import { fetchLobidBatch, type LobidExtendedRecord } from '@/features/mapping/extensions/modules/nodes/lobid/client'

export interface LobidRuntimeResult {
  inputSourceId: string
  inputHeader: string
  outputSourceId: string
  results: Record<string, LobidExtendedRecord>
  totalCount: number
  processedCount: number
  cachedCount: number
}

export async function runLobidRuntime(options: {
  nodeId: string
  selectedProperties: string[]
  inputSourceId: string
  inputHeader: string
  sources: DataSource[]
  forceRefresh?: boolean
  addResultSource: (nodeId: string, headers: string[], rows: unknown[][], recordIds?: string[]) => string
}): Promise<LobidRuntimeResult> {
  const connectedInput = resolveConnectedSourceColumn(
    options.sources,
    options.inputSourceId,
    options.inputHeader,
    'The connected source column does not contain any Lobid/GND IDs.',
  )
  if (options.selectedProperties.length === 0) throw new Error('Select at least one Lobid property.')

  const batch = await fetchLobidBatch(connectedInput.values, options.selectedProperties, {
    forceRefresh: options.forceRefresh,
  })
  const outputRows = buildEnrichmentOutputRows(
    connectedInput.source,
    connectedInput.headerIndex,
    batch.results,
    options.selectedProperties,
    (record, property) => record?.[property] ?? '',
  )
  const alignedRecordIds = alignedRecordIdsForSource(connectedInput.source)
  const outputSourceId = options.addResultSource(options.nodeId, [...options.selectedProperties], outputRows, alignedRecordIds)

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
