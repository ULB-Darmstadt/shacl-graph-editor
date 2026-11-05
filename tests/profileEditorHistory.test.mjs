import assert from 'node:assert/strict'
import { after, before, beforeEach, mock, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import { BlankNode, NamedNode } from 'rdflib'

let server
let useProfileEditorStore
let store
let terminologyTerm

const importedProfileIri = 'https://example.org/imported'
const importedFieldIri = 'https://example.org/imported/field'
const importedTurtle = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  <${importedProfileIri}> a sh:NodeShape ; sh:name "Imported" ;
    sh:property <${importedFieldIri}> .
  <${importedFieldIri}> a sh:PropertyShape ; sh:name "Imported field" ;
    sh:description "Source description" ; sh:path <https://example.org/name> ;
    sh:minCount 1 ; sh:node <${importedProfileIri}> .`

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: fileURLToPath(new URL('../node_modules/.vite-tests', import.meta.url)),
    // SSR tests must not invalidate the running app's optimized dependencies.
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: { server: createHttpServer() } },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  })
  ;({ useProfileEditorStore } = await server.ssrLoadModule('/src/application/profiles/profileEditorStore.ts'))
  ;({ terminologyTerm } = await server.ssrLoadModule('/src/shared/rdf/terminologySelection.ts'))
})

after(async () => {
  await server?.close()
})

beforeEach(() => {
  setActivePinia(createPinia())
  store = useProfileEditorStore()
})

test('terminology selection accepts RDF and OLS property types and rejects concepts and invalid IRIs', () => {
  for (const type of ['property', 'objectProperty', 'dataProperty', 'annotationProperty', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property', 'http://www.w3.org/2002/07/owl#DatatypeProperty']) {
    assert.deepEqual(terminologyTerm({ type, iri: 'https://example.org/term', label: 'Term', ontology_name: 'EX', description: ['First', 'Second'] }), {
      iri: 'https://example.org/term', label: 'Term', ontology: 'EX', description: 'First Second',
    })
  }
  for (const value of [null, {}, { type: 'class', iri: 'https://example.org/class' }, { type: 'skos:Concept', iri: 'https://example.org/concept' }, { type: 'property', iri: 'no iri' }, { type: 'property', iri: '' }]) {
    assert.equal(terminologyTerm(value), null)
  }
})

test('applying a terminology IRI preserves metadata, serializes sh:path and is one undo step', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  store.updatePropertyField(iri, fieldId, 'name', 'Keep name')
  store.updatePropertyField(iri, fieldId, 'description', 'Keep description')
  await nextTick()
  const placeholder = store.applicationProfile.findNodeShape(iri).properties[0].path.value
  const term = terminologyTerm({ type: 'property', iri: 'https://example.org/selected', label: 'Other name' })
  store.updatePropertyField(iri, fieldId, 'path', term.iri)
  await nextTick()
  const field = store.applicationProfile.findNodeShape(iri).properties[0]
  assert.equal(field.path.value, term.iri)
  assert.equal(field.name, 'Keep name')
  assert.equal(field.description, 'Keep description')
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const parsed = parseShaclProfile(store.profiles.find(profile => profile.iri === iri).rawTurtle, 'term.ttl', 'uploaded')
  assert.equal(parsed.nodeShapes[0].properties[0].path.value, term.iri)
  assert.equal(store.undo(), true)
  assert.equal(store.applicationProfile.findNodeShape(iri).properties[0].path.value, placeholder)
  assert.equal(store.redo(), true)
  assert.equal(store.applicationProfile.findNodeShape(iri).properties[0].path.value, term.iri)
})

test('connecting a profile to Add Field creates a named sh:node field as one undo step', async () => {
  const owner = store.createProfile()
  const target = store.createProfile()
  store.updateShapeField(target, 'label', 'Instrument settings')
  store.createProperty(owner)
  await nextTick()
  const fieldId = store.createConnectedPropertyFromProfile(owner, target)
  await nextTick()
  const field = store.applicationProfile.findNodeShape(owner).properties.find(property => property.nodeId.value === fieldId)
  assert.equal(store.profiles.length, 2)
  assert.equal(field.name, 'Instrument settings')
  assert.equal(field.node.value, target)
  assert.equal(field.editorType, 'profile')
  assert.equal(field.datatype, undefined)
  assert.equal(field.order, 1)
  assert.ok(field.path.value)
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const imported = parseShaclProfile(store.profiles.find(profile => profile.iri === owner).rawTurtle, 'add-field.ttl', 'uploaded')
  assert.ok(imported.nodeShapes[0].properties.some(property => property.node?.value === target))
  assert.equal(store.undo(), true)
  assert.equal(store.applicationProfile.findNodeShape(owner).properties.length, 1)
  assert.equal(store.redo(), true)
  assert.equal(store.applicationProfile.findNodeShape(owner).properties.find(property => property.nodeId.value === fieldId).node.value, target)
})

test('Add Field can reference a locked profile but cannot add fields to a locked owner', async () => {
  await store.addProfileFromTurtle(importedTurtle.replace('sh:name "Imported"', '<http://purl.org/dc/terms/title> "Imported"'), 'reference.ttl', importedProfileIri)
  const owner = store.createProfile()
  const before = JSON.stringify(store.profiles.find(profile => profile.iri === importedProfileIri))
  const fieldId = store.createConnectedPropertyFromProfile(owner, importedProfileIri)
  assert.ok(fieldId)
  assert.equal(store.applicationProfile.findNodeShape(owner).properties[0].name, 'Imported')
  assert.equal(JSON.stringify(store.profiles.find(profile => profile.iri === importedProfileIri)), before)
  const allBefore = JSON.stringify(store.profiles)
  assert.equal(store.createConnectedPropertyFromProfile(importedProfileIri, owner), null)
  assert.equal(store.createConnectedPropertyFromProfile(owner, 'missing-profile'), null)
  assert.equal(store.createConnectedPropertyFromProfile('missing-owner', owner), null)
  assert.equal(JSON.stringify(store.profiles), allBefore)
})

test('Add Field supports a profile referencing itself', () => {
  const owner = store.createProfile()
  store.updateShapeField(owner, 'label', 'Nested configuration')
  const fieldId = store.createConnectedPropertyFromProfile(owner, owner)
  const property = store.applicationProfile.findNodeShape(owner).properties.find(property => property.nodeId.value === fieldId)
  assert.equal(property.name, 'Nested configuration')
  assert.equal(property.node.value, owner)
})

test('creating a profile from a field copies its name, links with sh:node and is one undo step', async () => {
  const source = store.createProfile()
  const field = store.createProperty(source)
  store.updatePropertyField(source, field, 'name', 'Configuration')
  store.updatePropertyField(source, field, 'description', 'Configuration for the device')
  store.updatePropertyField(source, field, 'minCount', '1')
  const original = store.applicationProfile.findNodeShape(source).properties[0]
  const originalPath = original.path.value
  await nextTick()
  const target = store.createConnectedProfileFromProperty(source, field)
  await nextTick()
  assert.ok(target)
  assert.equal(store.profiles.length, 2)
  assert.equal(store.applicationProfile.findNodeShape(target).label, 'Configuration')
  assert.equal(store.applicationProfile.findNodeShape(target).properties.length, 0)
  assert.equal(store.profiles.find(profile => profile.iri === target).origin, 'created')
  const linked = store.applicationProfile.findNodeShape(source).properties[0]
  assert.equal(linked.node.value, target)
  assert.equal(linked.editorType, 'profile')
  assert.equal(linked.datatype, undefined)
  assert.equal(linked.path.value, originalPath)
  assert.equal(linked.description, 'Configuration for the device')
  assert.equal(linked.minCount, 1)
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const imported = parseShaclProfile(store.profiles.find(profile => profile.iri === source).rawTurtle, 'linked.ttl', 'uploaded')
  assert.equal(imported.nodeShapes[0].properties[0].node.value, target)
  assert.ok(imported.imports.includes(target))
  assert.equal(store.undo(), true)
  assert.equal(store.profiles.length, 1)
  assert.equal(store.applicationProfile.findNodeShape(source).properties[0].editorType, 'datatype')
  assert.equal(store.applicationProfile.findNodeShape(source).properties[0].node, undefined)
  assert.equal(store.redo(), true)
  assert.equal(store.applicationProfile.findNodeShape(source).properties[0].node.value, target)
})

test('creating a profile from a locked or missing field does not create orphan profiles', async () => {
  await store.addProfileFromTurtle(importedTurtle, 'locked.ttl', importedProfileIri)
  const child = store.createProfile()
  store.setShapeInheritance(child, importedProfileIri)
  const before = JSON.stringify(store.profiles)
  assert.equal(store.createConnectedProfileFromProperty(importedProfileIri, importedFieldIri), null)
  assert.equal(store.createConnectedProfileFromProperty(child, importedFieldIri), null)
  assert.equal(store.createConnectedProfileFromProperty(child, 'missing-field'), null)
  assert.equal(store.createConnectedProfileFromProperty('missing-shape', 'missing-field'), null)
  assert.equal(JSON.stringify(store.profiles), before)
})

test('Create and connect is unavailable for existing connections, including targets not shown on the canvas', () => {
  const source = store.createProfile()
  const existing = store.createProfile()
  for (const type of ['profile', 'qualifiedProfile', 'oneOfProfiles', 'exactlyOneOfProfiles', 'class']) {
    const field = store.createProperty(source)
    store.setPropertyType(source, field, type)
    if (type === 'class') store.updatePropertyField(source, field, 'cls', 'https://example.org/UnloadedClass')
    else store.connectPropertyToShape(source, `ref:${field}`, existing)
    const before = JSON.stringify(store.profiles)
    assert.equal(store.canCreateConnectedProfileFromProperty(source, field), false, type)
    assert.equal(store.createConnectedProfileFromProperty(source, field), null, type)
    assert.equal(JSON.stringify(store.profiles), before, type)
  }
  const field = store.createProperty(source)
  assert.equal(store.canCreateConnectedProfileFromProperty(source, field), true)
  const created = store.createConnectedProfileFromProperty(source, field)
  assert.ok(created)
  assert.equal(store.canCreateConnectedProfileFromProperty(source, field), false)
  assert.equal(store.createConnectedProfileFromProperty(source, field), null)
  store.removePropertyTarget(source, field, created)
  assert.equal(store.canCreateConnectedProfileFromProperty(source, field), true)
})

test('creating a profile from an unconnected qualified or alternative field makes a direct sh:node link', async () => {
  const source = store.createProfile()
  for (const type of ['qualifiedProfile', 'oneOfProfiles', 'exactlyOneOfProfiles', 'value']) {
    const field = store.createProperty(source)
    store.updatePropertyField(source, field, 'name', type)
    store.setPropertyType(source, field, type)
    const target = store.createConnectedProfileFromProperty(source, field)
    const property = store.applicationProfile.findNodeShape(source).properties.find(property => property.nodeId.value === field)
    assert.equal(property.node.value, target)
    assert.equal(property.editorType, 'profile')
    assert.equal(property.qualifiedValueShape, undefined)
    assert.equal(property.alternatives, undefined)
    assert.equal(property.exclusiveAlternatives, undefined)
    assert.equal(property.hasValues, undefined)
    assert.equal(store.applicationProfile.findNodeShape(target).label, type)
  }
})

async function collapsedGraph(links, collapsed) {
  const { collapsePropertyConnections, propertyConnectionKey } = await server.ssrLoadModule('/src/presentation/features/editor/collapsedPropertyConnections.ts')
  const ids = [...new Set(links.flatMap(([source, target]) => [source, target]))]
  const nodes = ids.map(id => ({
    id, position: { x: 100, y: 200 },
    data: {
      representedShapeIri: id, ownerShapeIri: id,
      shape: { nodeId: new NamedNode(`https://example.org/${id}`), properties: [...new Set(links.filter(([source]) => source === id).map(([, , field]) => field))].map(field => ({ nodeId: new BlankNode(field) })) },
    },
  }))
  const edges = links.map(([source, target, field], index) => ({ id: String(index), source, target, sourceHandle: `ref:${field}` }))
  const before = JSON.stringify({ nodes, edges })
  const result = collapsePropertyConnections(nodes, edges, new Set(collapsed.map(([source, field]) => propertyConnectionKey(source, field))))
  assert.equal(JSON.stringify({ nodes, edges }), before)
  return result
}

