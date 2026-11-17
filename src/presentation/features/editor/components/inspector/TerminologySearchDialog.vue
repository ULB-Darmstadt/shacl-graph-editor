<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import Dialog from 'primevue/dialog'
import TerminologyResultCard from './TerminologyResultCard.vue'
import { useTerminologySearch } from '@/presentation/features/editor/useTerminologySearch'
import { selectableTerminologyResult, type TerminologyFacet, type TerminologyResult } from '@/infrastructure/external/terminologySearchService'
defineProps<{ fieldName: string }>()
const emit = defineEmits<{ select: [iri: string]; close: [] }>()
const { query, types, ontologies, exact, obsolete, page, rows, results, total, typeFacets, ontologyFacets, loading, error, suggestions, pages, search, submit, reset, clearFilters } = useTerminologySearch()
const ontologySearch = ref('')
const suggestionOpen = ref(false)
const suggestionIndex = ref(-1)
const suggestionId = useId()
const hasSuggestions = computed(() => suggestionOpen.value && suggestions.value.length > 0)
function withSelected(facets: TerminologyFacet[], selected: string[]) {
  return [...facets, ...selected.filter(key => !facets.some(facet => facet.key === key)).map(key => ({ key, count: 0 }))]
}
const displayedTypes = computed(() => withSelected(typeFacets.value, types.value))
const displayedOntologies = computed(() => withSelected(ontologyFacets.value, ontologies.value).filter(facet => facet.key.toLowerCase().includes(ontologySearch.value.trim().toLowerCase())))
const first = computed(() => total.value ? Math.min(page.value * rows.value + 1, total.value) : 0)
const last = computed(() => Math.min((page.value + 1) * rows.value, total.value))
const pageButtons = computed(() => {
  const start = Math.min(Math.max(0, page.value - 2), Math.max(0, pages.value - 5))
  return Array.from({ length: Math.min(pages.value, 5) }, (_, index) => start + index)
})
function submitQuery(value = query.value) { suggestionOpen.value = false; suggestionIndex.value = -1; submit(value) }
function resetSearch() { suggestionOpen.value = false; ontologySearch.value = ''; reset() }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && hasSuggestions.value) { event.preventDefault(); event.stopPropagation(); suggestionOpen.value = false }
  if (event.key === 'ArrowDown' && hasSuggestions.value) { event.preventDefault(); suggestionIndex.value = (suggestionIndex.value + 1) % suggestions.value.length }
  if (event.key === 'ArrowUp' && hasSuggestions.value) { event.preventDefault(); suggestionIndex.value = (suggestionIndex.value - 1 + suggestions.value.length) % suggestions.value.length }
  if (event.key === 'Enter') { event.preventDefault(); submitQuery(hasSuggestions.value && suggestionIndex.value >= 0 ? suggestions.value[suggestionIndex.value].label : query.value) }
}
function useTerm(result: TerminologyResult) { if (selectableTerminologyResult(result)) emit('select', result.iri) }
</script>
<template>
  <Dialog :visible="true" modal header="Search terminology" class="terminology-search-dialog" :style="{ width: 'min(1200px, 96vw)', maxHeight: '92vh' }" @update:visible="!$event && emit('close')">
    <div class="terminology-search">
      <p class="terminology-search__hint">Find a property term for {{ fieldName || 'this field' }}. Add a result to replace only its Term IRI.</p>
      <form class="terminology-search__bar" @submit.prevent="submitQuery()">
        <div class="terminology-search__query">
          <input v-model="query" type="search" role="combobox" aria-label="Search terminology" aria-autocomplete="list" :aria-expanded="hasSuggestions" :aria-controls="suggestionId" :aria-activedescendant="hasSuggestions && suggestionIndex >= 0 ? `${suggestionId}-${suggestionIndex}` : undefined" autocomplete="off" placeholder="Search ontology terms" @focus="suggestionOpen = true" @input="suggestionOpen = true; suggestionIndex = -1" @blur="suggestionOpen = false" @keydown="keydown" />
          <ul v-if="hasSuggestions" :id="suggestionId" class="terminology-search__suggestions" role="listbox" aria-label="Search suggestions">
            <li v-for="(suggestion, index) in suggestions" :id="`${suggestionId}-${index}`" :key="`${suggestion.label}-${index}`" role="option" :aria-selected="suggestionIndex === index" @mousedown.prevent="submitQuery(suggestion.label)"><strong>{{ suggestion.label }}</strong><small>{{ suggestion.type }}</small></li>
          </ul>
        </div>
        <button type="button" @click="resetSearch">Reset</button><button type="submit" class="terminology-search__primary">Search</button>
      </form>
      <div class="terminology-search__layout">
        <aside class="terminology-search__filters" aria-label="Terminology filters">
          <fieldset><legend>Filter by type</legend><label v-for="facet in displayedTypes" :key="facet.key" class="terminology-search__check"><input v-model="types" type="checkbox" :value="facet.key" :disabled="facet.count === 0 && !types.includes(facet.key)" /><span>{{ facet.key }} <small>({{ facet.count }})</small></span></label></fieldset>
          <fieldset><legend>Filter by ontology</legend><input v-model="ontologySearch" type="search" placeholder="Search ontologies" aria-label="Search ontologies" /><div class="terminology-search__ontology-list"><label v-for="facet in displayedOntologies" :key="facet.key" class="terminology-search__check"><input v-model="ontologies" type="checkbox" :value="facet.key" :disabled="facet.count === 0 && !ontologies.includes(facet.key)" /><span>{{ facet.key.toUpperCase() }} <small>({{ facet.count }})</small></span></label></div></fieldset>
          <button type="button" @click="clearFilters">Clear all filters</button>
        </aside>
        <section class="terminology-search__results" aria-label="Terminology search results" :aria-busy="loading">
          <div class="terminology-search__options"><label class="terminology-search__check"><input v-model="exact" type="checkbox" /> Exact match</label><label class="terminology-search__check"><input v-model="obsolete" type="checkbox" /> Show only obsolete terms</label></div>
          <p v-if="loading" role="status"><i class="pi pi-spin pi-spinner" aria-hidden="true" /> Searching terms...</p>
          <div v-else-if="error" role="alert"><p>Terminology search is unavailable. {{ error }}</p><button type="button" @click="search">Try again</button></div>
          <template v-else>
            <p role="status">Showing {{ first }} to {{ last }} of {{ total }} results</p>
            <div class="terminology-search__pagination">
              <label>Per page <select v-model.number="rows" aria-label="Results per page"><option v-for="size in [10, 25, 50, 100]" :key="size" :value="size">{{ size }}</option></select></label>
              <nav aria-label="Search result pages"><button type="button" aria-label="First page" :disabled="page === 0" @click="page = 0"><i class="pi pi-angle-double-left" aria-hidden="true" /></button><button type="button" aria-label="Previous page" :disabled="page === 0" @click="page--"><i class="pi pi-angle-left" aria-hidden="true" /></button><button v-for="number in pageButtons" :key="number" type="button" :aria-label="`Page ${number + 1}`" :aria-current="page === number ? 'page' : undefined" @click="page = number">{{ number + 1 }}</button><button type="button" aria-label="Next page" :disabled="page >= pages - 1" @click="page++"><i class="pi pi-angle-right" aria-hidden="true" /></button><button type="button" aria-label="Last page" :disabled="page >= pages - 1" @click="page = pages - 1"><i class="pi pi-angle-double-right" aria-hidden="true" /></button></nav>
            </div>
            <p v-if="!results.length">No matching terms found. Try another search or clear the filters.</p>
            <article v-for="result in results" :key="`${result.iri}-${result.ontology}`" class="terminology-search__result">
              <button type="button" class="terminology-search__add" :aria-label="`Add term: ${result.label}`" :disabled="!selectableTerminologyResult(result)" :title="selectableTerminologyResult(result) ? 'Use this Term IRI' : 'Only property terms can be used for this field.'" @click="useTerm(result)"><i class="pi pi-plus" aria-hidden="true" /></button>
              <TerminologyResultCard :result="result" />
            </article>
          </template>
        </section>
      </div>
    </div>
    <template #footer><button type="button" class="terminology-search__cancel" @click="emit('close')">Cancel</button></template>
  </Dialog>
