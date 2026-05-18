import {
  createNodeOutputTabularSource,
  createRemoteTabularSource,
  createUploadedTabularSource,
  type DataSource,
} from '@/domain/DataSource'

export function csvSource(
  id: string,
  name: string,
  headers: string[],
  rows: unknown[][],
  recordIds?: string[],
): DataSource {
  return createUploadedTabularSource({
    id,
    name,
    headers,
    rows,
    recordIds,
    filename: name,
    mediaType: 'text/csv',
  })
}

export function airtableSource(
  id: string,
  name: string,
  headers: string[],
  rows: unknown[][],
  recordIds: string[],
): DataSource {
  const [, baseId = 'test-base', tableId = id] = id.startsWith('airtable:')
    ? id.split(':')
    : ['airtable', 'test-base', id]

  return createRemoteTabularSource({
    id,
    name,
    provider: 'airtable',
    externalRef: { baseId, tableId },
    headers,
    rows,
    recordIds,
  })
}

export function nodeOutputSource(
  provider: string,
  id: string,
  name: string,
  headers: string[],
  rows: unknown[][],
  recordIds?: string[],
): DataSource {
  return createNodeOutputTabularSource({
    id,
    name,
    provider,
    nodeId: id.includes(':') ? id.slice(id.indexOf(':') + 1) : id,
    headers,
    rows,
    recordIds,
  })
}

