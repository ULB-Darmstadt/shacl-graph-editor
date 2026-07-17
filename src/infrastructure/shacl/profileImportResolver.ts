import localforage from 'localforage'
import { ApplicationProfile, type ShaclProfile } from '@/domain/profiles'
import { parseShaclProfile } from '@/infrastructure/shacl/shaclProfileParser'

const cache = localforage.createInstance({
  name: 'shacl-editor',
  storeName: 'profile-cache',
})

const legacyCache = localforage.createInstance({
  name: 'ardmp',
  storeName: 'profile-cache',
})

interface CachedProfile {
  ttl: string
  fetchedAt: string
  mediaType?: string
}

const RDF_PROXY_URL = 'https://rdf.nfdi4ing.de/kge/api/v1/rdfproxy?url='

export interface ResolveResult {
  errors: Array<{ iri: string; error: string }>
}

export async function resolveProfileImportsRecursive(applicationProfile: ApplicationProfile): Promise<ResolveResult> {
  const errors: Array<{ iri: string; error: string }> = []
  const failedImports = new Set<string>()

  while (true) {
    const missingImports = collectMissingImports(applicationProfile, failedImports)
    if (missingImports.length === 0) return { errors }

    const fetchedProfiles = await Promise.allSettled(missingImports.map(iri => fetchProfile(iri)))
    let addedCount = 0

    fetchedProfiles.forEach((result, index) => {
      const iri = missingImports[index]
      if (result.status === 'fulfilled') {
        applicationProfile.upsert(result.value)
        addedCount += 1
      } else {
        failedImports.add(iri)
        errors.push({
          iri,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        })
      }
    })

    if (addedCount === 0) return { errors }
  }
}

function collectMissingImports(applicationProfile: ApplicationProfile, failedImports: Set<string>): string[] {
  const missing = new Set<string>()

  for (const profile of applicationProfile.list()) {
    for (const importIri of profile.imports) {
      if (!applicationProfile.profiles.has(importIri) && !failedImports.has(importIri)) {
        missing.add(importIri)
      }
    }
  }

  return [...missing]
}

async function fetchProfile(iri: string): Promise<ShaclProfile> {
  const cached = await cache.getItem<CachedProfile>(iri)
  if (cached?.ttl) {
    return parseShaclProfile(cached.ttl, iri, 'fetched', iri, cached.mediaType)
  }

  const legacyCached = await legacyCache.getItem<CachedProfile>(iri)
  if (legacyCached?.ttl) {
    await cache.setItem<CachedProfile>(iri, legacyCached)
    return parseShaclProfile(legacyCached.ttl, iri, 'fetched', iri, legacyCached.mediaType)
  }

  const fetched = await fetchProfileTextWithFallbacks(iri)
  await cache.setItem<CachedProfile>(iri, {
    ttl: fetched.text,
    fetchedAt: new Date().toISOString(),
    mediaType: fetched.mediaType,
  })
  return parseShaclProfile(fetched.text, iri, 'fetched', iri, fetched.mediaType)
}

async function fetchProfileTextWithFallbacks(iri: string): Promise<{ text: string; mediaType?: string }> {
  let lastError: unknown

  for (const candidate of buildFetchCandidates(iri)) {
    try {
      const response = await fetch(buildProxyUrl(candidate), {
        headers: {
          accept: 'text/turtle, application/ld+json, application/rdf+xml, text/plain;q=0.9, */*;q=0.1',
        },
      })

      if (!response.ok) {
        lastError = new Error(`Import download failed: ${response.status}`)
        continue
      }

      return {
        text: await response.text(),
        mediaType: response.headers.get('content-type') ?? undefined,
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Import download failed'))
}

function buildFetchCandidates(iri: string): string[] {
  const candidates = new Set<string>()
  const queue = [iri]

  if (iri.startsWith('http://')) {
    queue.unshift(`https://${iri.slice('http://'.length)}`)
  }

  for (const candidate of queue) {
    candidates.add(candidate)
    if (candidate.endsWith('/')) candidates.add(candidate.slice(0, -1))
    else candidates.add(`${candidate}/`)
  }

  return [...candidates]
}

function buildProxyUrl(targetUrl: string): string {
  return `${RDF_PROXY_URL}${encodeURIComponent(targetUrl)}`
}
