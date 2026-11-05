import assert from 'node:assert/strict'
import { after, afterEach, before, mock, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'

let server
let ApplicationProfile
let parseShaclProfile
let resolveProfileImportsRecursive
let collectVisibleShapeNodeDescriptors
let buildEditorStructuralEdges

const prefixes = '@prefix sh: <http://www.w3.org/ns/shacl#> . @prefix owl: <http://www.w3.org/2002/07/owl#> .'

function profile(iri, turtle) {
  return parseShaclProfile(`${prefixes}\n${turtle}`, iri, 'fetched', iri)
}

function definition(iri, turtle) {
  return { base_url: iri, definition: `${prefixes}\n${turtle}`, mimeType: 'text/turtle', name: null }
}

function mockClassSearch(lookup) {
  const requests = []
  mock.method(globalThis, 'fetch', async input => {
    const url = new URL(String(input))
    assert.equal(url.origin, 'https://aims-backend.tools.coscine.dev')
    assert.equal(url.searchParams.get('includeDefinition'), 'true')
    const cls = url.searchParams.get('query')
    requests.push(cls)
    return Response.json(await lookup(cls))
  })
  return requests
}

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: fileURLToPath(new URL('../node_modules/.vite-class-tests', import.meta.url)),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: { server: createHttpServer() } },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  })
  ;({ ApplicationProfile } = await server.ssrLoadModule('/src/domain/profiles/model.ts'))
  ;({ parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts'))
  ;({ resolveProfileImportsRecursive } = await server.ssrLoadModule('/src/infrastructure/shacl/profileImportResolver.ts'))
  ;({ collectVisibleShapeNodeDescriptors } = await server.ssrLoadModule('/src/presentation/features/editor/inheritanceEditorGraph.ts'))
  ;({ buildEditorStructuralEdges } = await server.ssrLoadModule('/src/presentation/features/editor/editorGraphBuilders.ts'))
})

afterEach(() => mock.restoreAll())
after(async () => { await server?.close() })