</template>
<style scoped>
.terminology-search { display: flex; flex-direction: column; gap: 16px; color: var(--color-text); }
.terminology-search__hint, .terminology-search__results > p { margin: 0; font-size: 0.85rem; color: var(--color-text-muted); }
.terminology-search__bar, .terminology-search__options, .terminology-search__pagination { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.terminology-search__query { flex: 1; min-width: 180px; position: relative; }
.terminology-search input:not([type=checkbox]), .terminology-search select { width: 100%; min-width: 0; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 0.85rem; }
.terminology-search button, .terminology-search__cancel { padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 0.85rem; cursor: pointer; }
.terminology-search button:hover:not(:disabled) { border-color: var(--color-primary); background: var(--color-primary-soft); }
.terminology-search button:disabled { opacity: 0.45; cursor: default; }
.terminology-search input:focus-visible, .terminology-search button:focus-visible, .terminology-search select:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.terminology-search .terminology-search__primary { background: var(--color-primary); color: white; }
.terminology-search__layout { display: grid; grid-template-columns: minmax(180px, 28%) minmax(0, 1fr); gap: 20px; }
.terminology-search__filters { padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); align-self: start; }
.terminology-search fieldset { border: 0; padding: 0; margin: 0 0 20px; min-width: 0; }
.terminology-search legend { margin-bottom: 12px; font-size: 0.85rem; font-weight: 600; }
.terminology-search__check { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; overflow-wrap: anywhere; }
.terminology-search__check input { accent-color: var(--color-primary); flex-shrink: 0; }
.terminology-search__check small { color: var(--color-text-muted); }
.terminology-search__ontology-list { max-height: 340px; overflow: auto; margin-top: 12px; }
.terminology-search__results { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.terminology-search__result { display: flex; align-items: flex-start; gap: 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 16px; }
.terminology-search .terminology-search__add { color: var(--color-primary); border-color: var(--color-primary); padding: 7px 9px; flex-shrink: 0; }
.terminology-search__pagination { justify-content: space-between; }
.terminology-search__pagination label { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; }
.terminology-search__pagination select { width: auto; }
.terminology-search__pagination nav { display: flex; gap: 3px; }
.terminology-search__pagination nav button { padding: 6px 8px; }
.terminology-search__pagination [aria-current=page] { background: var(--color-primary-soft); border-color: var(--color-primary); }
.terminology-search__suggestions { position: absolute; top: 100%; left: 0; right: 0; z-index: 1; max-height: 260px; overflow: auto; list-style: none; padding: 4px; margin: 4px 0; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); box-shadow: 0 4px 12px #0002; }
.terminology-search__suggestions li { display: flex; flex-direction: column; gap: 3px; padding: 8px; cursor: pointer; font-size: 0.85rem; }
.terminology-search__suggestions li:hover, .terminology-search__suggestions [aria-selected=true] { background: var(--color-primary-soft); }
.terminology-search__suggestions small { color: var(--color-text-muted); }
@media (max-width: 700px) { .terminology-search__layout { grid-template-columns: minmax(0, 1fr); } .terminology-search__ontology-list { max-height: 140px; } }
</style>
