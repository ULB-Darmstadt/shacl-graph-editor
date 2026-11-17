import { isQuantityIri, NUMERICAL_VARIABLE_PROFILE, type QuantityResource } from '@/application/profiles/quantityGenerator'
import type { ShaclProfile } from '@/domain/profiles'
import { fetchAimsProfileDefinition } from '@/infrastructure/external/aimsProfileService'
import { parseShaclProfile } from '@/infrastructure/shacl/shaclProfileParser'

const cache = new Map<string, QuantityResource[]>()
async function queryResources(query: string, signal: AbortSignal): Promise<QuantityResource[]> {
  const cached = cache.get(query)
  if (cached) return cached
  const response = await fetch(`https://qudt.org/fuseki/qudt/sparql?query=${encodeURIComponent(query)}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), headers: { Accept: 'application/sparql-results+json' },
  })
  if (!response.ok) throw new Error(`QUDT request failed (${response.status}).`)
  const data = await response.json()
  if (!Array.isArray(data?.results?.bindings)) throw new Error('QUDT returned an invalid response.')
  const resources = new Map<string, QuantityResource>()
  for (const row of data.results.bindings) {
    if (row.resource?.type !== 'uri' || typeof row.resource.value !== 'string' || !isQuantityIri(row.resource.value) || typeof row.label?.value !== 'string') throw new Error('QUDT returned an invalid resource.')
    resources.set(row.resource.value, { iri: row.resource.value, label: row.label.value })
  }
  const result = [...resources.values()].sort((a, b) => a.label.localeCompare(b.label))
  cache.set(query, result)
  return result
}
export function loadQuantityKinds(signal: AbortSignal): Promise<QuantityResource[]> {
  return queryResources(`SELECT DISTINCT ?resource ?label WHERE { ?resource a <http://qudt.org/schema/qudt/QuantityKind> ; <http://www.w3.org/2000/01/rdf-schema#label> ?label . FILTER(LANGMATCHES(LANG(?label), "en")) } ORDER BY ?label`, signal)
}
export function loadQuantityUnits(kind: string, signal: AbortSignal): Promise<QuantityResource[]> {
  if (!isQuantityIri(kind)) return Promise.reject(new Error('Invalid quantity kind IRI.'))
  return queryResources(`SELECT DISTINCT ?resource ?label WHERE { <${kind}> <http://qudt.org/schema/qudt/applicableUnit> ?resource . ?resource <http://www.w3.org/2000/01/rdf-schema#label> ?label . FILTER(LANGMATCHES(LANG(?label), "en")) } ORDER BY ?label`, signal)
}
/** Load the m4i shape hierarchy; vocabulary imports remain external references. */
export async function loadQuantityBaseProfiles(existing: readonly ShaclProfile[]): Promise<ShaclProfile[]> {
  const loaded = new Map(existing.flatMap(profile => profile.nodeShapes.map(shape => [shape.nodeId.value, profile] as const)))
  const result: ShaclProfile[] = []
  const queue = [NUMERICAL_VARIABLE_PROFILE]
  const visited = new Set<string>()
  for (let index = 0; index < queue.length; index += 1) {
    const iri = queue[index]
    if (visited.has(iri)) continue
    visited.add(iri)
    let profile = loaded.get(iri)
    if (!profile) {
      const definition = await fetchAimsProfileDefinition(iri, AbortSignal.timeout(20000))
      profile = parseShaclProfile(definition.text, iri, 'fetched', iri, definition.mediaType)
      if (!profile.nodeShapes.some(shape => shape.nodeId.value === iri)) throw new Error('The m4i base profile is unavailable.')
      result.push(profile)
    }
    for (const shape of profile.nodeShapes) queue.push(...(shape.inheritedShapeIris ?? []).filter(target => target.startsWith('https://w3id.org/nfdi4ing/profiles/')))
  }
  return result
}
