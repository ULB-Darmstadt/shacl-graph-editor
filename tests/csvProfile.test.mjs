import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

let server, analyzeCsv, parseCsv, inferCsvDatatype, useProfileEditorStore
const xsd = 'http://www.w3.org/2001/XMLSchema#'

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: fileURLToPath(new URL('../node_modules/.vite-tests', import.meta.url)),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: { server: createHttpServer() } },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  })
  ;({ analyzeCsv, parseCsv, inferCsvDatatype } = await server.ssrLoadModule('/src/application/profiles/csvProfile.ts'))
  ;({ useProfileEditorStore } = await server.ssrLoadModule('/src/application/profiles/profileEditorStore.ts'))
})
after(async () => { await server?.close() })

test('CSV parsing preserves quotes, multiline values, BOM and empty trailing cells', () => {
  assert.deepEqual(parseCsv('\uFEFFname,note,empty\r\n"A, B","said ""hello""\r\nagain",\r\n\r\n'), [
    ['name', 'note', 'empty'], ['A, B', 'said "hello"\r\nagain', ''],
  ])
  assert.deepEqual(parseCsv('a;b\n1;2', ';'), [['a', 'b'], ['1', '2']])
  assert.deepEqual(parseCsv('a\tb\n1\t2', '\t'), [['a', 'b'], ['1', '2']])
  assert.deepEqual(parseCsv('""'), [['']])
  for (const input of ['"unclosed', '"a"oops,b']) assert.throws(() => parseCsv(input), /Invalid CSV/)
  assert.throws(() => analyzeCsv(' \r\n'), /empty/)
})

test('CSV import accepts padded quoted cells and detects separators outside quotes', () => {
  assert.deepEqual(parseCsv('  "name" , \t"note" \t\r\n "Alice", "said ""hello""" '), [
    ['name', 'note'], ['Alice', 'said "hello"'],
  ])
  assert.deepEqual(parseCsv('size,note\n5",say "hello"'), [['size', 'note'], ['5"', 'say "hello"']])
  for (const delimiter of [',', ';', '\t']) {
    const text = `"name"${delimiter}"value"\r\n"A, B; C"${delimiter}"42"`
    const result = analyzeCsv(text)
    assert.equal(result.delimiter, delimiter)
    assert.equal(result.columns.length, 2)
    assert.equal(result.columns[1].datatype, xsd + 'integer')
    assert.equal(result.rowCount, 1)
  }
  assert.equal(analyzeCsv('name;value\nAlice;1,2\nBob;3,4').delimiter, ';')
  assert.equal(analyzeCsv('name,note\nAlice,"a;b;c"').delimiter, ',')
  assert.throws(() => analyzeCsv('"name";"age"\n"Alice";"42"', 'auto', ','), /line 1.*separator/)
  assert.equal(analyzeCsv('name\n"Alice"').columns.length, 1)
})

test('building tables use semicolons despite commas and quotes in architect or project names', () => {
  const result = analyzeCsv('ProjectName;City;Country;Architect;Year;ConstructionStatus;numberOfStories\r\n' +
    'Example "Tower";Lyon;France;Architect A,Architect B;2025;built;17\r\n' +
    'Example Block;Seattle;USA;Architect C;unknown;planned;8')
  assert.equal(result.delimiter, ';')
  assert.equal(result.rowCount, 2)
  assert.equal(result.columns.length, 7)
  assert.equal(result.columns[3].name, 'Architect')
  assert.equal(result.columns[4].datatype, xsd + 'string')
  assert.equal(result.columns[6].datatype, xsd + 'integer')
})

test('headers name fields, while absent and missing headers use unnamed fields', () => {
  const result = analyzeCsv('name,age,\nAlice,24,true\nBob,42,false')
  assert.equal(result.hasHeaders, true)
  assert.equal(result.rowCount, 2)
  assert.deepEqual(result.columns, [
    { name: 'name', datatype: xsd + 'string' },
    { name: 'age', datatype: xsd + 'integer' },
    { name: 'Unnamed field', datatype: xsd + 'boolean' },
  ])
  const absent = analyzeCsv('24,true\n42,false')
  assert.equal(absent.hasHeaders, false)
  assert.equal(absent.rowCount, 2)
  assert.ok(absent.columns.every(column => column.name === 'Unnamed field'))
  const textOnly = analyzeCsv('Alice,Smith\nBob,Jones', 'absent')
  assert.equal(textOnly.rowCount, 2)
  assert.ok(textOnly.columns.every(column => column.name === 'Unnamed field'))
  assert.equal(analyzeCsv('2025,2026\n1,2', 'present').columns[0].name, '2025')
  assert.deepEqual(analyzeCsv('same,same\n1,2').columns.map(column => column.name), ['same', 'same'])
  assert.equal(analyzeCsv('a\n1,2', 'present').columns[1].name, 'Unnamed field')
  assert.equal(analyzeCsv('a,b', 'present').rowCount, 0)
})

test('type inference requires consistent non-empty values and checks calendar dates', () => {
  const cases = [
    [['1', '-2', '', '3'], 'integer'], [['1', '2.5'], 'decimal'],
    [['1', '2e3'], 'double'], [['true', 'false', ''], 'boolean'],
    [['2024-02-29', '2026-11-19'], 'date'],
    [['2026-11-19T12:30:00Z', '2026-11-19T12:30:00+01:00'], 'dateTime'],
    [['2025-02-29'], 'string'], [['2026-02-30T12:30:00Z'], 'string'],
    [['2026-11-19T25:00:00Z'], 'string'], [['true', '1'], 'string'],
    [['1', 'word'], 'string'], [['', ' '], 'string'], [['https://example.org'], 'string'],
  ]
  for (const [values, type] of cases) assert.equal(inferCsvDatatype(values), xsd + type, values.join(','))
  const rows = ['number', ...Array(200).fill('1'), 'mixed'].join('\n')
  assert.equal(analyzeCsv(rows).columns[0].datatype, xsd + 'string')
})

test('CSV profiles are editable drafts with distinct fields, serialized types and atomic undo/redo', async () => {
  setActivePinia(createPinia())
  const store = useProfileEditorStore()
  const iri = store.addCsvProfile('age,age,\n1,2,true\n3,4,false', 'measurements.csv')
  await nextTick()
  const profile = store.profiles[0]
  assert.equal(profile.origin, 'created')
  assert.equal(profile.source, 'measurements.csv')
  assert.equal(store.rootNodeShapes[0].label, 'measurements')
  const fields = store.rootNodeShapes[0].properties
  assert.equal(new Set(fields.map(field => field.nodeId.value)).size, 3)
  assert.equal(new Set(fields.map(field => field.path.value)).size, 3)
  assert.deepEqual(fields.map(field => field.order), [0, 1, 2])
  assert.equal(fields[2].datatype.value, xsd + 'boolean')
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const roundtrip = parseShaclProfile(profile.rawTurtle, 'roundtrip.ttl', 'uploaded')
  assert.equal(roundtrip.nodeShapes[0].properties.length, 3)
  assert.equal(roundtrip.nodeShapes[0].properties[2].datatype.value, xsd + 'boolean')
  assert.equal(store.undo(), true)
  assert.equal(store.profiles.length, 0)
  assert.equal(store.redo(), true)
  assert.equal(store.profiles[0].iri, iri)
  assert.throws(() => store.addCsvProfile('"broken', 'broken.csv'))
  assert.equal(store.profiles.length, 1)
  store.updatePropertyField(iri, fields[0].nodeId.value, 'name', 'Updated field')
  assert.equal(store.rootNodeShapes[0].properties[0].name, 'Updated field')
})
