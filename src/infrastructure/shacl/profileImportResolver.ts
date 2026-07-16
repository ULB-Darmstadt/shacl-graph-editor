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
}

export interface ResolveResult {
  errors: Array<{ iri: string; error: string }>
}

export async function resolveProfileImportsRecursive(applicationProfile: ApplicationProfile): Promise<ResolveResult> {
  const errors: Array<{ iri: string; error: string }> = []

  while (true) {
    const missingImports = collectMissingImports(applicationProfile)
    if (missingImports.length === 0) return { errors }

    const fetchedProfiles = await Promise.allSettled(missingImports.map(iri => fetchProfile(iri)))
    let addedCount = 0

    fetchedProfiles.forEach((result, index) => {
      const iri = missingImports[index]
      if (result.status === 'fulfilled') {
        applicationProfile.upsert(result.value)
        addedCount += 1
      } else {
        errors.push({
          iri,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        })
      }
    })

    if (addedCount === 0) return { errors }
  }
}

function collectMissingImports(applicationProfile: ApplicationProfile): string[] {
  const missing = new Set<string>()

  for (const profile of applicationProfile.list()) {
    for (const importIri of profile.imports) {
      if (!applicationProfile.profiles.has(importIri)) {
        missing.add(importIri)
      }
    }
  }

  return [...missing]
}

async function fetchProfile(iri: string): Promise<ShaclProfile> {
  const cached = await cache.getItem<CachedProfile>(iri)
  if (cached?.ttl) {
    return parseShaclProfile(cached.ttl, iri, 'fetched', iri)
  }

  const legacyCached = await legacyCache.getItem<CachedProfile>(iri)
  if (legacyCached?.ttl) {
    await cache.setItem<CachedProfile>(iri, legacyCached)
    return parseShaclProfile(legacyCached.ttl, iri, 'fetched', iri)
  }

  const response = await fetch(iri, {
    headers: {
      accept: 'text/turtle, text/plain;q=0.9, */*;q=0.1',
    },
  })

  if (!response.ok) {
    throw new Error(`Import download failed: ${response.status}`)
  }

  const ttl = await response.text()
  await cache.setItem<CachedProfile>(iri, { ttl, fetchedAt: new Date().toISOString() })
  return parseShaclProfile(ttl, iri, 'fetched', iri)
}