test('collapsing a field hides its private branch and adds a fading connector marker', async () => {
  const result = await collapsedGraph([['a', 'b', 'field-a'], ['b', 'c', 'field-b']], [['a', 'field-a']])
  assert.deepEqual(result.nodes.map(node => node.id), ['a'])
  assert.deepEqual(result.edges, [])
  assert.deepEqual(result.nodes[0].data.collapsedPropertyKeys, ['field-a'])
})

test('shared targets and their descendants stay visible through other incoming fields', async () => {
  const result = await collapsedGraph([['a', 'b', 'field-a'], ['b', 'c', 'field-b'], ['d', 'b', 'field-d']], [['a', 'field-a']])
  assert.deepEqual(new Set(result.nodes.map(node => node.id)), new Set(['a', 'b', 'c', 'd']))
  assert.deepEqual(result.edges.map(edge => [edge.source, edge.target]), [['b', 'c'], ['d', 'b']])
})

test('a shared descendant remains visible when its private parent is hidden', async () => {
  const result = await collapsedGraph([['a', 'b', 'field-a'], ['b', 'c', 'field-b'], ['d', 'c', 'field-d']], [['a', 'field-a']])
  assert.deepEqual(new Set(result.nodes.map(node => node.id)), new Set(['a', 'c', 'd']))
  assert.deepEqual(result.edges.map(edge => [edge.source, edge.target]), [['d', 'c']])
})

test('private cycles collapse without hiding the source node', async () => {
  const result = await collapsedGraph([['a', 'b', 'field-a'], ['b', 'c', 'field-b'], ['c', 'b', 'field-c'], ['c', 'a', 'field-c']], [['a', 'field-a']])
  assert.deepEqual(result.nodes.map(node => node.id), ['a'])
})

test('collapse is scoped to the source node even when field identifiers are shared', async () => {
  const result = await collapsedGraph([['a', 'b', 'shared-field'], ['d', 'c', 'shared-field']], [['a', 'shared-field']])
  assert.deepEqual(new Set(result.nodes.map(node => node.id)), new Set(['a', 'd', 'c']))
  assert.deepEqual(result.edges.map(edge => [edge.source, edge.target]), [['d', 'c']])
})

test('collapsing a parent also hides a previously collapsed child', async () => {
  const result = await collapsedGraph([['a', 'b', 'field-a'], ['b', 'c', 'field-b']], [['b', 'field-b'], ['a', 'field-a']])
  assert.deepEqual(result.nodes.map(node => node.id), ['a'])
})

test('a shared target disappears only after both incoming fields are collapsed', async () => {
  const links = [['a', 'b', 'field-a'], ['d', 'b', 'field-d'], ['b', 'c', 'field-b']]
  const result = await collapsedGraph(links, [['a', 'field-a'], ['d', 'field-d']])
  assert.deepEqual(new Set(result.nodes.map(node => node.id)), new Set(['a', 'd']))
  const expanded = await collapsedGraph(links, [['a', 'field-a']])
  assert.deepEqual(new Set(expanded.nodes.map(node => node.id)), new Set(['a', 'b', 'c', 'd']))
})

test('hiding every field on a profile hides all private branches and marks every field', async () => {
  const links = [['a', 'b', 'field-one'], ['a', 'c', 'field-two'], ['b', 'd', 'field-b']]
  const hidden = await collapsedGraph(links, [['a', 'field-one'], ['a', 'field-two']])
  assert.deepEqual(hidden.nodes.map(node => node.id), ['a'])
  assert.deepEqual(hidden.nodes[0].data.collapsedPropertyKeys, ['field-one', 'field-two'])
  const shown = await collapsedGraph(links, [])
  assert.equal(shown.nodes.length, 4)
  assert.equal(shown.edges.length, 3)
  assert.ok(shown.nodes.every(node => !node.data.collapsedPropertyKeys.length))
})

test('a multi-target field keeps shared profiles when its private targets collapse', async () => {
  const result = await collapsedGraph([['a', 'b', 'choice'], ['a', 'c', 'choice'], ['d', 'c', 'other']], [['a', 'choice']])
  assert.deepEqual(new Set(result.nodes.map(node => node.id)), new Set(['a', 'c', 'd']))
  assert.deepEqual(result.edges.map(edge => [edge.source, edge.target]), [['d', 'c']])
})

test('showing collapsed connections restores node positions without changing profiles', async () => {
  const source = store.createProfile()
  const target = store.createProfile()
  const field = store.createProperty(source)
  store.setPropertyNodeTarget(source, field, target)
  const { useEditorGraph } = await server.ssrLoadModule('/src/presentation/features/editor/useEditorGraph.ts')
  const { propertyConnectionKey } = await server.ssrLoadModule('/src/presentation/features/editor/collapsedPropertyConnections.ts')
  const collapsed = ref(new Set())
  const positions = ref({ [`shape:${source}`]: { x: 50, y: 60 }, [`shape:${target}`]: { x: 700, y: 400 } })
  const graph = useEditorGraph({ allShapes: computed(() => store.nodeShapes), canvasShapes: computed(() => store.nodeShapes), requestedNodePositions: positions, collapsedPropertyConnections: collapsed, openShapePreview() {} })
  const before = JSON.stringify(store.profiles)
  graph.nodes.value.find(node => node.id === `shape:${target}`).position = { x: 900, y: 500 }
  collapsed.value = new Set([propertyConnectionKey(source, field)])
  await nextTick()
  assert.equal(graph.nodes.value.length, 1)
  assert.equal(graph.hiddenProfileCount.value, 1)
  positions.value = Object.fromEntries(graph.nodes.value.map(node => [node.id, node.position]))
  await nextTick()
  collapsed.value = new Set()
  await nextTick()
  assert.deepEqual(graph.nodes.value.find(node => node.id === `shape:${target}`).position, { x: 900, y: 500 })
  assert.deepEqual(graph.nodes.value.find(node => node.id === `shape:${source}`).data.collapsedPropertyKeys, [])
  assert.equal(graph.hiddenProfileCount.value, 0)
  assert.equal(JSON.stringify(store.profiles), before)
})

test('Review mode reveals collapsed branches, clears the hidden count, and restores hiding on exit', async () => {
  const source = store.createProfile()
  const target = store.createProfile()
  const descendant = store.createProfile()
  const field = store.createProperty(source)
  const childField = store.createProperty(target)
  store.setPropertyNodeTarget(source, field, target)
  store.setPropertyNodeTarget(target, childField, descendant)
  const { useEditorGraph } = await server.ssrLoadModule('/src/presentation/features/editor/useEditorGraph.ts')
  const { propertyConnectionKey } = await server.ssrLoadModule('/src/presentation/features/editor/collapsedPropertyConnections.ts')
  const collapsed = ref(new Set([propertyConnectionKey(source, field)]))
  const reviewMode = ref(false)
  const graph = useEditorGraph({
    allShapes: computed(() => store.nodeShapes), canvasShapes: computed(() => [store.applicationProfile.findNodeShape(source)]),
    requestedNodePositions: ref(Object.fromEntries([source, target, descendant].map((iri, index) => [`shape:${iri}`, { x: index * 500, y: 100 }]))),
    collapsedPropertyConnections: collapsed, reviewMode, openShapePreview() {},
  })
  assert.equal(graph.hiddenProfileCount.value, 2)
  assert.equal(graph.nodes.value.length, 1)
  reviewMode.value = true
  await nextTick()
  assert.equal(graph.nodes.value.length, 3)
  assert.equal(graph.edges.value.length, 2)
  assert.equal(graph.hiddenProfileCount.value, 0)
  assert.ok(graph.nodes.value.every(node => !node.data.collapsedPropertyKeys.length))
  assert.equal(collapsed.value.size, 1)
  reviewMode.value = false
  await nextTick()
  assert.equal(graph.nodes.value.length, 1)
  assert.equal(graph.hiddenProfileCount.value, 2)
})

