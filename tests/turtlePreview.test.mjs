import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'

let server
let highlightTurtleLines

before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [vue()],
    cacheDir: fileURLToPath(new URL('../node_modules/.vite-preview-tests', import.meta.url)),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: { server: createHttpServer() } },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  })
  ;({ highlightTurtleLines } = await server.ssrLoadModule('/src/presentation/features/editor/components/previews/turtleHighlighting.ts'))
})

after(async () => { await server?.close() })

test('Turtle highlighting preserves source, escaped quotes, multiline literals, and blank lines', () => {
  const source = '@prefix sh: <http://www.w3.org/ns/shacl#> .\n\n'
    + '<https://example.org/shape#id> a sh:NodeShape ;\n'
    + '  sh:description """First line\nSecond # literal line""" ;\n'
    + '  sh:name "A \\"quoted\\" name" ; sh:minCount 1 ; sh:closed false . # comment\n'
  const lines = highlightTurtleLines(source)
  assert.equal(lines.map(line => line.map(token => token.text).join('')).join('\n'), source)
  assert.equal(lines.length, source.split('\n').length)
  assert.ok(lines.flat().some(token => token.kind === 'iri' && token.text.includes('#id')))
  assert.ok(lines.flat().some(token => token.kind === 'string' && token.text.includes('# literal')))
  assert.ok(lines.flat().some(token => token.kind === 'comment' && token.text === '# comment'))
  assert.deepEqual(highlightTurtleLines(''), [[]])
})

test('code preview renders safe, read-only Turtle with line numbers and a copy action', async () => {
  const { default: TurtleCodePreview } = await server.ssrLoadModule('/src/presentation/features/editor/components/previews/TurtleCodePreview.vue')
  const source = '@prefix sh: <http://www.w3.org/ns/shacl#> .\n<https://example.org/shape> sh:name "<script>alert(1)</script>" .'
  const html = await renderToString(createSSRApp(TurtleCodePreview, { turtle: source }))
  assert.match(html, /Read-only Turtle source/)
  assert.match(html, /Copy Turtle/)
  assert.match(html, /code-gutter/)
  assert.match(html, /token-string/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script|<textarea|<input|contenteditable/i)
})
