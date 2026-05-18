import { describe, expect, it } from 'vitest'
import type { DataSource } from '@/domain/DataSource'
import { csvSource } from '@/test/dataSources'
import {
  alignedRecordIdsForSource,
  buildEnrichmentOutputRows,
  resolveConnectedSourceColumn,
} from '@/services/mapping/enrichmentRuntime'

describe('enrichmentRuntime', () => {
  const sources = [
    csvSource('cities', 'Cities', ['geoId', 'name'], [['6173331', 'Ottawa'], ['5128581', 'New York']]),
  ] satisfies DataSource[]

  it('resolves a connected source column and collects non-empty values', () => {
    expect(resolveConnectedSourceColumn(sources, 'cities', 'geoId', 'empty')).toMatchObject({
      sourceId: 'cities',
      sourceHeader: 'geoId',
      headerIndex: 0,
      values: ['6173331', '5128581'],
    })
  })

  it('builds aligned record ids when a source has no explicit record ids', () => {
    expect(alignedRecordIdsForSource(sources[0])).toEqual(['6173331', '5128581'])
  })

  it('maps result records back to source rows for exported enrichment outputs', () => {
    const rows = buildEnrichmentOutputRows(
      sources[0],
      0,
      {
        '6173331': { label: 'Ottawa', code: 'CA-ON' },
        '5128581': { label: 'New York', code: 'US-NY' },
      },
      ['label', 'code'],
      (record, field) => record?.[field as 'label' | 'code'] ?? '',
    )

    expect(rows).toEqual([
      ['Ottawa', 'CA-ON'],
      ['New York', 'US-NY'],
    ])
  })
})