test('Review mode reveals class and qualified profiles even when their display switches are off', async () => {
  const source = store.createProfile()
  const classProfile = store.createProfile()
  const qualifiedProfile = store.createProfile()
  store.updateShapeField(classProfile, 'targetClass', 'https://example.org/Kind')
  const classField = store.createProperty(source)
  store.setPropertyType(source, classField, 'class')
  store.updatePropertyField(source, classField, 'cls', 'https://example.org/Kind')
  const qualifiedField = store.createProperty(source)
  store.setPropertyType(source, qualifiedField, 'qualifiedProfile')
  store.setPropertyNodeTarget(source, qualifiedField, qualifiedProfile)
  const { useEditorGraph } = await server.ssrLoadModule('/src/presentation/features/editor/useEditorGraph.ts')
  const reviewMode = ref(false)
  const graph = useEditorGraph({
    allShapes: computed(() => store.nodeShapes), canvasShapes: computed(() => [store.applicationProfile.findNodeShape(source)]),
    requestedNodePositions: ref(Object.fromEntries([source, classProfile, qualifiedProfile].flatMap((iri, index) => [
      [`shape:${iri}`, { x: index * 500, y: 100 }], [`shape-proxy:${iri}`, { x: index * 500, y: 100 }],
    ]))),
    showClassRelations: ref(false), showQualifiedValueShapes: ref(false), reviewMode, openShapePreview() {},
  })
  assert.equal(graph.nodes.value.length, 1)
  reviewMode.value = true
  await nextTick()
  assert.equal(graph.nodes.value.length, 3)
  assert.equal(graph.edges.value.length, 2)
  reviewMode.value = false
  await nextTick()
  assert.equal(graph.nodes.value.length, 1)
})

test('xone profiles round trip with all graph targets, edge labels and imports', async () => {
  const source = store.createProfile()
  const first = store.createProfile()
  const second = store.createProfile()
  const field = store.createProperty(source)
  store.setPropertyType(source, field, 'exactlyOneOfProfiles')
  store.setPropertyAlternativeTargets(source, field, [first, second, first])
  const property = store.applicationProfile.findNodeShape(source).properties[0]
  assert.deepEqual(property.exclusiveAlternatives.map(alternative => alternative.node.value), [first, second])
  assert.equal(property.alternatives, undefined)
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const profile = store.profiles.find(profile => profile.iri === source)
  const imported = parseShaclProfile(profile.rawTurtle, 'xone.ttl', 'uploaded')
  assert.equal(imported.nodeShapes[0].properties[0].editorType, 'exactlyOneOfProfiles')
  assert.deepEqual(imported.imports.sort(), [first, second].sort())
  assert.match(profile.rawTurtle, /sh:xone/)
  assert.doesNotMatch(profile.rawTurtle, /sh:or /)
  const { propertyNodeTargets } = await server.ssrLoadModule('/src/domain/profiles/index.ts')
  assert.deepEqual(propertyNodeTargets(property).map(node => node.value), [first, second])
  const { buildEditorStructuralEdges } = await server.ssrLoadModule('/src/presentation/features/editor/editorGraphBuilders.ts')
  const edges = buildEditorStructuralEdges([store.applicationProfile.findNodeShape(source)], store.nodeShapes)
  assert.equal(edges.length, 2)
  assert.ok(edges.every(edge => edge.data.relationLabel === 'sh:xone'))
  assert.equal(store.removeProfile(first).ok, false)
})

test('xone connections append, remove and undo targets without changing relation type', async () => {
  const source = store.createProfile()
  const first = store.createProfile()
  const second = store.createProfile()
  const field = store.createProperty(source)
  store.setPropertyType(source, field, 'exactlyOneOfProfiles')
  store.connectPropertyToShape(source, `ref:${field}`, first)
  store.connectPropertyToShape(source, `ref:${field}`, second)
  store.connectPropertyToShape(source, `ref:${field}`, first)
  await nextTick()
  assert.equal(store.applicationProfile.findNodeShape(source).properties[0].exclusiveAlternatives.length, 2)
  store.removePropertyTarget(source, field, first)
  await nextTick()
  assert.equal(store.applicationProfile.findNodeShape(source).properties[0].editorType, 'exactlyOneOfProfiles')
  assert.deepEqual(store.applicationProfile.findNodeShape(source).properties[0].exclusiveAlternatives.map(alternative => alternative.node.value), [second])
  assert.equal(store.undo(), true)
  assert.equal(store.applicationProfile.findNodeShape(source).properties[0].exclusiveAlternatives.length, 2)
  assert.equal(store.redo(), true)
  assert.equal(store.applicationProfile.findNodeShape(source).properties[0].exclusiveAlternatives.length, 1)
  store.removePropertyTarget(source, field, second)
  assert.deepEqual(store.applicationProfile.findNodeShape(source).properties[0].exclusiveAlternatives, [])
  const { buildEditorReviewItems } = await server.ssrLoadModule('/src/presentation/features/editor/editorReview.ts')
  assert.ok(buildEditorReviewItems(store.nodeShapes).some(item => item.field === 'exclusiveProfileTargets'))
})

test('imported xone profile targets remain locked', async () => {
  const source = 'https://example.org/exclusive'
  const field = `${source}/field`
  const turtle = `@prefix sh: <http://www.w3.org/ns/shacl#> .
    <${source}> a sh:NodeShape ; sh:property <${field}> .
    <${field}> sh:path <https://example.org/value> ;
      sh:xone ( [ sh:node <https://example.org/a> ] [ sh:node <https://example.org/b> ] ) .`
  await store.addProfileFromTurtle(turtle, 'xone.ttl', source)
  assert.equal(store.nodeShapes[0].properties[0].editorType, 'exactlyOneOfProfiles')
  const before = JSON.stringify(store.profiles)
  store.setPropertyAlternativeTargets(source, field, ['https://example.org/c'])
  store.connectPropertyToShape(source, `ref:${field}`, 'https://example.org/c')
  store.removePropertyTarget(source, field, 'https://example.org/a')
  assert.equal(JSON.stringify(store.profiles), before)
})

test('exported xone validates exactly one profile and rejects zero or overlapping matches', async () => {
  const source = store.createProfile()
  const first = store.createProfile()
  const second = store.createProfile()
  for (const [iri, path] of [[first, 'https://example.org/a'], [second, 'https://example.org/b']]) {
    const field = store.createProperty(iri)
    store.updatePropertyField(iri, field, 'path', path)
    store.updatePropertyField(iri, field, 'minCount', '1')
  }
  const field = store.createProperty(source)
  store.updatePropertyField(source, field, 'path', 'https://example.org/value')
  store.setPropertyType(source, field, 'exactlyOneOfProfiles')
  store.setPropertyAlternativeTargets(source, field, [first, second])
  const { Parser } = await import('n3')
  const { default: factory } = await import('@rdfjs/data-model')
  const { default: datasets } = await import('@rdfjs/dataset')
  const { Validator } = await import('shacl-engine')
  const shapes = datasets.dataset(new Parser().parse(store.profiles.map(profile => profile.rawTurtle).join('\n')))
  shapes.add(factory.quad(factory.namedNode(source), factory.namedNode('http://www.w3.org/ns/shacl#targetNode'), factory.namedNode('https://example.org/record')))
  const validator = new Validator(shapes, { factory })
  for (const [predicates, conforms] of [[[], false], [['a'], true], [['b'], true], [['a', 'b'], false]]) {
    const data = `<https://example.org/record> <https://example.org/value> <https://example.org/object> .\n`
      + predicates.map(predicate => `<https://example.org/object> <https://example.org/${predicate}> "value" .`).join('\n')
    const report = await validator.validate({ dataset: datasets.dataset(new Parser().parse(data)) })
    assert.equal(report.conforms, conforms, predicates.join(','))
  }
})

function updateFixedValue(shapeIri, propertyIri, field, value) {
  const property = store.applicationProfile.findNodeShape(shapeIri).properties.find(candidate => candidate.nodeId.value === propertyIri)
  const rows = (property.hasValues ?? []).map(term => ({
    value: term.value,
    datatype: term.termType === 'Literal' ? term.datatype.value : term.termType === 'NamedNode' ? '@iri' : '@blank',
    language: term.termType === 'Literal' ? term.language : '',
  }))
  if (!rows.length) rows.push({ value: '', datatype: 'http://www.w3.org/2001/XMLSchema#string', language: '' })
  rows[0][field === 'hasValue' ? 'value' : field === 'hasValueDatatype' ? 'datatype' : 'language'] = value
  store.updatePropertyField(shapeIri, propertyIri, 'hasValues', JSON.stringify(rows))
}

