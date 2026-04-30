import localforage from 'localforage'
import { ApplicationProfile, parseShaclProfile, type ShaclProfile } from '@/domain/NodeShape'
import { findEmbeddedTurtle } from '@/services/embeddedProfiles'

/**
 * ProfileResolver
 *
 * For each `owl:imports` IRI in any loaded profile, fetch the referenced
 * Turtle document and add it to the ApplicationProfile. Repeats until no
 * new imports appear (transitive resolution).
 *
 * Fetched documents are cached in IndexedDB (via localforage) keyed by IRI.
 */

const cache = localforage.createInstance({
  name: 'csv-rdf-mapper-v2',
  storeName: 'profile-cache',
})

interface CachedProfile {
  ttl: string
  fetchedAt: string
}

/** Maximum recursion depth to prevent runaway loops in pathological graphs. */
const MAX_DEPTH = 8

export interface ResolveResult {
  added: string[]
  errors: { iri: string; error: string }[]
}

export async function resolveImportsRecursive(ap: ApplicationProfile): Promise<ResolveResult> {
  const added: string[] = []
  const errors: { iri: string; error: string }[] = []

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const missing = collectMissingImports(ap)
    if (missing.length === 0) break

    const fetched = await Promise.allSettled(missing.map(iri => fetchProfile(iri)))
    let progressed = false
    fetched.forEach((res, idx) => {
      const iri = missing[idx]
      if (res.status === 'fulfilled') {
        ap.upsert(res.value)
        added.push(iri)
        progressed = true
      } else {
        const reason = res.reason instanceof Error ? res.reason.message : String(res.reason)
        errors.push({ iri, error: reason })
      }
    })
    if (!progressed) break
  }

  return { added, errors }
}

/** Returns IRIs that appear as `owl:imports` but aren't loaded yet. */
function collectMissingImports(ap: ApplicationProfile): string[] {
  const loaded = new Set(ap.list().map(p => p.iri))
  const wanted = new Set<string>()
  for (const profile of ap.list()) {
    for (const imp of profile.imports) {
      if (!loaded.has(imp) && isResolvable(imp)) wanted.add(imp)
    }
  }
  return Array.from(wanted)
}

/**
 * Heuristic: only attempt HTTP fetches for IRIs we can plausibly retrieve.
 * Embedded IRIs are always resolvable. For network: w3id.org and direct
 * https URLs only.
 */
function isResolvable(iri: string): boolean {
  if (findEmbeddedTurtle(iri)) return true
  return iri.startsWith('https://w3id.org/') || iri.startsWith('https://') || iri.startsWith('http://')
}

async function fetchProfile(iri: string): Promise<ShaclProfile> {
  // 1. Embedded asset (instant, no network)
  const embedded = findEmbeddedTurtle(iri)
  if (embedded) {
    return parseShaclProfile(embedded, iri, 'embedded', iri)
  }

  // 2. Check IndexedDB cache
  const cached = await cache.getItem<CachedProfile>(iri)
  if (cached) {
    return parseShaclProfile(cached.ttl, iri, 'fetched', iri)
  }

  // 3. HTTP fetch with text/turtle content negotiation
  const response = await fetch(iri, {
    headers: { Accept: 'text/turtle, application/x-turtle, */*' },
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }
  const ttl = await response.text()

  // 4. Cache and parse
  await cache.setItem<CachedProfile>(iri, { ttl, fetchedAt: new Date().toISOString() })
  return parseShaclProfile(ttl, iri, 'fetched', iri)
}

/** Clears the IndexedDB profile cache. */
export async function clearProfileCache(): Promise<void> {
  await cache.clear()
}