test('Processing Step-style class references load matching MPS profiles without owl:imports', async () => {
  const rootIri = 'https://example.org/processing-step'
  const classBase = 'https://example.org/processing-class/'
  const names = ['Tool', 'Method', 'Configuration']
  const app = new ApplicationProfile()
  app.upsert(profile(rootIri, `<${rootIri}> a sh:NodeShape ; sh:targetClass <${classBase}ProcessingStep> ;
    sh:property ${names.map(name => `[ sh:path <https://example.org/${name}> ; sh:class <${classBase}${name}> ]`).join(', ')} .`))
  const originalTurtle = app.list()[0].rawTurtle
  const requests = mockClassSearch(cls => {
    const name = names.find(name => cls === `${classBase}${name}`)
    assert.ok(name, `Unexpected class ${cls}`)
    const iri = `https://example.org/${name}-profile`
    const extra = name === 'Configuration'
      ? '; owl:imports <https://example.org/nested> ; sh:property [ sh:path <https://example.org/value> ; sh:qualifiedValueShape <https://example.org/nested> ]'
      : ''
    return [
      definition(iri, `<${iri}> a sh:NodeShape ; sh:targetClass <${cls}> ${extra} .`),
      definition(`https://example.org/unrelated-${name}`, `<https://example.org/unrelated-${name}> a sh:NodeShape ; sh:property [ sh:path <https://example.org/ref> ; sh:class <${cls}> ] .`),
    ]
  })
  const result = await resolveProfileImportsRecursive(app, {
    fetchProfile: async iri => {
      assert.equal(iri, 'https://example.org/nested')
      return profile(iri, `<${iri}> a sh:NodeShape .`)
    },
  })
  assert.deepEqual(result.errors, [])
  assert.equal(app.list().length, 5)
  assert.deepEqual(app.profiles.get(rootIri).imports, [])
  assert.equal(app.profiles.get(rootIri).rawTurtle, originalTurtle)
  assert.ok(app.list().every(entry => entry.source === entry.iri))
  assert.equal(requests.length, 6) // EN and DE, with duplicate definitions deduplicated.
  const roots = [app.findNodeShape(rootIri)]
  const hidden = collectVisibleShapeNodeDescriptors(roots, app.allNodeShapes(), new Set(), false, false)
  assert.equal(hidden.length, 1)
  const visible = collectVisibleShapeNodeDescriptors(roots, app.allNodeShapes(), new Set(), true, false)
  assert.equal(visible.length, 4)
  const edges = buildEditorStructuralEdges(roots, app.allNodeShapes(), new Set(visible.map(node => node.nodeId)), undefined, undefined, undefined, true, false)
  assert.equal(edges.length, 3)
  assert.equal(collectVisibleShapeNodeDescriptors(roots, app.allNodeShapes(), new Set(), true, true).length, 5)
  assert.equal(requests.length, 6)
})

test('all profiles matching a class remain visible when a class has multiple matching profiles', async () => {
  const cls = 'https://example.org/multi-class'
  const root = 'https://example.org/multi-root'
  const app = new ApplicationProfile()
  app.upsert(profile(root, `<${root}> a sh:NodeShape ; sh:property [ sh:path <https://example.org/ref> ; sh:class <${cls}> ] .`))
  mockClassSearch(() => ['one', 'two'].map(name => definition(
    `https://example.org/${name}`, `<https://example.org/${name}> a sh:NodeShape ; sh:targetClass <${cls}> .`,
  )))
  await resolveProfileImportsRecursive(app)
  const roots = [app.findNodeShape(root)]
  const nodes = collectVisibleShapeNodeDescriptors(roots, app.allNodeShapes(), new Set(), true, false)
  assert.equal(nodes.length, 3)
  assert.equal(buildEditorStructuralEdges(roots, app.allNodeShapes(), new Set(nodes.map(node => node.nodeId)), undefined, undefined, undefined, true, false).length, 2)
})

test('failed class lookups are reported and can be retried', async () => {
  const cls = 'https://example.org/retry-class'
  const root = 'https://example.org/retry-root'
  const app = new ApplicationProfile()
  app.upsert(profile(root, `<${root}> a sh:NodeShape ; sh:property [ sh:path <https://example.org/ref> ; sh:class <${cls}> ] .`))
  let failing = true
  mockClassSearch(() => {
    if (failing) throw new Error('Service unavailable')
    return [definition('https://example.org/retried', `<https://example.org/retried> a sh:NodeShape ; sh:targetClass <${cls}> .`)]
  })
  const first = await resolveProfileImportsRecursive(app)
  assert.equal(first.errors[0].iri, cls)
  assert.match(first.errors[0].error, /Service unavailable/)
  failing = false
  const second = await resolveProfileImportsRecursive(app)
  assert.deepEqual(second.errors, [])
  assert.equal(app.list().length, 2)
})

test('classes without a matching profile remain valid class constraints', async () => {
  const cls = 'https://example.org/ontology-only-class'
  const root = 'https://example.org/ontology-root'
  const app = new ApplicationProfile()
  app.upsert(profile(root, `<${root}> a sh:NodeShape ; sh:property [ sh:path <https://example.org/ref> ; sh:class <${cls}> ] .`))
  mockClassSearch(() => [])
  const result = await resolveProfileImportsRecursive(app)
  assert.deepEqual(result.errors, [])
  assert.equal(app.list().length, 1)
  assert.equal(app.findNodeShape(root).properties[0].cls.value, cls)
})

test('class lookup follows nested references and stops at already loaded class cycles', async () => {
  const firstClass = 'https://example.org/first-cycle-class'
  const secondClass = 'https://example.org/second-cycle-class'
  const app = new ApplicationProfile()
  app.upsert(profile('https://example.org/cycle-root', `<https://example.org/cycle-root> a sh:NodeShape ;
    sh:targetClass <${firstClass}> ; sh:property [ sh:path <https://example.org/ref> ; sh:class <${secondClass}> ] .`))
  const requests = mockClassSearch(cls => {
    assert.equal(cls, secondClass)
    return [definition('https://example.org/cycle-linked', `<https://example.org/cycle-linked> a sh:NodeShape ;
      sh:targetClass <${secondClass}> ; sh:property [ sh:path <https://example.org/back> ; sh:class <${firstClass}> ] .`)]
  })
  const result = await resolveProfileImportsRecursive(app)
  assert.deepEqual(result.errors, [])
  assert.equal(app.list().length, 2)
  assert.equal(requests.length, 2)
})
