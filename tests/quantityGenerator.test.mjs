import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { Parser, Store } from 'n3'
import { NamedNode } from 'rdflib'
let server, store, useProfileEditorStore, generator, parser, serializer
const input = { name: 'Width "nominal"', description: 'First line\nSecond line', path: 'http://purl.obolibrary.org/obo/BFO_0000051', quantityKind: { iri: 'http://qudt.org/vocab/quantitykind/Length', label: 'Length' }, units: [{ iri: 'http://qudt.org/vocab/unit/MicroM', label: 'Micrometre' }], datatype: 'double', minimum: '0', maximum: '100', minCount: 1, maxCount: 1 }
let base
before(async () => {
  server = await createServer({ configFile: false, cacheDir: fileURLToPath(new URL('../node_modules/.vite-qudt-tests', import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: { server: createHttpServer() } }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  ;({ useProfileEditorStore } = await server.ssrLoadModule('/src/application/profiles/profileEditorStore.ts'))
  generator = await server.ssrLoadModule('/src/application/profiles/quantityGenerator.ts')
  parser = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  serializer = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileSerializer.ts')
  base = parser.parseShaclProfile(`@prefix sh: <http://www.w3.org/ns/shacl#> . <${generator.NUMERICAL_VARIABLE_PROFILE}> a sh:NodeShape .`, generator.NUMERICAL_VARIABLE_PROFILE, 'fetched')
})
after(async () => { await server.close() })
beforeEach(() => { setActivePinia(createPinia()); store = useProfileEditorStore() })
test('quantity creation links the existing field, preserves constraints, and is one undo step', async () => {
  const parent = store.createProfile()
  const field = store.createProperty(parent)
  await nextTick()
  const before = JSON.stringify(store.profiles)
  const iri = store.addQuantityFromProperty(parent, field, input, [base])
  const result = store.applicationProfile.findNodeShape(parent).properties.find(p => p.nodeId.value === field)
  assert.equal(result.qualifiedValueShape.node.value, iri)
  assert.equal(result.qualifiedValueShape.inlineNodeShape, true)
  assert.equal(result.qualifiedValueShape.label, input.name)
  assert.equal(result.path.value, input.path)
  assert.equal(result.qualifiedMinCount, 1)
  const exported = serializer.serializeProfilesForExport(store.profiles)
  const graph = new Store(new Parser().parse(exported))
  const sh = 'http://www.w3.org/ns/shacl#'
  const exportedField = graph.getQuads(parent, `${sh}property`, null, null)[0].object
  const qualifiedShape = graph.getQuads(exportedField, `${sh}qualifiedValueShape`, null, null)[0].object
  assert.equal(qualifiedShape.termType, 'BlankNode')
  assert.equal(graph.countQuads(qualifiedShape, `${sh}node`, iri, null), 1)
  assert.equal(graph.getQuads(qualifiedShape, 'http://purl.org/dc/terms/title', null, null)[0].object.value, input.name)
  assert.equal(graph.countQuads(iri, `${sh}node`, generator.NUMERICAL_VARIABLE_PROFILE, null), 1)
  assert.equal(graph.countQuads(null, `${sh}hasValue`, input.quantityKind.iri, null), 1)
  assert.equal(graph.countQuads(generator.NUMERICAL_VARIABLE_PROFILE, null, null, null), 0)
  const imported = parser.parseShaclProfiles(exported, 'roundtrip.ttl', 'uploaded').find(p => p.iri === iri)
  assert.equal(imported.nodeShapes[0].label, input.name)
  assert.equal(imported.nodeShapes[0].description, input.description)
  const importedParent = parser.parseShaclProfiles(exported, 'roundtrip.ttl', 'uploaded').find(p => p.iri === parent)
  const importedField = importedParent.nodeShapes[0].properties.find(p => p.path.value === input.path)
  assert.equal(importedField.qualifiedValueShape.inlineNodeShape, true)
  assert.equal(importedField.qualifiedValueShape.label, input.name)
  assert.equal(importedField.qualifiedValueShape.node.value, iri)
  const value = imported.nodeShapes[0].properties.find(p => p.path.value.endsWith('hasNumericalValue'))
  assert.equal(value.minInclusive, '0')
  assert.equal(value.maxInclusive, '100')
  assert.equal(value.datatype.value, 'http://www.w3.org/2001/XMLSchema#double')
  assert.deepEqual(imported.nodeShapes[0].properties.find(p => p.path.value.endsWith('hasUnit')).allowedValues, [input.units[0].iri])
  const after = JSON.stringify(store.profiles)
  store.undo()
  assert.equal(JSON.stringify(store.profiles), before)
  store.redo()
  assert.equal(JSON.stringify(store.profiles), after)
  assert.throws(() => store.addQuantityFromProperty(parent, field, input, [base]), /already connected/)
})
test('invalid definitions and locked fields leave the graph unchanged', async () => {
  const parent = store.createProfile()
  const field = store.createProperty(parent)
  const before = JSON.stringify(store.profiles)
  for (const patch of [{ name: '' }, { units: [] }, { minimum: '101' }, { minimum: 'NaN' }, { datatype: 'integer', minimum: '0.5' }, { units: [...input.units, { iri: 'https://example.org/unit', label: 'Other' }] }, { minCount: -1 }, { maxCount: 0 }, { path: 'bad' }]) {
    assert.throws(() => store.addQuantityFromProperty(parent, field, { ...input, ...patch }, [base]))
    assert.equal(JSON.stringify(store.profiles), before)
  }
  await store.addProfileFromTurtle(`@prefix sh: <http://www.w3.org/ns/shacl#> . <https://example.org/locked> a sh:NodeShape ; sh:property <https://example.org/field> . <https://example.org/field> sh:path <https://example.org/path> .`, 'locked.ttl')
  const lockedBefore = JSON.stringify(store.profiles)
  assert.throws(() => store.addQuantityFromProperty('https://example.org/locked', 'https://example.org/field', input, [base]), /locked/)
  assert.equal(JSON.stringify(store.profiles), lockedBefore)
})
test('quantity roles, selected units, numeric datatypes, and ranges validate instance data', async () => {
  const { default: factory } = await import('@rdfjs/data-model')
  const { default: datasets } = await import('@rdfjs/dataset')
  const { Validator } = await import('shacl-engine')
  const parent = store.createProfile()
  const widthField = store.createProperty(parent)
  store.addQuantityFromProperty(parent, widthField, { ...input, name: 'Width' }, [base])
  const lengthField = store.createProperty(parent)
  store.addQuantityFromProperty(parent, lengthField, { ...input, name: 'Length' }, [])
  const shapes = datasets.dataset(new Parser().parse(serializer.serializeProfilesAsTurtle(store.profiles)))
  shapes.add(factory.quad(factory.namedNode(parent), factory.namedNode('http://www.w3.org/ns/shacl#targetNode'), factory.namedNode('https://example.org/record')))
  const validator = new Validator(shapes, { factory })
  const parameter = (id, role, value = '50', unit = input.units[0].iri) => `<https://example.org/${id}> <http://www.w3.org/2000/01/rdf-schema#label> "${role}" ; <http://w3id.org/nfdi4ing/metadata4ing#hasKindOfQuantity> <${input.quantityKind.iri}> ; <http://w3id.org/nfdi4ing/metadata4ing#hasUnit> <${unit}> ; <http://w3id.org/nfdi4ing/metadata4ing#hasNumericalValue> "${value}"^^<http://www.w3.org/2001/XMLSchema#double> .`
  for (const [width, length, conforms] of [[parameter('width', 'Width'), parameter('length', 'Length'), true], [parameter('width', 'Width'), '', false], [parameter('width', 'Width', '101'), parameter('length', 'Length'), false], [parameter('width', 'Width', '50', 'http://qudt.org/vocab/unit/M'), parameter('length', 'Length'), false]]) {
    const data = `<https://example.org/record> <${input.path}> <https://example.org/width>, <https://example.org/length> . ${width} ${length}`
    const report = await validator.validate({ dataset: datasets.dataset(new Parser().parse(data)) })
    assert.equal(report.conforms, conforms)
  }
})

test('QUDT service preserves full IRIs, rejects failed responses, and supports cancellation', async t => {
  const service = await server.ssrLoadModule('/src/infrastructure/external/qudtService.ts')
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let seenUrl
  globalThis.fetch = async (url, options) => {
    seenUrl = String(url)
    assert.equal(options.headers.Accept, 'application/sparql-results+json')
    return new Response(JSON.stringify({ results: { bindings: [{ resource: { type: 'uri', value: 'https://qudt.org/vocab/quantitykind/Length' }, label: { value: 'Length' } }] } }), { status: 200 })
  }
  const kinds = await service.loadQuantityKinds(new AbortController().signal)
  assert.equal(kinds[0].iri, 'https://qudt.org/vocab/quantitykind/Length')
  assert.match(decodeURIComponent(seenUrl), /LANGMATCHES.*"en"/)
  globalThis.fetch = async () => new Response('unavailable', { status: 503 })
  await assert.rejects(service.loadQuantityUnits(kinds[0].iri, new AbortController().signal), /503/)
  globalThis.fetch = async () => new Response(JSON.stringify({ invalid: true }), { status: 200 })
  await assert.rejects(service.loadQuantityUnits(kinds[0].iri, new AbortController().signal), /invalid response/)
  await assert.rejects(service.loadQuantityUnits('bad> } UNION {', new AbortController().signal), /Invalid/)
  globalThis.fetch = async (url, options) => { options.signal.throwIfAborted(); throw new Error('Unexpected call') }
  const abort = new AbortController()
  abort.abort()
  await assert.rejects(service.loadQuantityUnits(kinds[0].iri, abort.signal), { name: 'AbortError' })
})

test('form preview preserves RDF lists for sh:in and sh:xone, including unit labels', async () => {
  const { serializeProfilesForPreview } = await server.ssrLoadModule('/src/infrastructure/shacl/profilePreviewSerializer.ts')
  const generated = generator.buildQuantityProfile('https://example.org/quantity', { ...input, minimum: '', maximum: '', units: [...input.units, { iri: 'http://qudt.org/vocab/unit/M', label: 'Metre' }] })
  const numeric = generated.nodeShapes[0].properties.find(p => p.path.value.endsWith('hasNumericalValue'))
  numeric.datatype = undefined
  numeric.exclusiveAlternatives = ['integer', 'double'].map(type => ({ datatype: new NamedNode(`http://www.w3.org/2001/XMLSchema#${type}`) }))
  const graph = new Store(new Parser().parse(serializeProfilesForPreview([generated, base])))
  const listItems = (subject, predicate) => {
    let current = graph.getObjects(subject, predicate, null)[0]
    const values = []
    const visited = new Set()
    while (current && current.value !== 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil') {
      assert.ok(!visited.has(current.value), 'No cycles in RDF list')
      visited.add(current.value)
      const first = graph.getObjects(current, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first', null)[0]
      assert.ok(first, 'Every list entry has rdf:first')
      values.push(first)
      current = graph.getObjects(current, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest', null)[0]
    }
    assert.ok(current, 'List terminates with rdf:nil')
    return values
  }
  assert.deepEqual(listItems('https://example.org/quantity#unit', 'http://www.w3.org/ns/shacl#in').map(term => term.value), [input.units[0].iri, 'http://qudt.org/vocab/unit/M'])
  const alternatives = listItems(numeric.nodeId.value, 'http://www.w3.org/ns/shacl#xone')
  assert.deepEqual(alternatives.map(term => graph.getObjects(term, 'http://www.w3.org/ns/shacl#datatype', null)[0].value), ['http://www.w3.org/2001/XMLSchema#integer', 'http://www.w3.org/2001/XMLSchema#double'])
  assert.equal(graph.getObjects('http://qudt.org/vocab/unit/M', 'http://www.w3.org/2000/01/rdf-schema#label', null)[0].value, 'Metre')
  assert.equal(graph.countQuads(null, 'http://www.w3.org/2002/07/owl#imports', generator.NUMERICAL_VARIABLE_PROFILE, null), 0)
})

test('standalone quantity creates one root profile without a parent field and supports undo and later linking', async () => {
  assert.equal(store.profiles.length, 0)
  const iri = store.addQuantityProfile(input, [base])
  assert.deepEqual(store.rootNodeShapes.map(shape => shape.nodeId.value), [iri])
  const generated = store.applicationProfile.profiles.get(iri)
  assert.equal(generated.origin, 'created')
  assert.equal(generated.nodeShapes[0].properties.length, 4)
  assert.ok(generated.nodeShapes[0].properties.every(property => !property.qualifiedValueShape))
  const graph = new Store(new Parser().parse(serializer.serializeProfilesForExport(store.profiles)))
  assert.equal(graph.countQuads(null, 'http://www.w3.org/ns/shacl#qualifiedValueShape', null, null), 0)
  const after = JSON.stringify(store.profiles)
  store.undo()
  assert.equal(store.profiles.length, 0)
  store.redo()
  assert.equal(JSON.stringify(store.profiles), after)
  const parent = store.createProfile()
  const field = store.createConnectedPropertyFromProfile(parent, iri)
  assert.equal(store.applicationProfile.findNodeShape(parent).properties.find(property => property.nodeId.value === field).node.value, iri)
})
