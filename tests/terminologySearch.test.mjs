import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'
let server, service
before(async () => {
  server = await createServer({ configFile: false, cacheDir: fileURLToPath(new URL('../node_modules/.vite-terminology-tests', import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: { server: createHttpServer() } }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  service = await server.ssrLoadModule('/src/infrastructure/external/terminologySearchService.ts')
})
after(async () => { await server.close() })
const doc = { iri: 'https://example.org/label', label: 'Label', type: 'annotationProperty', description: ['One', 'Two'], ontology_name: 'example', short_form: 'EX_label' }
test('AIMS search parameters include IRI grouping, facets, selection filters, and page offsets', () => {
  const url = service.terminologySearchUrl({ query: '', types: ['property', 'objectproperty'], ontologies: ['m4i', 'qudt'], exact: true, obsolete: false, page: 2, rows: 25 })
  assert.equal(url.origin, 'https://coscine.rwth-aachen.de')
  assert.deepEqual(Object.fromEntries(url.searchParams), { q: '*', exact: 'true', obsoletes: 'false', type: 'property,objectproperty', ontology: 'm4i,qudt', groupByIri: 'true', start: '50', rows: '25', facet: 'true', 'facet.field': 'ontologyPreferredPrefix' })
  const noFilters = service.terminologySearchUrl({ query: 'label', types: [], ontologies: [], exact: false, obsolete: false, page: 0, rows: 10 })
  assert.equal(noFilters.searchParams.has('type'), false)
  assert.equal(noFilters.searchParams.has('ontology'), false)
})
test('normalization retains descriptions, counts, facet keys, and safe IRIs', () => {
  const result = service.parseTerminologySearch({ response: { docs: [doc, { iri: 'javascript:alert(1)', type: 'class' }, { iri: '<bad>' }], numFound: 23 }, facet_counts: { facet_fields: { type: ['property', '23'], ontologyPreferredPrefix: ['example', 20, 'other', '3'] } } })
  assert.equal(result.total, 23)
  assert.equal(result.results[0].description, 'One Two')
  assert.equal(result.results[0].ontology, 'example')
  assert.deepEqual(result.ontologies, [{ key: 'example', count: 20 }, { key: 'other', count: 3 }])
  assert.equal(service.selectableTerminologyResult(result.results[0]), true)
  assert.equal(service.selectableTerminologyResult(result.results[1]), false)
  assert.throws(() => service.parseTerminologySearch({ response: { docs: [], numFound: -1 } }), /invalid result count/)
  assert.throws(() => service.parseTerminologySearch({}), /invalid search response/)
  assert.equal(service.parseTerminologySearch([doc]).total, 1)
  assert.equal(service.parseTerminologySearch({ response: { docs: [doc] }, total: 10 }).total, 10)
})
test('API requests handle suggestions, provenance, HTTP errors, and cancellation', async t => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Accept, 'application/json')
    if (url.pathname.endsWith('/suggest')) return Response.json({ response: { docs: [{ autosuggest: 'Label', type: 'property' }, { label: 'Name' }, {}] } })
    if (url.pathname.endsWith('/properties')) return Response.json({ _embedded: { properties: [{ ontology_name: 'example' }, { ontology_name: 'source', is_defining_ontology: true }, { ontology_name: 'other', is_defining_ontology: false }] } })
    return Response.json({ response: { docs: [doc], numFound: 1 } })
  }
  const signal = new AbortController().signal
  assert.deepEqual(await service.suggestTerminology('*', signal), [])
  assert.deepEqual(await service.suggestTerminology('lab', signal), [{ label: 'Label', type: 'property' }, { label: 'Name', type: '' }])
  const result = service.parseTerminologySearch([doc]).results[0]
  assert.deepEqual(await service.terminologyProvenance(result, signal), { definedBy: ['source'], appearsIn: ['other'] })
  globalThis.fetch = async () => new Response('', { status: 503 })
  await assert.rejects(service.suggestTerminology('lab', signal), /503/)
  globalThis.fetch = async (url, options) => { options.signal.throwIfAborted(); throw new Error('Unexpected call') }
  const controller = new AbortController(); controller.abort()
  await assert.rejects(service.suggestTerminology('lab', controller.signal), { name: 'AbortError' })
})
