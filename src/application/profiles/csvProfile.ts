import { NamedNode } from 'rdflib'
import type { NodeShape, ShaclProfile } from '@/domain/profiles'
import { PREFIX_APS, PREFIX_XSD } from '@/shared/rdf/rdfConstants'
import { PLACEHOLDER_TERM_IRI_PREFIX } from '@/shared/rdf/placeholderTermIri'

export type CsvHeaderMode = 'auto' | 'present' | 'absent'
export interface CsvColumn { name: string; datatype: string }
export type CsvProfileDefaults = Pick<NodeShape, 'creator' | 'created' | 'license' | 'subject'>

/** Preserve BOM-marked Unicode and fall back to Western CSV exports when UTF-8 is invalid. */
export function decodeCsvBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be', { fatal: true }).decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** Parse quoted fields, escaped quotes and embedded newlines without discarding empty columns. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let closedQuote = false
  let touched = false
  const input = text.replace(/^\uFEFF/, '')
  function finishRow() {
    row.push(field)
    if (touched || row.length > 1 || field.trim()) rows.push(row)
    row = []; field = ''; closedQuote = false; touched = false
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') { field += '"'; i++ }
        else { quoted = false; closedQuote = true }
      } else field += char
    } else if (char === delimiter) {
      row.push(field); field = ''; closedQuote = false; touched = true
    } else if (char === '\n' || char === '\r') {
      finishRow()
      if (char === '\r' && input[i + 1] === '\n') i++
    } else if (char === '"' && !field.trim() && !closedQuote) {
      field = ''; quoted = true; touched = true
    } else if (closedQuote && (char === ' ' || char === '\t')) {
      // Exporters sometimes pad quoted cells with whitespace.
      continue
    } else {
      if (closedQuote) {
        const line = input.slice(0, i).split(/\r\n|\r|\n/).length
        throw new Error(`Invalid CSV: unexpected character after a quoted field on line ${line}. Check the separator setting and escape quotes inside quoted fields as "".`)
      }
      field += char
      if (char.trim()) touched = true
    }
  }
  if (quoted) throw new Error('Invalid CSV: a quoted field is not closed.')
  finishRow()
  return rows
}

export function detectCsvDelimiter(text: string): string {
  const candidates = [',', ';', '\t'].map(delimiter => {
    try {
      const rows = parseCsv(text, delimiter)
      const widths = new Map<number, number>()
      for (const row of rows) {
        if (row.length > 1) widths.set(row.length, (widths.get(row.length) ?? 0) + 1)
      }
      const consistentRows = Math.max(0, ...widths.values())
      return { delimiter, score: consistentRows / (rows.length || 1), columns: widths.size ? Math.max(...widths.keys()) : 0 }
    } catch { return { delimiter, score: -1, columns: 0 } }
  })
  candidates.sort((a, b) => b.score - a.score || b.columns - a.columns)
  return candidates[0].delimiter
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function inferCsvDatatype(values: string[]): string {
  const populated = values.map(value => value.trim()).filter(Boolean)
  const every = (pattern: RegExp) => populated.every(value => pattern.test(value))
  let type = 'string'
  if (populated.length) {
    if (every(/^(true|false)$/)) type = 'boolean'
    else if (every(/^[+-]?\d+$/)) type = 'integer'
    else if (every(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/)) type = 'decimal'
    else if (every(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/)) type = 'double'
    else if (populated.every(validDate)) type = 'date'
    else if (populated.every(value => {
      const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))?$/.exec(value)
      return Boolean(match && validDate(match[1]))
    })) type = 'dateTime'
  }
  return PREFIX_XSD + type
}

export function analyzeCsv(text: string, headerMode: CsvHeaderMode = 'auto', delimiter = 'auto') {
  const resolvedDelimiter = delimiter === 'auto' ? detectCsvDelimiter(text) : delimiter
  const rows = parseCsv(text, resolvedDelimiter)
  if (!rows.length) throw new Error('The CSV file is empty.')
  // Text-only tables are ambiguous: assume headers, with an explicit UI override.
  const hasHeaders = headerMode === 'present' || (headerMode === 'auto'
    && rows[0].every(value => !value.trim() || inferCsvDatatype([value]) === PREFIX_XSD + 'string'))
  const data = hasHeaders ? rows.slice(1) : rows
  const width = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0)
  const columns: CsvColumn[] = Array.from({ length: width }, (_, index) => ({
    name: (hasHeaders ? rows[0][index]?.trim() : '') || 'Unnamed field',
    datatype: inferCsvDatatype(data.map(row => row[index] ?? '')),
  }))
  return { columns, hasHeaders, rowCount: data.length, delimiter: resolvedDelimiter }
}

export function buildCsvProfile(text: string, filename: string, headerMode: CsvHeaderMode = 'auto', delimiter = 'auto', datatypes: readonly (string | undefined)[] = [], defaults: CsvProfileDefaults = {}): ShaclProfile {
  const { columns } = analyzeCsv(text, headerMode, delimiter)
  const iri = PREFIX_APS + crypto.randomUUID()
  return {
    iri, source: filename, origin: 'created', rawTurtle: '', imports: [],
    nodeShapes: [{
      nodeId: new NamedNode(iri), label: filename.replace(/\.csv$/i, ''),
      sourceProfileIri: iri, closed: false, inheritedShapeIris: [],
      creator: defaults.creator?.trim() ? defaults.creator : undefined,
      created: defaults.created?.trim() ? defaults.created : undefined,
      license: defaults.license?.trim() ? defaults.license : undefined,
      subject: defaults.subject?.trim() ? defaults.subject : undefined,
      properties: columns.map((column, order) => ({
        nodeId: new NamedNode(`${iri}#property-shape-${order + 1}`),
        path: new NamedNode(PLACEHOLDER_TERM_IRI_PREFIX + crypto.randomUUID()),
        name: column.name, datatype: new NamedNode(datatypes[order] || column.datatype), editorType: 'datatype', order,
      })),
    }],
  }
}