test('Value property type serializes typed fixed values and survives import and undo', async () => {
  const iri = store.createProfile()
  const field = store.createProperty(iri)
  store.setPropertyType(iri, field, 'value')
  updateFixedValue(iri, field, 'hasValue', '42')
  updateFixedValue(iri, field, 'hasValueDatatype', 'http://www.w3.org/2001/XMLSchema#integer')
  await nextTick()
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const parsed = parseShaclProfile(store.profiles[0].rawTurtle, 'value.ttl', 'uploaded')
  assert.equal(parsed.nodeShapes[0].properties[0].editorType, 'value')
  assert.equal(parsed.nodeShapes[0].properties[0].hasValues[0].value, '42')
  assert.equal(parsed.nodeShapes[0].properties[0].hasValues[0].datatype.value, 'http://www.w3.org/2001/XMLSchema#integer')
  assert.equal(parsed.nodeShapes[0].properties[0].datatype, undefined)
  updateFixedValue(iri, field, 'hasValue', '0')
  await nextTick()
  assert.equal(store.undo(), true)
  assert.equal(store.nodeShapes[0].properties[0].hasValues[0].value, '42')
  assert.match(store.nodeShapes[0].properties[0].hasValues[0].toNT(), /integer/)
  assert.equal(store.redo(), true)
  assert.equal(store.nodeShapes[0].properties[0].hasValues[0].value, '0')
})

