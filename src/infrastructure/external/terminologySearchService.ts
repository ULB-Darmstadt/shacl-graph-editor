import { terminologyTerm, type TerminologyTerm } from '@/shared/rdf/terminologySelection'

export const TERMINOLOGY_API = import.meta.env.VITE_TERMINOLOGY_API_URL || 'https://coscine.rwth-aachen.de/terminologyservice/tib/api/'
export interface TerminologyResult extends TerminologyTerm { type: string; shortForm: string }
export interface TerminologyFacet { key: string; count: number }
export interface TerminologySearchOptions { query: string; types: string[]; ontologies: string[]; exact: boolean; obsolete: boolean; page: number; rows: number }
type JsonObject = Record<string, unknown>
function object(value: unknown): JsonObject { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function validIri(value: unknown): value is string { return typeof value === 'string' && /^[a-z][a-z0-9+.-]*:[^\s<>"{}|^`\\]+$/i.test(value) }
function facets(value: unknown): TerminologyFacet[] {
  if (!Array.isArray(value)) return []
  const result: TerminologyFacet[] = []
  for (let i = 0; i + 1 < value.length; i += 2) {
    const key = String(value[i]); const count = Number(value[i + 1])
    if (key && Number.isFinite(count) && count >= 0) result.push({ key, count })
  }
  return result
}
export function parseTerminologySearch(data: unknown) {
  const root = object(data)
  const response = object(root.response)
  const docs = Array.isArray(data) ? data : response.docs
  if (!Array.isArray(docs)) throw new Error('Terminology service returned an invalid search response.')
  const results: TerminologyResult[] = docs.flatMap(value => {
    const doc = object(value)
    if (!validIri(doc.iri)) return []
    return [{ iri: doc.iri, label: text(doc.label) || doc.iri, type: text(doc.type), ontology: text(doc.ontology_name), shortForm: text(doc.short_form), description: Array.isArray(doc.description) ? doc.description.filter(item => typeof item === 'string').join(' ') : text(doc.description) }]
  })
  const count = Number(response.numFound ?? root.total ?? results.length)
  if (!Number.isFinite(count) || count < 0) throw new Error('Terminology service returned an invalid result count.')
  const fields = object(object(root.facet_counts).facet_fields)
  return { results, total: Math.floor(count), types: facets(fields.type), ontologies: facets(fields.ontologyPreferredPrefix ?? fields.ontology_name ?? fields.ontologyId) }
}
export function terminologySearchUrl(options: TerminologySearchOptions): URL {
  const url = new URL('search', TERMINOLOGY_API.endsWith('/') ? TERMINOLOGY_API : `${TERMINOLOGY_API}/`)
  const params = { q: options.query.trim() || '*', exact: String(options.exact), obsoletes: String(options.obsolete), type: options.types.join(','), ontology: options.ontologies.join(','), groupByIri: 'true', start: String(options.page * options.rows), rows: String(options.rows), facet: 'true', 'facet.field': 'ontologyPreferredPrefix' }
  for (const [key, value] of Object.entries(params)) if (value !== '') url.searchParams.set(key, value)
  return url
}
async function request(url: URL, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Terminology request failed (${response.status}).`)
  return response.json()
}
export async function searchTerminology(options: TerminologySearchOptions, signal: AbortSignal) {
  return parseTerminologySearch(await request(terminologySearchUrl(options), signal))
}
export async function suggestTerminology(query: string, signal: AbortSignal): Promise<Array<{ label: string; type: string }>> {
  if (!query.trim() || query.trim() === '*') return []
  const url = new URL('suggest', TERMINOLOGY_API.endsWith('/') ? TERMINOLOGY_API : `${TERMINOLOGY_API}/`)
  url.searchParams.set('q', query.trim())
  const data = object(await request(url, signal)); const docs = object(data.response).docs
  if (!Array.isArray(docs)) return []
  return docs.map(value => { const doc = object(value); return { label: text(doc.autosuggest) || text(doc.label), type: text(doc.type) } }).filter(value => value.label).slice(0, 10)
}
export async function terminologyProvenance(result: TerminologyResult, signal: AbortSignal) {
  const type = /property/i.test(result.type) ? 'properties' : result.type === 'class' ? 'terms' : result.type === 'individual' ? 'individuals' : ''
  if (!type) return { definedBy: [], appearsIn: [] }
  const url = new URL(type, TERMINOLOGY_API.endsWith('/') ? TERMINOLOGY_API : `${TERMINOLOGY_API}/`)
  url.searchParams.set('iri', result.iri)
  const embedded = object(object(await request(url, signal))._embedded)
  const records = Object.values(embedded).find(Array.isArray) as unknown[] | undefined
  const names = (records ?? []).map(object)
  const primary = text(names[0]?.ontology_name) || result.ontology
  const other = names.filter(doc => text(doc.ontology_name) && doc.ontology_name !== result.ontology && doc.ontology_name !== primary)
  const definedBy = [...new Set(other.filter(doc => doc.is_defining_ontology === true).map(doc => text(doc.ontology_name)))].sort()
  const appearsIn = [...new Set(other.map(doc => text(doc.ontology_name)).filter(name => !definedBy.includes(name)))].sort()
  return { definedBy, appearsIn }
}
export function selectableTerminologyResult(result: TerminologyResult): boolean {
  return !!terminologyTerm({ ...result, ontology_name: result.ontology })
}
