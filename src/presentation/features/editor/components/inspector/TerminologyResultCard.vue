<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { terminologyProvenance, type TerminologyResult } from '@/infrastructure/external/terminologySearchService'
const props = defineProps<{ result: TerminologyResult }>()
const expanded = ref(false)
const metadata = ref<{ definedBy: string[]; appearsIn: string[] }>({ definedBy: [], appearsIn: [] })
const loading = ref(false)
const failed = ref(false)
let request: AbortController | undefined
const description = computed(() => expanded.value || props.result.description.length <= 400 ? props.result.description : `${props.result.description.slice(0, 400)}...`)
watch(() => [props.result.iri, props.result.ontology, props.result.type], async () => {
  request?.abort(); const current = new AbortController(); request = current
  loading.value = true; failed.value = false; expanded.value = false; metadata.value = { definedBy: [], appearsIn: [] }
  try { const result = await terminologyProvenance(props.result, current.signal); if (!current.signal.aborted) metadata.value = result }
  catch { if (!current.signal.aborted) failed.value = true }
  finally { if (!current.signal.aborted) loading.value = false }
}, { immediate: true })
onBeforeUnmount(() => request?.abort())
</script>
<template>
  <div class="term-result">
    <h3>{{ result.label }}</h3>
    <a v-if="/^https?:\/\//i.test(result.iri)" :href="result.iri" target="_blank" rel="noopener noreferrer">{{ result.iri }}</a>
    <span v-else class="term-result__iri">{{ result.iri }}</span>
    <span v-if="result.ontology" class="term-result__badge">{{ result.ontology }}</span>
    <section v-if="description"><h4>Description</h4><p>{{ description }} <button v-if="result.description.length > 400" type="button" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? 'Show less' : 'Show more' }}</button></p></section>
    <section v-if="metadata.definedBy.length"><h4>Defined by</h4><span v-for="name in metadata.definedBy" :key="name" class="term-result__badge">{{ name }}</span></section>
    <section v-if="metadata.appearsIn.length"><h4>Appears in</h4><span v-for="name in metadata.appearsIn" :key="name" class="term-result__badge">{{ name }}</span></section>
    <small v-if="loading">Loading metadata...</small><small v-else-if="failed">Additional metadata unavailable.</small>
  </div>
</template>
<style scoped>
.term-result { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.term-result h3 { margin: 0; font-size: 1rem; font-weight: 600; }
.term-result h4 { margin: 0 0 4px; font-size: 0.82rem; font-weight: 600; }
.term-result p { margin: 0; color: var(--color-text-muted); font-size: 0.84rem; line-height: 1.5; overflow-wrap: anywhere; white-space: pre-line; }
.term-result a, .term-result__iri { color: var(--color-primary); font-size: 0.8rem; overflow-wrap: anywhere; }
.term-result__badge { display: inline-block; margin: 0 4px 3px 0; padding: 2px 5px; border: 1px solid var(--color-border); border-radius: 3px; color: var(--color-text-muted); font-size: 0.7rem; }
.term-result small { color: var(--color-text-muted); }
.term-result button { color: var(--color-primary); background: transparent; border: 0; padding: 0; font: inherit; cursor: pointer; text-decoration: underline; }
</style>