test('fixed strings retain empty values, whitespace, escaped text, and language tags', async () => {
  const iri = store.createProfile()
  const field = store.createProperty(iri)
  store.setPropertyType(iri, field, 'value')
  updateFixedValue(iri, field, 'hasValue', '')
  assert.match(store.profiles[0].rawTurtle, /sh:hasValue ""/)
  updateFixedValue(iri, field, 'hasValue', '  A "quoted" value\nnext line  ')
  updateFixedValue(iri, field, 'hasValueDatatype', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString')
  updateFixedValue(iri, field, 'hasValueLanguage', 'de')
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const fieldValue = parseShaclProfile(store.profiles[0].rawTurtle, 'lang.ttl', 'uploaded').nodeShapes[0].properties[0].hasValues[0]
  assert.equal(fieldValue.value, '  A "quoted" value\nnext line  ')
  assert.equal(fieldValue.language, 'de')
  store.setPropertyType(iri, field, 'datatype')
  assert.equal(store.nodeShapes[0].properties[0].hasValues, undefined)
  assert.doesNotMatch(store.profiles[0].rawTurtle, /sh:hasValue/)
})

test('all datatype options serialize as typed fixed values without losing their datatype', async () => {
  const { SHACL_DATATYPE_OPTIONS } = await server.ssrLoadModule('/src/application/profiles/profileEditorCatalogs.ts')
  const { Parser, Store } = await import('n3')
  assert.equal(new Set(SHACL_DATATYPE_OPTIONS.map(option => option.value)).size, SHACL_DATATYPE_OPTIONS.length)
  assert.equal(SHACL_DATATYPE_OPTIONS.length, 42)
  const iri = store.createProfile()
  const field = store.createProperty(iri)
  store.setPropertyType(iri, field, 'value')
  for (const option of SHACL_DATATYPE_OPTIONS) {
    updateFixedValue(iri, field, 'hasValueDatatype', option.value)
    updateFixedValue(iri, field, 'hasValue', '42')
    const graph = new Store(new Parser().parse(store.profiles[0].rawTurtle))
    const [value] = graph.getObjects(null, 'http://www.w3.org/ns/shacl#hasValue', null)
    assert.equal(value.datatype.value, option.value, option.label)
    assert.equal(value.value, '42', option.label)
  }
})

test('imported fixed values stay locked and preserve resource values', async () => {
  const iri = 'https://example.org/fixed'
  const turtle = `@prefix sh: <http://www.w3.org/ns/shacl#> .
    <${iri}> a sh:NodeShape ; sh:property <${iri}/value> .
    <${iri}/value> sh:path <https://example.org/type> ; sh:hasValue <https://example.org/required> .`
  await store.addProfileFromTurtle(turtle, 'fixed.ttl', iri)
  assert.equal(store.nodeShapes[0].properties[0].editorType, 'value')
  const before = JSON.stringify(store.profiles)
  updateFixedValue(iri, `${iri}/value`, 'hasValue', 'https://example.org/changed')
  updateFixedValue(iri, `${iri}/value`, 'hasValueDatatype', 'http://www.w3.org/2001/XMLSchema#string')
  assert.equal(JSON.stringify(store.profiles), before)
  assert.match(store.profiles[0].rawTurtle, /sh:hasValue <https:\/\/example.org\/required>/)
  store.lockImportedProfiles = false
  updateFixedValue(iri, `${iri}/value`, 'hasValue', 'https://example.org/changed')
  assert.equal(store.nodeShapes[0].properties[0].hasValues[0].termType, 'NamedNode')
  assert.equal(store.nodeShapes[0].properties[0].hasValues[0].value, 'https://example.org/changed')
})

test('multiple required values retain individual datatypes through save, import, removal and undo', async () => {
  const iri = store.createProfile()
  const field = store.createProperty(iri)
  store.setPropertyType(iri, field, 'value')
  const rows = [
    { value: '0', datatype: 'http://www.w3.org/2001/XMLSchema#integer' },
    { value: 'false', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' },
    { value: 'Hallo', datatype: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString', language: 'de' },
    { value: 'https://example.org/required', datatype: '@iri' },
  ]
  store.updatePropertyField(iri, field, 'hasValues', JSON.stringify(rows))
  await nextTick()
  const original = store.nodeShapes[0].properties[0].hasValues.map(value => value.toNT())
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const imported = parseShaclProfile(store.profiles[0].rawTurtle, 'multiple.ttl', 'uploaded').nodeShapes[0].properties[0]
  assert.equal(imported.editorType, 'value')
  assert.deepEqual(imported.hasValues.map(value => value.toNT()).sort(), [...original].sort())
  const { serializeProfilesForPreview } = await server.ssrLoadModule('/src/infrastructure/shacl/profilePreviewSerializer.ts')
  const { Parser, Store } = await import('n3')
  const preview = new Store(new Parser().parse(serializeProfilesForPreview(store.profiles)))
  const previewFields = preview.getObjects(iri, 'http://www.w3.org/ns/shacl#property', null)
  assert.equal(previewFields.length, rows.length)
  for (const previewField of previewFields) {
    assert.equal(preview.countQuads(previewField, 'http://www.w3.org/ns/shacl#hasValue', null, null), 1)
  }
  assert.equal(parseShaclProfile(store.profiles[0].rawTurtle, 'export.ttl', 'uploaded').nodeShapes[0].properties.length, 1)
  store.updatePropertyField(iri, field, 'hasValues', JSON.stringify(rows.slice(1)))
  await nextTick()
  assert.equal(store.nodeShapes[0].properties[0].hasValues.length, 3)
  assert.equal(store.undo(), true)
  assert.deepEqual(store.nodeShapes[0].properties[0].hasValues.map(value => value.toNT()), original)
  assert.equal(store.redo(), true)
  assert.equal(store.nodeShapes[0].properties[0].hasValues.length, 3)
  store.updatePropertyField(iri, field, 'hasValues', '[]')
  assert.equal(store.nodeShapes[0].properties[0].editorType, 'value')
  assert.deepEqual(store.nodeShapes[0].properties[0].hasValues, [])
  assert.doesNotMatch(store.profiles[0].rawTurtle, /sh:hasValue/)
})

test('profile URL edits update identity, references and Turtle, and support undo and redo', async () => {
  const original = store.createProfile()
  const child = store.createProfile()
  const field = store.createProperty(child)
  store.setShapeInheritance(child, original)
  store.setPropertyNodeTarget(child, field, original)
  const renamed = 'https://example.org/renamed-profile'
  await nextTick()

  assert.deepEqual(store.updateProfileUrl(original, ` ${renamed} `), { ok: true })
  await nextTick()
  assert.equal(store.applicationProfile.profiles.has(original), false)
  assert.equal(store.applicationProfile.profiles.has(renamed), true)
  assert.equal(store.applicationProfile.findNodeShape(original), undefined)
  assert.equal(store.applicationProfile.findNodeShape(renamed).sourceProfileIri, renamed)
  assert.equal(store.applicationProfile.findNodeShape(child).properties[0].node.value, renamed)
  assert.deepEqual(store.applicationProfile.findNodeShape(child).inheritedShapeIris, [renamed])
  assert.ok(store.profiles.every(profile => !profile.rawTurtle.includes(original)))
  assert.ok(store.rootNodeShapes.some(shape => shape.nodeId.value === child))

  assert.equal(store.undo(), true)
  assert.ok(store.applicationProfile.findNodeShape(original))
  assert.equal(store.applicationProfile.findNodeShape(child).properties[0].node.value, original)
  assert.equal(store.redo(), true)
  assert.ok(store.applicationProfile.findNodeShape(renamed))
})

test('profile URL rejects empty, malformed and duplicate identities without changing data', async () => {
  const original = store.createProfile()
  const other = store.createProfile()
  const field = store.createProperty(other)
  await nextTick()
  const before = JSON.stringify(store.profiles)
  for (const value of ['', 'relative/path', 'https://', 'https://example.org/a b', 'https://example.org/<bad>', other, field]) {
    assert.equal(store.updateProfileUrl(original, value).ok, false, value)
    assert.equal(JSON.stringify(store.profiles), before)
  }
})

test('profile URL stays locked for imports and becomes editable when unlocked', async () => {
  await store.addProfileFromTurtle(importedTurtle, 'mps.ttl', importedProfileIri)
  const renamed = 'https://example.org/renamed-import'
  const before = JSON.stringify(store.profiles)
  assert.equal(store.updateProfileUrl(importedProfileIri, renamed).ok, false)
  assert.equal(JSON.stringify(store.profiles), before)
  store.lockImportedProfiles = false
  assert.equal(store.updateProfileUrl(importedProfileIri, renamed).ok, true)
  assert.equal(store.applicationProfile.findNodeShape(renamed).properties[0].node.value, renamed)
  assert.equal(store.profiles[0].source, 'mps.ttl')
  store.lockImportedProfiles = true
  assert.equal(store.isShapeLocked(renamed), true)
})

test('profile URL preserves field identities and vocabulary terms while updating nested shape references', async () => {
  const original = store.createProfile()
  const field = store.createProperty(original)
  const property = store.applicationProfile.profiles.get(original).nodeShapes[0].properties[0]
  property.path = new NamedNode(original)
  property.cls = new NamedNode(original)
  property.alternatives = [{ node: new NamedNode(original) }]
  property.conjunctions = [{ node: new NamedNode(original) }]
  property.exclusiveAlternatives = [{ node: new NamedNode(original) }]
  property.negatedConstraint = { node: new NamedNode(original) }
  property.qualifiedValueShape = { node: new NamedNode(original) }
  const renamed = 'https://example.org/new-identity'

  assert.equal(store.updateProfileUrl(original, renamed).ok, true)
  const next = store.applicationProfile.findNodeShape(renamed).properties[0]
  assert.equal(next.nodeId.value, field)
  assert.equal(next.path.value, original)
  assert.equal(next.cls.value, original)
  for (const constraint of [next.alternatives[0], next.conjunctions[0], next.exclusiveAlternatives[0], next.negatedConstraint, next.qualifiedValueShape]) {
    assert.equal(constraint.node.value, renamed)
  }
})

test('profile URL cannot rewrite references inside a locked profile', async () => {
  const original = store.createProfile()
  const turtle = importedTurtle.replace(`sh:node <${importedProfileIri}>`, `sh:node <${original}>`)
  await store.addProfileFromTurtle(turtle, 'mps.ttl', importedProfileIri)
  const before = JSON.stringify(store.profiles)
  assert.equal(store.updateProfileUrl(original, 'https://example.org/new-identity').ok, false)
  assert.equal(JSON.stringify(store.profiles), before)
})

test('creation and synchronous defaults form one undo step', async () => {
  assert.equal(store.canUndo, false)
  assert.equal(store.canRedo, false)
  assert.equal(store.undo(), false)
  assert.equal(store.redo(), false)
  const iri = store.createProfile()
  store.updateShapeField(iri, 'creator', 'Example creator')
  store.updateShapeField(iri, 'label', 'Example profile')
  await nextTick()

  assert.equal(store.canUndo, true)
  assert.equal(store.undo(), true)
  assert.equal(store.profiles.length, 0)
  assert.equal(store.canUndo, false)
  assert.equal(store.canRedo, true)
  assert.equal(store.redo(), true)
  assert.equal(store.nodeShapes[0].creator, 'Example creator')
  assert.equal(store.nodeShapes[0].label, 'Example profile')
  await nextTick()
  assert.equal(store.canRedo, false)
})

test('a new edit discards redo, while an unchanged value preserves it', async () => {
  const iri = store.createProfile()
  await nextTick()
  store.updateShapeField(iri, 'label', 'First')
  await nextTick()
  store.updateShapeField(iri, 'label', 'Second')
  await nextTick()
  store.undo()
  store.updateShapeField(iri, 'label', 'First')
  await nextTick()
  assert.equal(store.canRedo, true)
  store.updateShapeField(iri, 'label', 'Another branch')
  await nextTick()
  assert.equal(store.canRedo, false)
  assert.equal(store.redo(), false)
  store.undo()
  assert.equal(store.nodeShapes[0].label, 'First')
})

test('nested constraints and RDF term methods survive repeated restoration', async () => {
  const iri = store.createProfile()
  const propertyId = store.createProperty(iri)
  store.setPropertyType(iri, propertyId, 'qualifiedProfile')
  store.setPropertyInlineNodeShape(iri, propertyId, true)
  store.setPropertyInlineNodeShapeLabel(iri, propertyId, 'Original label')
  await nextTick()
  store.setPropertyInlineNodeShapeLabel(iri, propertyId, 'Changed label')
  await nextTick()
  for (let count = 0; count < 2; count += 1) {
    store.undo()
    const property = store.nodeShapes[0].properties[0]
    assert.equal(property.qualifiedValueShape.label, 'Original label')
    assert.ok(property.nodeId instanceof NamedNode)
    assert.equal(property.nodeId.equals(new NamedNode(propertyId)), true)
    assert.equal(property.qualifiedValueShape.inlineNodeShape, true)
    assert.match(store.profiles[0].rawTurtle, /Original label/)
    store.redo()
    assert.equal(store.nodeShapes[0].properties[0].qualifiedValueShape.label, 'Changed label')
  }
})

test('moving and deleting fields can be undone and redone', async () => {
  const source = store.createProfile()
  const target = store.createProfile()
  const propertyId = store.createProperty(source)
  await nextTick()
  store.movePropertyToShape(source, propertyId, target)
  await nextTick()
  store.undo()
  assert.equal(store.applicationProfile.findNodeShape(source).properties[0].nodeId.value, propertyId)
  assert.equal(store.applicationProfile.findNodeShape(target).properties.length, 0)
  store.redo()
  assert.equal(store.applicationProfile.findNodeShape(target).properties[0].nodeId.value, propertyId)
  store.removeProperty(target, propertyId)
  await nextTick()
  store.undo()
  assert.equal(store.applicationProfile.findNodeShape(target).properties[0].nodeId.value, propertyId)
})

test('reset and profile deletion retain recoverable history', async () => {
  const iri = store.createProfile()
  await nextTick()
  store.removeProfile(iri)
  await nextTick()
  store.undo()
  assert.equal(store.profiles[0].iri, iri)
  store.reset()
  await nextTick()
  assert.equal(store.profiles.length, 0)
  store.undo()
  assert.equal(store.profiles[0].iri, iri)
  store.redo()
  assert.equal(store.profiles.length, 0)
})

test('import is restored without refetching or losing source metadata', async () => {
  const turtle = `@prefix sh: <http://www.w3.org/ns/shacl#> .
    <https://example.org/profile> a sh:NodeShape ; sh:property [ sh:path <https://example.org/name> ] .`
  await store.addProfileFromTurtle(turtle, 'imported.ttl')
  await nextTick()
  const exported = store.profiles[0].rawTurtle
  store.undo()
  assert.equal(store.profiles.length, 0)
  store.redo()
  assert.equal(store.profiles[0].source, 'imported.ttl')
  assert.equal(store.profiles[0].origin, 'fetched')
  assert.equal(store.profiles[0].rawTurtle, exported)
  assert.ok(store.nodeShapes[0].properties[0].nodeId instanceof BlankNode)
})

test('history is unavailable while imports are resolving', async () => {
  store.createProfile()
  await nextTick()
  store.isResolvingImports = true
  assert.equal(store.canUndo, false)
  assert.equal(store.canRedo, false)
  assert.equal(store.undo(), false)
  assert.equal(store.redo(), false)
  assert.equal(store.profiles.length, 1)
  store.isResolvingImports = false
  assert.equal(store.undo(), true)
})

test('history retains the most recent 100 undo steps', async () => {
  const iri = store.createProfile()
  await nextTick()
  for (let count = 0; count < 105; count += 1) {
    store.updateShapeField(iri, 'label', `Label ${count}`)
    await nextTick()
  }
  let undoCount = 0
  while (store.undo()) undoCount += 1
  assert.equal(undoCount, 100)
  assert.equal(store.nodeShapes[0].label, 'Label 4')
})

test('copy keeps only field metadata and IRI, with independent localized values', async () => {
  store.lockImportedProfiles = false
  await store.addProfileFromTurtle(`
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    <https://example.org/profile> a sh:NodeShape ; sh:property [
      sh:path <https://example.org/name> ; sh:name "Name"@en, "Bezeichnung"@de ;
      sh:description "A name"@en ; sh:datatype xsd:string ;
      sh:minCount 1 ; sh:maxCount 1 ; sh:pattern "[A-Z]+"
    ] .`, 'metadata.ttl')
  const shape = store.nodeShapes[0]
  const source = shape.properties[0]
  const copyId = store.copyProperty(shape.nodeId.value, source.nodeId.value)
  const copy = store.nodeShapes[0].properties.find(property => property.nodeId.value === copyId)

  assert.notEqual(copyId, source.nodeId.value)
  assert.equal(copy.name, source.name)
  assert.equal(copy.description, source.description)
  assert.equal(copy.path.value, source.path.value)
  assert.deepEqual(copy.nameLiterals, source.nameLiterals)
  assert.deepEqual(copy.descriptionLiterals, source.descriptionLiterals)
  assert.notEqual(copy.nameLiterals, source.nameLiterals)
  assert.notEqual(copy.descriptionLiterals[0], source.descriptionLiterals[0])
  assert.ok(copy.path instanceof NamedNode)
  assert.equal(copy.inherited, undefined)
  assert.equal(copy.minCount, undefined)
  assert.equal(copy.maxCount, undefined)
  assert.equal(copy.pattern, undefined)
  assert.equal(copy.datatype, undefined)
  assert.equal(copy.order, 1)
  store.updatePropertyField(shape.nodeId.value, copyId, 'name', 'Copy name')
  assert.equal(store.nodeShapes[0].properties[0].name, source.name)
})

test('inherited copy belongs to the child and leaves inherited constraints visible', async () => {
  const parent = store.createProfile()
  const child = store.createProfile()
  const fieldId = store.createProperty(parent)
  store.updatePropertyField(parent, fieldId, 'name', 'Shared field')
  store.updatePropertyField(parent, fieldId, 'path', 'https://example.org/shared')
  store.updatePropertyField(parent, fieldId, 'minCount', '1')
  store.setShapeInheritance(child, parent)
  await nextTick()

  const copyId = store.copyProperty(child, fieldId)
  await nextTick()
  store.updatePropertyField(child, copyId, 'maxCount', '3')
  await nextTick()
  const childShape = store.applicationProfile.findNodeShape(child)
  assert.equal(childShape.properties.length, 2)
  assert.equal(childShape.properties[0].inherited, true)
  assert.equal(childShape.properties[0].minCount, 1)
  assert.equal(childShape.properties[1].nodeId.value, copyId)
  assert.equal(childShape.properties[1].inherited, undefined)
  assert.equal(childShape.properties[1].maxCount, 3)
  assert.equal(childShape.properties[1].minCount, undefined)
  assert.equal(store.applicationProfile.findNodeShape(parent).properties.length, 1)
  assert.equal(store.applicationProfile.findNodeShape(parent).properties[0].maxCount, undefined)

  const { buildInheritedPropertyGroups, buildOwnProperties } = await server.ssrLoadModule(
    '/src/presentation/features/editor/inheritanceEditorGraph.ts',
  )
  assert.equal(buildInheritedPropertyGroups(childShape, store.nodeShapes)[0].properties[0].nodeId.value, fieldId)
  assert.equal(buildOwnProperties(childShape, store.nodeShapes)[0].nodeId.value, copyId)

  const exported = store.profiles.find(profile => profile.iri === child).rawTurtle
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const importedChild = parseShaclProfile(exported, 'copy.ttl', 'uploaded', child).nodeShapes[0]
  assert.equal(importedChild.properties.length, 1)
  assert.equal(importedChild.properties[0].path.value, 'https://example.org/shared')
  assert.equal(importedChild.properties[0].maxCount, 3)
  assert.deepEqual(importedChild.inheritedShapeIris, [parent])
})

test('copy and deletion are undoable without changing the original', async () => {
  const iri = store.createProfile()
  const originalId = store.createProperty(iri)
  await nextTick()
  const firstCopyId = store.copyProperty(iri, originalId)
  await nextTick()
  const secondCopyId = store.copyProperty(iri, originalId)
  await nextTick()
  assert.notEqual(firstCopyId, secondCopyId)
  assert.equal(store.nodeShapes[0].properties.length, 3)
  store.undo()
  assert.equal(store.nodeShapes[0].properties.length, 2)
  store.redo()
  assert.equal(store.nodeShapes[0].properties[2].nodeId.value, secondCopyId)
  assert.equal(store.removeProperty(iri, firstCopyId), true)
  await nextTick()
  assert.equal(store.nodeShapes[0].properties[0].nodeId.value, originalId)
  store.undo()
  assert.equal(store.nodeShapes[0].properties[1].nodeId.value, firstCopyId)
})

test('copy ignores missing profiles and fields without adding history', async () => {
  const iri = store.createProfile()
  await nextTick()
  store.undo()
  assert.equal(store.canRedo, true)
  assert.equal(store.copyProperty(iri, 'missing-field'), null)
  assert.equal(store.copyProperty('missing-profile', 'missing-field'), null)
  await nextTick()
  assert.equal(store.canRedo, true)
  assert.equal(store.profiles.length, 0)
})

test('deleting an inherited field preserves a separate own-property copy', async () => {
  const parent = store.createProfile()
  const child = store.createProfile()
  const originalId = store.createProperty(parent)
  store.setShapeInheritance(child, parent)
  const copyId = store.copyProperty(child, originalId)
  await nextTick()
  assert.equal(store.removeProperty(child, originalId), true)
  await nextTick()
  assert.equal(store.applicationProfile.findNodeShape(parent).properties.length, 0)
  assert.equal(store.applicationProfile.findNodeShape(child).properties.length, 1)
  assert.equal(store.applicationProfile.findNodeShape(child).properties[0].nodeId.value, copyId)
  store.undo()
  assert.equal(store.applicationProfile.findNodeShape(parent).properties[0].nodeId.value, originalId)
  assert.equal(store.applicationProfile.findNodeShape(child).properties.length, 2)
})

test('typing a title across multiple input events is one undo step', async () => {
  const iri = store.createProfile()
  store.updateShapeField(iri, 'label', 'Original title')
  await nextTick()
  store.beginHistoryGroup()
  for (const title of ['N', 'Ne', 'New', 'New title']) {
    store.updateShapeField(iri, 'label', title)
    await nextTick()
  }
  store.endHistoryGroup()
  await nextTick()
  store.undo()
  assert.equal(store.nodeShapes[0].label, 'Original title')
  store.redo()
  assert.equal(store.nodeShapes[0].label, 'New title')
})

test('separate editing sessions and later actions stay separate undo steps', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  store.updatePropertyField(iri, fieldId, 'name', 'Original field')
  await nextTick()
  for (const name of ['First edit', 'Second edit']) {
    store.beginHistoryGroup()
    store.updatePropertyField(iri, fieldId, 'name', name.slice(0, 2))
    await nextTick()
    store.updatePropertyField(iri, fieldId, 'name', name)
    store.endHistoryGroup()
  }
  const copyId = store.copyProperty(iri, fieldId)
  await nextTick()
  store.undo()
  assert.equal(store.nodeShapes[0].properties.length, 1)
  assert.equal(store.nodeShapes[0].properties[0].name, 'Second edit')
  store.undo()
  assert.equal(store.nodeShapes[0].properties[0].name, 'First edit')
  store.undo()
  assert.equal(store.nodeShapes[0].properties[0].name, 'Original field')
  store.redo()
  store.redo()
  store.redo()
  assert.equal(store.nodeShapes[0].properties[1].nodeId.value, copyId)
})

test('undo during an active text edit restores the entire previous title', async () => {
  const iri = store.createProfile()
  store.updateShapeField(iri, 'label', 'Before')
  await nextTick()
  store.beginHistoryGroup()
  store.updateShapeField(iri, 'label', 'A')
  await nextTick()
  store.updateShapeField(iri, 'label', 'After')
  assert.equal(store.undo(), true)
  assert.equal(store.nodeShapes[0].label, 'Before')
  assert.equal(store.redo(), true)
  assert.equal(store.nodeShapes[0].label, 'After')
})

test('canceling a text edit adds no undo step and preserves redo', async () => {
  const iri = store.createProfile()
  store.updateShapeField(iri, 'label', 'Original')
  await nextTick()
  store.updateShapeField(iri, 'label', 'Later')
  await nextTick()
  store.undo()
  store.beginHistoryGroup()
  store.updateShapeField(iri, 'label', 'Temporary')
  await nextTick()
  store.updateShapeField(iri, 'label', 'Original')
  store.endHistoryGroup()
  await nextTick()
  assert.equal(store.canRedo, true)
  assert.equal(store.redo(), true)
  assert.equal(store.nodeShapes[0].label, 'Later')
})

test('imported profiles are locked by default across every mutation path', async () => {
  await store.addProfileFromTurtle(importedTurtle, 'mps.ttl', importedProfileIri)
  await nextTick()
  const before = JSON.stringify(store.profiles)
  assert.equal(store.lockImportedProfiles, true)
  assert.equal(store.isShapeLocked(importedProfileIri), true)
  assert.equal(store.isPropertyLocked(importedProfileIri, importedFieldIri), true)

  store.updateShapeField(importedProfileIri, 'label', 'Changed')
  store.updateShapeField(importedProfileIri, 'closed', 'closed')
  store.updateShapeField(importedProfileIri, 'targetClass', 'https://example.org/class')
  store.updatePropertyField(importedProfileIri, importedFieldIri, 'name', 'Changed field')
  store.updatePropertyField(importedProfileIri, importedFieldIri, 'minCount', '9')
  store.setShapeInheritance(importedProfileIri, 'https://example.org/parent')
  store.setPropertyNodeTarget(importedProfileIri, importedFieldIri, null)
  store.setPropertyInlineNodeShape(importedProfileIri, importedFieldIri, true)
  store.setPropertyInlineNodeShapeLabel(importedProfileIri, importedFieldIri, 'Changed')
  store.setPropertyAlternativeTargets(importedProfileIri, importedFieldIri, ['https://example.org/target'])
  store.setPropertyExclusiveDatatypeAlternatives(importedProfileIri, importedFieldIri, [{ datatype: 'https://example.org/type' }])
  store.connectPropertyToShape(importedProfileIri, `ref:${importedFieldIri}`, 'https://example.org/target')
  store.setPropertyType(importedProfileIri, importedFieldIri, 'datatype')
  store.removePropertyTarget(importedProfileIri, importedFieldIri, importedProfileIri)
  assert.equal(store.createProperty(importedProfileIri), null)
  assert.equal(store.copyProperty(importedProfileIri, importedFieldIri), null)
  assert.equal(store.removeProperty(importedProfileIri, importedFieldIri), false)
  assert.equal(store.removeProfile(importedProfileIri).ok, false)
  assert.equal(JSON.stringify(store.profiles), before)
})

test('uploaded profiles are also locked, and the setting unlocks their fields', async () => {
  await store.addTurtleFiles([new File([importedTurtle], 'uploaded.ttl', { type: 'text/turtle' })])
  assert.equal(store.profiles[0].origin, 'uploaded')
  assert.equal(store.isShapeLocked(importedProfileIri), true)
  store.lockImportedProfiles = false
  store.updateShapeField(importedProfileIri, 'label', 'Editable import')
  store.updatePropertyField(importedProfileIri, importedFieldIri, 'name', 'Editable field')
  assert.equal(store.applicationProfile.findNodeShape(importedProfileIri).label, 'Editable import')
  assert.equal(store.applicationProfile.findNodeShape(importedProfileIri).properties[0].name, 'Editable field')
  store.lockImportedProfiles = true
  store.updatePropertyField(importedProfileIri, importedFieldIri, 'name', 'Blocked')
  assert.equal(store.applicationProfile.findNodeShape(importedProfileIri).properties[0].name, 'Editable field')
})

test('locked imports can be inherited, referenced, and copied into editable profiles', async () => {
  await store.addProfileFromTurtle(importedTurtle, 'mps.ttl', importedProfileIri)
  const importedBefore = JSON.stringify(store.profiles[0])
  const child = store.createProfile()
  store.setShapeInheritance(child, importedProfileIri)
  assert.equal(store.isShapeLocked(child), false)
  assert.equal(store.isPropertyLocked(child, importedFieldIri), true)
  store.updatePropertyField(child, importedFieldIri, 'name', 'Blocked inherited edit')
  assert.equal(store.removeProperty(child, importedFieldIri), false)
  const copyId = store.copyProperty(child, importedFieldIri)
  assert.ok(copyId)
  assert.equal(store.isPropertyLocked(child, copyId), false)
  store.updatePropertyField(child, copyId, 'maxCount', '3')
  store.setPropertyNodeTarget(child, copyId, importedProfileIri)
  assert.equal(store.applicationProfile.findNodeShape(child).properties.find(property => property.nodeId.value === copyId).maxCount, 3)
  const other = store.createProfile()
  const directCopyId = store.copyProperty(importedProfileIri, importedFieldIri, other)
  assert.ok(directCopyId)
  assert.equal(store.movePropertyToShape(importedProfileIri, importedFieldIri, other), false)
  assert.equal(store.movePropertyToShape(other, directCopyId, importedProfileIri), false)
  assert.equal(JSON.stringify(store.profiles.find(profile => profile.iri === importedProfileIri)), importedBefore)
  await nextTick()
  store.undo()
  store.redo()
  assert.equal(JSON.stringify(store.profiles.find(profile => profile.iri === importedProfileIri)), importedBefore)
})

test('undo cannot bypass a re-enabled import lock', async () => {
  await store.addProfileFromTurtle(importedTurtle, 'mps.ttl', importedProfileIri)
  await nextTick()
  store.lockImportedProfiles = false
  store.updateShapeField(importedProfileIri, 'label', 'Edited while unlocked')
  await nextTick()
  store.lockImportedProfiles = true
  assert.equal(store.canUndo, false)
  assert.equal(store.undo(), false)
  store.lockImportedProfiles = false
  assert.equal(store.undo(), true)
  assert.notEqual(store.applicationProfile.findNodeShape(importedProfileIri).label, 'Edited while unlocked')
})

test('the imported profile lock preference persists between editor sessions', () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  })
  try {
    assert.equal(store.lockImportedProfiles, true)
    store.lockImportedProfiles = false
    assert.equal(values.get('editor.lockImportedProfiles'), 'false')
    setActivePinia(createPinia())
    const reopened = useProfileEditorStore()
    assert.equal(reopened.lockImportedProfiles, false)
    reopened.lockImportedProfiles = true
    assert.equal(values.get('editor.lockImportedProfiles'), 'true')
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else delete globalThis.localStorage
  }
})

