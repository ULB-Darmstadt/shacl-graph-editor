import { TabularDataSource, type DataSource, type DataSourceOrigin } from '@/domain/DataSource'
import { parseShaclProfile, type ShaclProfile } from '@/domain/NodeShape'
import type { MappingEdge } from '@/domain/Mapping'

export interface DataSourceSnapshot {
  id: string
  name: string
  kind: DataSource['kind'] | 'csv' | 'airtable' | 'geonames-result' | 'lobid-result'
  role?: DataSource['role']
  origin?: DataSourceOrigin
  headers: string[]
  rows: unknown[][]
  recordIds?: string[]
  hidden?: boolean
  /** @deprecated legacy Airtable snapshot field. Use origin.externalRef instead. */
  sync?: { baseId: string; tableId: string }
}

export interface ShaclProfileSnapshot {
  iri: string
  source: string
  origin: ShaclProfile['origin']
  rawTurtle: string
}

export interface UiEdgeSnapshot {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface MappingStoreSnapshot {
  edges: MappingEdge[]
  extensionState: Record<string, unknown>
}

export interface ProjectSnapshot {
  version: 1
  project: {
    title: string
    createdAt: string
  }
  sources: DataSourceSnapshot[]
  shapeProfiles: ShaclProfileSnapshot[]
  metadataProfiles: ShaclProfileSnapshot[]
  metadataRootIris: string[]
  metadataTurtle: Record<string, string>
  mapping: MappingStoreSnapshot
}

function cloneRows(rows: unknown[][]): unknown[][] {
  return rows.map(row => [...row])
}

export function createDataSourceSnapshots(sources: DataSource[]): DataSourceSnapshot[] {
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    kind: source.kind,
    role: source.role,
    origin: source.origin ? { ...source.origin } : undefined,
    headers: [...source.headers],
    rows: cloneRows(source.rows),
    recordIds: source.recordIds ? [...source.recordIds] : undefined,
    hidden: source.hidden,
  }))
}

export function restoreDataSourcesFromSnapshot(snapshots: DataSourceSnapshot[]): DataSource[] {
  return snapshots.map(snapshot => {
    return new TabularDataSource({
      id: snapshot.id,
      name: snapshot.name,
      headers: [...snapshot.headers],
      rows: cloneRows(snapshot.rows),
      recordIds: snapshot.recordIds ? [...snapshot.recordIds] : undefined,
      role: snapshot.role ?? (snapshot.hidden ? 'derived' : 'source'),
      hidden: snapshot.hidden,
      origin: snapshot.origin ?? legacyDataSourceOrigin(snapshot),
    })
  })
}

function legacyDataSourceOrigin(snapshot: DataSourceSnapshot): DataSourceOrigin {
  if (snapshot.sync) {
    return {
      kind: 'remote-table',
      provider: 'airtable',
      externalRef: { ...snapshot.sync },
    }
  }

  if (snapshot.kind === 'airtable' || snapshot.id.startsWith('airtable:')) {
    const [, baseId = '', tableId = ''] = snapshot.id.split(':')
    return {
      kind: 'remote-table',
      provider: 'airtable',
      externalRef: { baseId, tableId },
    }
  }

  if (snapshot.kind === 'geonames-result' || snapshot.id.startsWith('geonames-output:')) {
    return {
      kind: 'node-output',
      provider: 'geonames',
      nodeId: snapshot.id.slice('geonames-output:'.length),
    }
  }

  if (snapshot.kind === 'lobid-result' || snapshot.id.startsWith('lobid-output:')) {
    return {
      kind: 'node-output',
      provider: 'lobid',
      nodeId: snapshot.id.slice('lobid-output:'.length),
    }
  }

  return {
    kind: 'uploaded-file',
    filename: snapshot.name,
    mediaType: snapshot.kind === 'csv' ? 'text/csv' : undefined,
  }
}

export function createShaclProfileSnapshots(profiles: ShaclProfile[]): ShaclProfileSnapshot[] {
  return profiles.map(profile => ({
    iri: profile.iri,
    source: profile.source,
    origin: profile.origin,
    rawTurtle: profile.rawTurtle,
  }))
}

export function restoreProfilesFromSnapshot(snapshots: ShaclProfileSnapshot[]): ShaclProfile[] {
  return snapshots.map(snapshot =>
    parseShaclProfile(snapshot.rawTurtle, snapshot.source, snapshot.origin, snapshot.iri),
  )
}

export function cloneMappingEdges(edges: MappingEdge[]): MappingEdge[] {
  return edges.map(normalizeMappingEdge)
}

export function normalizeMappingEdge(edge: MappingEdge): MappingEdge {
  const legacyEdge = edge as MappingEdge & { geoNamesNodeId?: string; lobidNodeId?: string }
  const source = edge.source
    ?? (legacyEdge.geoNamesNodeId
      ? { kind: 'node-output' as const, provider: 'geonames', nodeId: legacyEdge.geoNamesNodeId }
      : undefined)
    ?? (legacyEdge.lobidNodeId
      ? { kind: 'node-output' as const, provider: 'lobid', nodeId: legacyEdge.lobidNodeId }
      : undefined)

  const {
    geoNamesNodeId: _geoNamesNodeId,
    lobidNodeId: _lobidNodeId,
    ...rest
  } = legacyEdge

  return {
    ...rest,
    source: source ? { ...source } : undefined,
  }
}

export function cloneUiEdges(edges: UiEdgeSnapshot[]): UiEdgeSnapshot[] {
  return edges.map(edge => ({ ...edge }))
}


