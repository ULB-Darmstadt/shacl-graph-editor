import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { MappingState, type MappingEdge } from '@/domain/Mapping'

export const useMappingStore = defineStore('mapping', () => {
  const state = reactive(new MappingState()) as MappingState

  /**
   * Manually entered metadata values for "form" shapes
   * (e.g. DCAT Dataset properties like dct:title, dct:license).
   * Key: `${shapeIri}::${propPath}`, Value: string literal.
   */
  const metadataFields = ref<Record<string, string>>({})

  /**
   * Raw turtle output from `<shacl-form>` web components, keyed by the
   * metadata profile IRI. Persisted at export time as part of the
   * dataset.ttl bundle.
   */
  const metadataTurtle = ref<Record<string, string>>({})

  function set(edge: MappingEdge): void {
    state.addOrReplace(edge)
  }

  function unset(shapeIri: string, propertyPath: string): void {
    state.remove(shapeIri, propertyPath)
  }

  function setMetadata(shapeIri: string, propPath: string, value: string): void {
    const key = `${shapeIri}::${propPath}`
    if (value) metadataFields.value[key] = value
    else delete metadataFields.value[key]
  }

  function getMetadata(shapeIri: string, propPath: string): string {
    return metadataFields.value[`${shapeIri}::${propPath}`] ?? ''
  }

  function setMetadataTurtle(profileIri: string, turtle: string): void {
    if (turtle && turtle.trim().length > 0) metadataTurtle.value[profileIri] = turtle
    else delete metadataTurtle.value[profileIri]
  }

  function getCombinedMetadataTurtle(): string {
    return Object.values(metadataTurtle.value).filter(Boolean).join('\n\n')
  }

  /**
   * Imports edges from a mapping.json blob (as exported by RO-Crate bundle).
   * Returns how many edges were applied and how many were skipped.
   */
  function importFromJson(json: string): { imported: number; skipped: number } {
    let imported = 0
    let skipped = 0
    try {
      const parsed = JSON.parse(json)
      const edges: unknown[] = Array.isArray(parsed) ? parsed : parsed?.edges ?? []
      for (const edge of edges) {
        if (
          typeof edge === 'object' && edge !== null
          && typeof (edge as Record<string, unknown>).sourceId === 'string'
          && typeof (edge as Record<string, unknown>).sourceHeader === 'string'
          && typeof (edge as Record<string, unknown>).shapeIri === 'string'
          && typeof (edge as Record<string, unknown>).propertyPath === 'string'
        ) {
          state.addOrReplace(edge as MappingEdge)
          imported++
        } else {
          skipped++
        }
      }
    } catch {
      skipped++
    }
    return { imported, skipped }
  }

  function reset(): void {
    state.clear()
    metadataFields.value = {}
    metadataTurtle.value = {}
  }

  return {
    state,
    metadataFields,
    metadataTurtle,
    set,
    unset,
    setMetadata,
    getMetadata,
    setMetadataTurtle,
    getCombinedMetadataTurtle,
    importFromJson,
    reset,
  }
})