test('locked source connections cannot be edited, but editable fields can still reference imports', async () => {
  await store.addProfileFromTurtle(importedTurtle, 'mps.ttl', importedProfileIri)
  const ownProfile = store.createProfile()
  const ownField = store.createProperty(ownProfile)
  store.setPropertyNodeTarget(ownProfile, ownField, importedProfileIri)
  const { buildEditorStructuralEdges } = await server.ssrLoadModule('/src/presentation/features/editor/editorGraphBuilders.ts')
  const edges = buildEditorStructuralEdges(
    store.rootNodeShapes, store.nodeShapes, undefined, () => {}, undefined, undefined,
    false, false, (shapeIri, propertyNodeId) => !store.isPropertyLocked(shapeIri, propertyNodeId),
  )
  assert.equal(edges.length, 2)
  assert.equal(edges.find(edge => edge.sourceHandle === `ref:${importedFieldIri}`).data.onRemove, undefined)
  assert.equal(typeof edges.find(edge => edge.sourceHandle === `ref:${ownField}`).data.onRemove, 'function')
})

test('class and qualified profiles stay loaded while their canvas visibility is toggled independently', async () => {
  const main = 'https://example.org/main'
  const classProfile = 'https://example.org/class-profile'
  const qualifiedProfile = 'https://example.org/qualified-profile'
  const turtle = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    <${main}> a sh:NodeShape ; owl:imports <${classProfile}>, <${qualifiedProfile}> ;
      sh:property [ sh:path <https://example.org/class-field> ; sh:class <https://example.org/Class> ],
        [ sh:path <https://example.org/qualified-field> ; sh:qualifiedValueShape <${qualifiedProfile}> ],
        [ sh:path <https://example.org/inline-field> ; sh:qualifiedValueShape [
          a sh:NodeShape ; sh:property [ sh:path <https://example.org/inline-value> ]
        ] ] .
    <${classProfile}> a sh:NodeShape ; sh:targetClass <https://example.org/Class> .
    <${qualifiedProfile}> a sh:NodeShape ; sh:property [ sh:path <https://example.org/value> ] .`
  await store.addTurtleFiles([new File([turtle], 'bundle.ttl', { type: 'text/turtle' })])
  assert.equal(store.profiles.length, 3)
  assert.equal(store.nodeShapes.length, 4)
  assert.deepEqual(store.rootNodeShapes.map(shape => shape.nodeId.value), [main])
  const inlineShape = store.nodeShapes.find(shape => shape.nodeId.termType === 'BlankNode')
  assert.ok(inlineShape)
  const before = JSON.stringify(store.profiles)
  const { collectVisibleShapeNodeDescriptors } = await server.ssrLoadModule('/src/presentation/features/editor/inheritanceEditorGraph.ts')
  const { buildEditorStructuralEdges } = await server.ssrLoadModule('/src/presentation/features/editor/editorGraphBuilders.ts')
  const combinations = [
    [false, false, [main], 0],
    [true, false, [main, classProfile], 1],
    [false, true, [main, qualifiedProfile, inlineShape.nodeId.value], 2],
    [true, true, [main, classProfile, qualifiedProfile, inlineShape.nodeId.value], 3],
    [false, false, [main], 0],
  ]
  for (const [showClasses, showQualified, expectedIris, expectedEdges] of combinations) {
    const descriptors = collectVisibleShapeNodeDescriptors(store.rootNodeShapes, store.nodeShapes, new Set(), showClasses, showQualified)
    assert.deepEqual(new Set(descriptors.map(node => node.representedShapeIri)), new Set(expectedIris))
    const edges = buildEditorStructuralEdges(store.rootNodeShapes, store.nodeShapes, new Set(descriptors.map(node => node.nodeId)), undefined, undefined, undefined, showClasses, showQualified)
    assert.equal(edges.length, expectedEdges)
    assert.equal(JSON.stringify(store.profiles), before)
  }
  const exported = store.profiles.map(profile => profile.rawTurtle).join('\n')
  assert.ok(exported.includes(classProfile))
  assert.ok(exported.includes(qualifiedProfile))
  assert.ok(exported.includes('https://example.org/inline-value'))
})

test('hiding a qualified relation keeps profiles reachable through other constraints', async () => {
  const { propertyGraphTargetIris } = await server.ssrLoadModule('/src/presentation/features/editor/inheritanceEditorGraph.ts')
  const target = new NamedNode('https://example.org/shared-target')
  const property = {
    nodeId: new NamedNode('https://example.org/field'),
    qualifiedValueShape: { node: target },
    alternatives: [{ node: target }],
  }
  assert.deepEqual(propertyGraphTargetIris(property, [], false, false), [target.value])
  assert.deepEqual(propertyGraphTargetIris({ ...property, alternatives: undefined }, [], false, false), [])
  assert.deepEqual(propertyGraphTargetIris({ ...property, alternatives: undefined }, [], false, true), [target.value])
})

test('a fetched profile with a different document IRI still has a visible primary shape', async () => {
  const shapeIri = 'https://example.org/shape'
  await store.addProfileFromTurtle(`@prefix sh: <http://www.w3.org/ns/shacl#> .
    <${shapeIri}> a sh:NodeShape .`, 'fetched.ttl', 'https://example.org/document')
  assert.equal(store.rootNodeShapes[0].nodeId.value, shapeIri)
})

test('class profiles discovered without imports reach the store as hidden locked dependencies', async () => {
  const cls = 'https://example.org/store-linked-class'
  const root = 'https://example.org/store-class-root'
  const linked = 'https://example.org/store-linked-profile'
  const turtle = `@prefix sh: <http://www.w3.org/ns/shacl#> . <${linked}> a sh:NodeShape ; sh:targetClass <${cls}> .`
  mock.method(globalThis, 'fetch', async input => {
    const url = new URL(String(input))
    assert.equal(url.searchParams.get('query'), cls)
    return Response.json([{ base_url: linked, definition: turtle, mimeType: 'text/turtle' }])
  })
  try {
    await store.addProfileFromTurtle(`@prefix sh: <http://www.w3.org/ns/shacl#> .
      <${root}> a sh:NodeShape ; sh:property [ sh:path <https://example.org/ref> ; sh:class <${cls}> ] .`, 'class-root.ttl', root)
    await nextTick()
    assert.equal(store.nodeShapes.length, 2)
    assert.deepEqual(store.rootNodeShapes.map(shape => shape.nodeId.value), [root])
    assert.equal(store.isShapeLocked(linked), true)
    assert.equal(store.lastResolveErrors.length, 0)
    store.createProfile()
    await nextTick()
    assert.equal(store.undo(), true)
    assert.equal(store.profiles.length, 2)
    assert.ok(store.applicationProfile.findNodeShape(linked))
  } finally {
    mock.restoreAll()
  }
})

test('deleting the character after a space preserves the space and the grouped undo step', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  store.updatePropertyField(iri, fieldId, 'name', 'Field B')
  await nextTick()
  store.beginHistoryGroup()
  store.updatePropertyField(iri, fieldId, 'name', 'Field ')
  await nextTick()
  assert.equal(store.nodeShapes[0].properties[0].name, 'Field ')
  store.updatePropertyField(iri, fieldId, 'name', 'Field C')
  store.endHistoryGroup()
  await nextTick()
  assert.equal(store.nodeShapes[0].properties[0].name, 'Field C')
  store.undo()
  assert.equal(store.nodeShapes[0].properties[0].name, 'Field B')
  store.redo()
  assert.equal(store.nodeShapes[0].properties[0].name, 'Field C')
})

test('live profile titles and descriptions preserve whitespace while IRI fields are normalized', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  for (const value of ['A ', 'A  ', 'A  B', ' Leading space']) {
    store.updateShapeField(iri, 'label', value)
    store.updateShapeField(iri, 'description', value)
    store.updatePropertyField(iri, fieldId, 'description', value)
    await nextTick()
    assert.equal(store.nodeShapes[0].label, value)
    assert.equal(store.nodeShapes[0].description, value)
    assert.equal(store.nodeShapes[0].properties[0].description, value)
  }
  store.updatePropertyField(iri, fieldId, 'path', '  https://example.org/term  ')
  assert.equal(store.nodeShapes[0].properties[0].path.value, 'https://example.org/term')
})

test('inline qualified shape labels keep following field names through trailing spaces', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  store.setPropertyType(iri, fieldId, 'qualifiedProfile')
  store.setPropertyInlineNodeShape(iri, fieldId, true)
  store.setPropertyInlineNodeShapeLabel(iri, fieldId, 'Field B')
  store.updatePropertyField(iri, fieldId, 'name', 'Field B')
  for (const value of ['Field ', 'Field C']) {
    store.updatePropertyField(iri, fieldId, 'name', value)
    await nextTick()
    assert.equal(store.nodeShapes[0].properties[0].qualifiedValueShape.label, value)
  }
})

