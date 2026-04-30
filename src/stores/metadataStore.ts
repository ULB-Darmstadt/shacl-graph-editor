import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApplicationProfile, parseShaclProfile, type ShaclProfile } from '@/domain/NodeShape'
import { resolveImportsRecursive } from '@/services/profileResolver'

/**
 * metadataStore
 *
 * Holds Dataset-Metadata SHACL profiles in a separate ApplicationProfile,
 * fully decoupled from the data-schema state in shapesStore.
 *
 * Each "root" entry corresponds to one shacl-form node on the canvas.
 * Imports pulled in via owl:imports live in the same ApplicationProfile
 * (so they're available to <shacl-form> at parse time) but are NOT
 * exposed as separate roots/forms.
 *
 * Decoupling rationale: data schemas and metadata schemas share NO state
 * with each other anymore — no flag-based filtering, no provenance hacks.
 * If a user happens to load the same TTL file in both contexts, that's
 * fine: each store keeps its own copy.
 */
export const useMetadataStore = defineStore('metadata', () => {
  /** ApplicationProfile dedicated to metadata schemas. */
  const ap = ref<ApplicationProfile>(new ApplicationProfile())

  /**
   * IRIs of user-chosen "root" metadata profiles. One shacl-form node
   * is rendered per entry on the canvas. Imports of each root live
   * inside `ap` but are not listed here.
   */
  const rootIris = ref<string[]>([])

  const isResolvingImports = ref(false)
  const lastResolveErrors = ref<{ iri: string; error: string }[]>([])

  /** Every loaded profile (roots + imports). */
  const profiles = computed<ShaclProfile[]>(() => ap.value.list())

  /** Just the user-chosen roots, in insertion order. */
  const rootProfiles = computed<ShaclProfile[]>(() => {
    const map = new Map<string, ShaclProfile>()
    for (const p of ap.value.list()) map.set(p.iri, p)
    return rootIris.value
      .map(iri => map.get(iri))
      .filter((p): p is ShaclProfile => p !== undefined)
  })

  /**
   * Concatenated raw Turtle of EVERY loaded metadata profile (roots +
   * imports). This is what gets passed to `<shacl-form data-shapes="...">`
   * because the element runs with `data-ignore-owl-imports`.
   */
  const combinedTurtle = computed(() =>
    ap.value.list().map(p => p.rawTurtle).join('\n\n'),
  )

  const hasMetadata = computed(() => rootIris.value.length > 0)

  async function resolveAllImports(): Promise<void> {
    isResolvingImports.value = true
    lastResolveErrors.value = []
    try {
      const result = await resolveImportsRecursive(ap.value)
      lastResolveErrors.value = result.errors
    } finally {
      isResolvingImports.value = false
    }
  }

  /**
   * Adds a metadata profile from raw Turtle (e.g. a bundled catalog
   * entry). The profile is registered as a "root" — i.e. one shacl-form
   * is rendered for it. Imports are resolved automatically.
   */
  async function addRootFromTurtle(
    turtle: string,
    source: string,
    iri?: string,
  ): Promise<void> {
    const profile = parseShaclProfile(turtle, source, 'embedded', iri)
    ap.value.upsert(profile)
    if (!rootIris.value.includes(profile.iri)) {
      rootIris.value = [...rootIris.value, profile.iri]
    }
    await resolveAllImports()
  }

  /** Adds uploaded TTL files as metadata roots. */
  async function addRootsFromFiles(files: File[]): Promise<void> {
    const newRoots: string[] = []
    for (const file of files) {
      const text = await file.text()
      const profile = parseShaclProfile(text, file.name, 'uploaded')
      ap.value.upsert(profile)
      if (!rootIris.value.includes(profile.iri) && !newRoots.includes(profile.iri)) {
        newRoots.push(profile.iri)
      }
    }
    if (newRoots.length > 0) {
      rootIris.value = [...rootIris.value, ...newRoots]
    }
    await resolveAllImports()
  }

  /** Removes a root + clears stored form values for it. Does not touch imports. */
  function removeRoot(iri: string): void {
    rootIris.value = rootIris.value.filter(r => r !== iri)
    ap.value.profiles.delete(iri)
  }

  function reset(): void {
    ap.value = new ApplicationProfile()
    rootIris.value = []
    lastResolveErrors.value = []
  }

  return {
    ap,
    profiles,
    rootIris,
    rootProfiles,
    combinedTurtle,
    hasMetadata,
    isResolvingImports,
    lastResolveErrors,
    addRootFromTurtle,
    addRootsFromFiles,
    removeRoot,
    reset,
  }
})
