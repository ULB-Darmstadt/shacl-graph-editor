import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  canvasNodeTypes,
  dataSourceImportDefinitions,
  findTransformSemanticsHandler,
  getSetupDialogDefinition,
  mappingNodeActionDefinitions,
  resolveMaterializedNodeOutputSource,
  resolveMappingEdgeCanvasSource,
  shapeSourceImportDefinitions,
} from '@/features/mapping/mappingExtensionRegistry'
import { useDataStore } from '@/stores/dataStore'
import { useMappingStore } from '@/stores/mappingStore'
import { csvSource } from '@/test/dataSources'
import { addGeoNamesNode } from '@/test/mappingExtensionFixtures'

describe('mappingExtensionRegistry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111')
  })

  it('aggregates setup-backed source and shape modules from packaged module folders', () => {
    expect(getSetupDialogDefinition('csv-upload')).toBeTruthy()
    expect(getSetupDialogDefinition('airtable-connect')).toBeTruthy()
    expect(dataSourceImportDefinitions.map(definition => definition.id)).toEqual(
      expect.arrayContaining(['csv-files', 'airtable-tables']),
    )
    expect(shapeSourceImportDefinitions.map(definition => definition.id)).toEqual(
      expect.arrayContaining(['ttl-upload', 'aims-profile-service']),
    )
  })

  it('aggregates packaged node modules into actions and canvas node types', () => {
    expect(mappingNodeActionDefinitions.map(definition => definition.id)).toEqual(
      expect.arrayContaining(['geonames', 'lobid', 'lat-lng-to-wkt']),
    )
    expect(canvasNodeTypes).toMatchObject({
      hubNode: expect.anything(),
      enrichNode: expect.anything(),
      transformNode: expect.anything(),
      tableNode: expect.anything(),
      shapeNode: expect.anything(),
    })
  })

  it('resolves materialized upstream outputs through registered node output handlers', () => {
    const mappingStore = useMappingStore()
    const dataStore = useDataStore()
    const node = addGeoNamesNode(mappingStore, 'demo-user')

    mappingStore.updateExtensionNode('node.geonames.nodes', node.id, current => ({
      ...current,
      outputSourceId: `geonames-output:${node.id}`,
    }))

    expect(resolveMaterializedNodeOutputSource(node.id, {
      dataStore,
      mappingStore,
      sources: dataStore.sources,
    })).toBe(`geonames-output:${node.id}`)
  })

  it('resolves mapping edge source ownership through registered module handlers', () => {
    expect(resolveMappingEdgeCanvasSource({
      sourceId: 'geonames-output:test',
      sourceHeader: 'name',
      shapeIri: 'http://example.org/PlaceShape',
      propertyPath: 'http://www.w3.org/2000/01/rdf-schema#label',
      source: { kind: 'node-output', provider: 'geonames', nodeId: 'geonames:test' },
    })).toEqual({
      source: 'geonames:test',
    })

    expect(resolveMappingEdgeCanvasSource({
      sourceId: 'places',
      sourceHeader: 'lat',
      secondarySourceHeader: 'lng',
      shapeIri: 'http://example.org/PlaceShape',
      propertyPath: 'http://www.opengis.net/ont/geosparql#asWKT',
      transform: 'lat-lng-to-wkt',
      transformNodeId: 'transform:test',
    })).toEqual({
      source: 'transform:test',
      sourceHandle: 'h:wkt',
    })
  })

  it('resolves transform semantics through registered module handlers', () => {
    const handler = findTransformSemanticsHandler('lat-lng-to-wkt')

    expect(handler?.buildRmlTemplate?.({
      sourceId: 'places',
      sourceHeader: 'lat',
      secondarySourceHeader: 'lng',
      shapeIri: 'http://example.org/PlaceShape',
      propertyPath: 'http://www.opengis.net/ont/geosparql#asWKT',
      transform: 'lat-lng-to-wkt',
      transformNodeId: 'transform:test',
    })).toBe('POINT({lng} {lat})')

    expect(handler?.buildValue?.({
      edge: {
        sourceId: 'places',
        sourceHeader: 'lat',
        secondarySourceHeader: 'lng',
        shapeIri: 'http://example.org/PlaceShape',
        propertyPath: 'http://www.opengis.net/ont/geosparql#asWKT',
        transform: 'lat-lng-to-wkt',
        transformNodeId: 'transform:test',
      },
      source: csvSource('places', 'Places', ['lat', 'lng'], [['49.8728', '8.6512']]),
      row: ['49.8728', '8.6512'],
    })).toBe('POINT(8.6512 49.8728)')
  })
})