test('xone datatype labels can be cleared and replaced without restoring defaults or dropping spaces', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  const stringType = 'http://www.w3.org/2001/XMLSchema#string'
  const integerType = 'http://www.w3.org/2001/XMLSchema#integer'
  store.setPropertyExclusiveDatatypeAlternatives(iri, fieldId, [{ datatype: stringType }, { datatype: integerType }])
  await nextTick()
  const alternatives = () => store.nodeShapes[0].properties[0].exclusiveAlternatives
  assert.equal(alternatives()[0].label, 'String')
  store.beginHistoryGroup()
  for (const label of ['Strin', 'Stri', 'Str', 'St', 'S', '', 'T', 'Text ', 'Text label']) {
    store.setPropertyExclusiveDatatypeAlternatives(iri, fieldId, [
      { datatype: stringType, label },
      { datatype: integerType, label: alternatives()[1].label },
    ])
    await nextTick()
    assert.equal(alternatives()[0].label, label)
    assert.equal(alternatives()[1].label, 'Integer')
    assert.equal(alternatives()[0].datatype.value, stringType)
  }
  store.endHistoryGroup()
  await nextTick()
  store.undo()
  assert.equal(alternatives()[0].label, 'String')
  store.redo()
  assert.equal(alternatives()[0].label, 'Text label')
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const restored = parseShaclProfile(store.profiles[0].rawTurtle, 'xone.ttl', 'uploaded')
  assert.equal(restored.nodeShapes[0].properties[0].exclusiveAlternatives[0].label, 'Text label')
})

