<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import Dialog from 'primevue/dialog'
import type { TerminologyTerm } from '@/shared/rdf/terminologySelection'

defineProps<{ fieldName: string }>()
const emit = defineEmits<{
  (event: 'select', iri: string): void
  (event: 'close'): void
}>()
const widgetContainer = ref<HTMLElement | null>(null)
const selectedTerm = shallowRef<TerminologyTerm | null>(null)
const status = ref<'ready' | 'loading' | 'empty' | 'error'>('loading')
const widgetLoaded = ref(false)
let dispose: (() => void) | undefined
let closed = false
let attempt = 0

async function loadWidget(): Promise<void> {
  const currentAttempt = ++attempt
  dispose?.()
  dispose = undefined
  selectedTerm.value = null
  status.value = 'loading'
  try {
    const { mountTerminologyWidget } = await import('./terminologyWidget')
    await nextTick()
    if (closed || currentAttempt !== attempt || !widgetContainer.value) return
    widgetLoaded.value = true
    status.value = 'ready'
    dispose = mountTerminologyWidget(widgetContainer.value, {
      onSelect: term => { if (!closed) selectedTerm.value = term },
      onStatus: value => { if (!closed) status.value = value },
    })
  } catch {
    if (!closed && currentAttempt === attempt) status.value = 'error'
  }
}

function applySelection(): void {
  if (selectedTerm.value) emit('select', selectedTerm.value.iri)
}

onMounted(loadWidget)
onBeforeUnmount(() => {
  closed = true
  dispose?.()
})
</script>

<template>
  <Dialog
    :visible="true"
    modal
    header="Search terminology"
    class="terminology-search-dialog"
    :style="{ width: 'min(1320px, 96vw)', maxHeight: '92vh' }"
    @update:visible="!$event && emit('close')"
  >
    <div class="terminology-search">
      <p class="terminology-search__hint">Find a property term for {{ fieldName || 'this field' }}. Use the filters to refine your search, then click a result to select it. Only its Term IRI will be replaced.</p>
      <div ref="widgetContainer" class="terminology-search__widget" :aria-busy="status === 'loading'" />
      <p v-if="status === 'loading'" class="terminology-search__status" role="status">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" /> {{ widgetLoaded ? 'Searching terms…' : 'Loading terminology search…' }}
      </p>
      <div v-else-if="status === 'error'" class="terminology-search__error" role="alert">
        <p>Terminology search is unavailable. Try again or enter the Term IRI manually.</p>
        <button type="button" class="metadata-dialog__secondary" @click="loadWidget">Try again</button>
      </div>
      <p v-else-if="status === 'empty' && !selectedTerm" class="terminology-search__status" role="status">No matching property terms found. Try another search.</p>

    </div>
    <template #footer>
      <section v-if="selectedTerm" class="terminology-search__selection" aria-label="Selected term" aria-live="polite">
        <strong>{{ selectedTerm.label }}</strong>
        <span v-if="selectedTerm.ontology" class="terminology-search__ontology">{{ selectedTerm.ontology }}</span>
        <a :href="/^https?:\/\//i.test(selectedTerm.iri) ? selectedTerm.iri : undefined" target="_blank" rel="noopener noreferrer">{{ selectedTerm.iri }}</a>
      </section>
      <span v-else class="terminology-search__selection-hint">Select a property term to continue.</span>
      <button type="button" class="metadata-dialog__secondary" @click="emit('close')">Cancel</button>
      <button type="button" class="metadata-dialog__primary" :disabled="!selectedTerm" @click="applySelection">Use term</button>
    </template>
  </Dialog>
</template>

<style scoped lang="scss">
@use './inspectorValueDialogs';

.terminology-search { display: flex; flex-direction: column; gap: 16px; }
.terminology-search__hint,
.terminology-search__status { margin: 0; color: var(--color-text-muted); font-size: 0.88rem; }
.terminology-search__widget { min-height: 42px; }
.terminology-search__selection {
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 3px;
  flex: 1;
  min-width: 0;
  margin-right: auto;
  text-align: left;
  overflow-wrap: anywhere;
}
.terminology-search__selection-hint { flex: 1; text-align: left; color: var(--color-text-muted); font-size: 0.85rem; }
.terminology-search__selection a { font-size: 0.82rem; color: var(--color-primary); }
.terminology-search__ontology { color: var(--color-text-muted); font-size: 0.8rem; }
.terminology-search__error { color: var(--color-text-muted); }
</style>

<style>
/* Apply EUI's base resets only inside the widget; its global reset would restyle the editor. */
:where(.terminology-search__widget, .terminology-search__widget *) { box-sizing: border-box; }
:where(.terminology-search__widget button) {
  appearance: none;
  border: 0;
  padding: 0;
  margin: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: inherit;
  cursor: pointer;
}
:where(.terminology-search__widget h1, .terminology-search__widget h2, .terminology-search__widget h3, .terminology-search__widget p) { margin: 0; }
:where(.terminology-search__widget ul, .terminology-search__widget ol) { list-style: none; margin: 0; padding: 0; }
/* EUI portals suggestions and page-size menus to body, above PrimeVue's modal. */
.euiComboBoxOptionsList, .euiPopover__panel { z-index: 1200 !important; }
.terminology-search-dialog .p-dialog-content { min-height: min(540px, 60vh); }
.terminology-search-dialog .p-dialog-footer { flex-wrap: wrap; align-items: center; }
.terminology-search-dialog .euiCard { overflow-wrap: anywhere; }
</style>
