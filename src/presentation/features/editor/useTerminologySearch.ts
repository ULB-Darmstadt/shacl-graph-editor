import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { searchTerminology, suggestTerminology, type TerminologyFacet, type TerminologyResult } from '@/infrastructure/external/terminologySearchService'

export function useTerminologySearch() {
  const query = ref('*')
  const appliedQuery = ref('*')
  const types = ref(['property'])
  const ontologies = ref<string[]>([])
  const exact = ref(false)
  const obsolete = ref(false)
  const page = ref(0)
  const rows = ref(10)
  const results = ref<TerminologyResult[]>([])
  const total = ref(0)
  const typeFacets = ref<TerminologyFacet[]>([])
  const ontologyFacets = ref<TerminologyFacet[]>([])
  const loading = ref(true)
  const error = ref('')
  const suggestions = ref<Array<{ label: string; type: string }>>([])
  const pages = computed(() => Math.max(1, Math.ceil(total.value / rows.value)))
  let request: AbortController | undefined
  let suggestionRequest: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let settingQuery = false
  function setQuery(value: string) { settingQuery = true; query.value = value; settingQuery = false }
  function applyQuery() {
    const next = query.value.trim() || '*'
    if (appliedQuery.value === next && page.value === 0) void search()
    else { appliedQuery.value = next; page.value = 0 }
  }
  async function search() {
    request?.abort()
    const current = new AbortController(); request = current
    loading.value = true; error.value = ''; results.value = []
    try {
      const response = await searchTerminology({ query: appliedQuery.value, types: types.value, ontologies: ontologies.value, exact: exact.value, obsolete: obsolete.value, page: page.value, rows: rows.value }, current.signal)
      if (current.signal.aborted || disposed) return
      const lastPage = Math.max(0, Math.ceil(response.total / rows.value) - 1)
      if (page.value > lastPage) { page.value = lastPage; return }
      results.value = response.results; total.value = response.total
      typeFacets.value = response.types; ontologyFacets.value = response.ontologies
    } catch (cause) {
      if (!current.signal.aborted && !disposed) error.value = cause instanceof Error ? cause.message : 'Terminology search is unavailable.'
    } finally { if (!current.signal.aborted && !disposed) loading.value = false }
  }
  async function suggest() {
    suggestionRequest?.abort()
    const current = new AbortController(); suggestionRequest = current
    try { const values = await suggestTerminology(query.value, current.signal); if (!current.signal.aborted && !disposed) suggestions.value = values }
    catch { if (!current.signal.aborted && !disposed) suggestions.value = [] }
  }
  function submit(value = query.value) {
    clearTimeout(timer); suggestionRequest?.abort(); suggestions.value = []
    setQuery(value)
    applyQuery()
  }
  watch(query, () => {
    if (settingQuery) return
    clearTimeout(timer); suggestionRequest?.abort(); suggestions.value = []
    // Invalidate the previous request immediately, before the debounce expires.
    request?.abort(); loading.value = true; results.value = []
    timer = setTimeout(() => { applyQuery(); void suggest() }, 300)
  }, { flush: 'sync' })
  watch([types, ontologies, exact, obsolete], () => { page.value = 0 }, { deep: true, flush: 'sync' })
  watch(rows, (value, previous) => { page.value = Math.floor(page.value * previous / value) }, { flush: 'sync' })
  watch([appliedQuery, types, ontologies, exact, obsolete, page, rows], () => { void search() }, { deep: true, immediate: true })
  function reset() {
    clearTimeout(timer); suggestionRequest?.abort(); suggestions.value = []
    setQuery('*'); appliedQuery.value = '*'; types.value = ['property']; ontologies.value = []; exact.value = false; obsolete.value = false; page.value = 0
  }
  function clearFilters() { types.value = []; ontologies.value = [] }
  onBeforeUnmount(() => { disposed = true; clearTimeout(timer); request?.abort(); suggestionRequest?.abort() })
  return { query, types, ontologies, exact, obsolete, page, rows, results, total, typeFacets, ontologyFacets, loading, error, suggestions, pages, search, submit, reset, clearFilters }
}