test('an empty xone label stays empty when another alternative is updated', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  const stringType = 'http://www.w3.org/2001/XMLSchema#string'
  const integerType = 'http://www.w3.org/2001/XMLSchema#integer'
  store.setPropertyExclusiveDatatypeAlternatives(iri, fieldId, [
    { datatype: stringType, label: '' },
    { datatype: integerType, label: 'Whole number' },
  ])
  await nextTick()
  store.setPropertyExclusiveDatatypeAlternatives(iri, fieldId, [
    { datatype: stringType, label: '' },
    { datatype: integerType, label: 'Updated label' },
  ])
  await nextTick()
  assert.equal(store.nodeShapes[0].properties[0].exclusiveAlternatives[0].label, '')
  assert.equal(store.nodeShapes[0].properties[0].exclusiveAlternatives[1].label, 'Updated label')
})

test('shape code preview uses the selected profile source and stays current without mutating data', async () => {
  const first = store.createProfile()
  const firstField = store.createProperty(first)
  store.updateShapeField(first, 'label', 'First preview profile')
  store.updatePropertyField(first, firstField, 'name', 'First field')
  const second = store.createProfile()
  store.updateShapeField(second, 'label', 'Unrelated preview profile')
  const { useEditorPreviews } = await server.ssrLoadModule('/src/presentation/features/editor/useEditorPreviews.ts')
  const previews = useEditorPreviews({ profileStore: store, profiles: computed(() => store.profiles), toast: { add() {} } })
  const before = JSON.stringify(store.profiles)
  await previews.openShapePreview(store.applicationProfile.findNodeShape(first))
  assert.equal(previews.previewShapeTurtle.value, store.profiles.find(profile => profile.iri === first).rawTurtle)
  assert.ok(previews.previewShapeTurtle.value.includes('First field'))
  assert.ok(!previews.previewShapeTurtle.value.includes('Unrelated preview profile'))
  assert.ok(previews.combinedCanvasShapesTurtle.value.includes('Unrelated preview profile'))
  assert.equal(JSON.stringify(store.profiles), before)
  store.updatePropertyField(first, firstField, 'name', 'Updated field')
  await nextTick()
  assert.ok(previews.previewShapeTurtle.value.includes('Updated field'))
})

test('inherited shape code keeps inheritance references instead of flattening source fields', async () => {
  const parent = store.createProfile()
  const parentField = store.createProperty(parent)
  store.updatePropertyField(parent, parentField, 'name', 'Inherited source field')
  const child = store.createProfile()
  store.setShapeInheritance(child, parent)
  const { useEditorPreviews } = await server.ssrLoadModule('/src/presentation/features/editor/useEditorPreviews.ts')
  const previews = useEditorPreviews({ profileStore: store, profiles: computed(() => store.profiles), toast: { add() {} } })
  await previews.openShapePreview(store.applicationProfile.findNodeShape(child))
  assert.match(previews.previewShapeTurtle.value, /sh:node/)
  assert.ok(!previews.previewShapeTurtle.value.includes('Inherited source field'))
})

test('form preview includes inherited fields once without re-importing loaded profiles or changing export', async () => {
  const parent = store.createProfile()
  const field = store.createProperty(parent)
  store.updatePropertyField(parent, field, 'name', 'Inherited field')
  const child = store.createProfile()
  store.setShapeInheritance(child, parent)
  const { useEditorPreviews } = await server.ssrLoadModule('/src/presentation/features/editor/useEditorPreviews.ts')
  const previews = useEditorPreviews({ profileStore: store, profiles: computed(() => store.profiles), toast: { add() {} } })
  const before = JSON.stringify(store.profiles)
  await previews.openShapePreview(store.applicationProfile.findNodeShape(child))
  const { Parser, Store } = await import('n3')
  const graph = new Store(new Parser().parse(previews.combinedCanvasShapesTurtle.value))
  const owlImports = 'http://www.w3.org/2002/07/owl#imports'
  assert.equal(graph.countQuads(null, owlImports, parent, null), 0)
  assert.equal(graph.countQuads(child, 'http://www.w3.org/ns/shacl#node', parent, null), 1)
  assert.equal(graph.countQuads(parent, 'http://www.w3.org/ns/shacl#property', null, null), 1)
  assert.match(previews.previewShapeTurtle.value, /owl:imports/)
  assert.equal(JSON.stringify(store.profiles), before)
})

test('preview retains external imports and distinct anonymous fields sharing a path', async () => {
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const { serializeProfilesForPreview } = await server.ssrLoadModule('/src/infrastructure/shacl/profilePreviewSerializer.ts')
  const turtle = `@prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    <https://example.org/parent> a sh:NodeShape ;
      owl:imports <https://example.org/vocabulary> ;
      sh:property [ sh:path <https://example.org/name> ; sh:minCount 1 ],
                  [ sh:path <https://example.org/name> ; sh:maxCount 1 ] .`
  const profile = parseShaclProfile(turtle, 'parent.ttl', 'uploaded')
  const before = JSON.stringify(profile)
  const { Parser, Store } = await import('n3')
  const graph = new Store(new Parser().parse(serializeProfilesForPreview([profile])))
  assert.equal(graph.countQuads(null, 'http://www.w3.org/2002/07/owl#imports', 'https://example.org/vocabulary', null), 1)
  const fields = graph.getObjects('https://example.org/parent', 'http://www.w3.org/ns/shacl#property', null)
  assert.equal(fields.length, 2)
  assert.ok(fields.every(field => field.termType === 'BlankNode'))
  assert.equal(graph.countQuads(null, 'http://www.w3.org/ns/shacl#path', 'https://example.org/name', null), 2)
  assert.equal(graph.countQuads(null, 'http://www.w3.org/ns/shacl#minCount', null, null), 1)
  assert.equal(graph.countQuads(null, 'http://www.w3.org/ns/shacl#maxCount', null, null), 1)
  assert.equal(JSON.stringify(profile), before)
})
