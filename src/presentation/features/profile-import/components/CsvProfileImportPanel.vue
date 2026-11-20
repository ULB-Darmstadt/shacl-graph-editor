<script setup lang="ts">
import { computed, ref } from 'vue'
import Message from 'primevue/message'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { analyzeCsv, parseCsv, type CsvProfileDefaults } from '@/application/profiles/csvProfile'
import { useProfileEditorStore } from '@/application/profiles/profileEditorStore'
import { SHACL_DATATYPE_OPTIONS } from '@/application/profiles/profileEditorCatalogs'

const props = defineProps<{ csvText: string; filename: string; metadataDefaults?: CsvProfileDefaults }>()
const emit = defineEmits<{ added: [iri: string]; close: []; replace: [] }>()
const store = useProfileEditorStore()
const toast = useToast()
const datatypes = ref<string[]>([])
const error = ref('')
const preview = computed(() => {
  try {
    const result = analyzeCsv(props.csvText)
    const rows = parseCsv(props.csvText, result.delimiter)
    return { result, rows: rows.slice(result.hasHeaders ? 1 : 0, (result.hasHeaders ? 1 : 0) + 10), error: '' }
  } catch (err) {
    return { result: null, rows: [], error: err instanceof Error ? err.message : String(err) }
  }
})
const separatorLabel = computed(() => preview.value.result?.delimiter === ';' ? 'Semicolon' : preview.value.result?.delimiter === '\t' ? 'Tab' : 'Comma')

function createProfile() {
  if (!preview.value.result) return
  try {
    const iri = store.addCsvProfile(props.csvText, props.filename, 'auto', 'auto', datatypes.value, props.metadataDefaults)
    toast.add({ severity: 'success', summary: 'Profile created', detail: `${props.filename}: ${preview.value.result.columns.length} fields added.`, life: 3500 })
    emit('added', iri)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}
</script>

<template>
  <section class="csv-import-panel" aria-label="Preview profile from CSV">
    <div class="csv-file">
      <span class="csv-file__icon"><i class="pi pi-file" aria-hidden="true" /></span>
      <div class="csv-file__details">
        <strong>{{ filename }}</strong>
        <span v-if="preview.result" role="status">{{ preview.result.rowCount }} data rows &middot; {{ preview.result.columns.length }} fields &middot; {{ separatorLabel }} separated</span>
        <span v-else>CSV file</span>
      </div>
      <Button label="Change file" icon="pi pi-upload" severity="secondary" text size="small" @click="emit('replace')" />
    </div>
    <p class="csv-description">Review your data before adding a profile. Each column becomes a field. Use the suggested data types or choose your own.</p>
    <Message v-if="error || preview.error" severity="error" :closable="false">{{ error || preview.error }}</Message>
    <template v-if="preview.result">
      <div class="csv-preview-heading">
        <h3>Data preview</h3>
        <span>Showing {{ preview.rows.length }} of {{ preview.result.rowCount }} rows</span>
      </div>
      <div class="csv-preview" tabindex="0" role="region" aria-label="CSV data preview">
        <table>
          <caption class="csv-sr-only">Uploaded CSV data and detected field types</caption>
          <thead>
            <tr>
              <th scope="col" class="csv-row-number">#</th>
              <th v-for="(column, index) in preview.result.columns" :key="index" scope="col">
                <span class="csv-column-name">{{ column.name }}</span>
                <select v-model="datatypes[index]" class="csv-datatype" :aria-label="`Data type for column ${index + 1}: ${column.name}`">
                  <option :value="undefined">{{ column.datatype.split('#')[1] }} (suggested)</option>
                  <option v-for="option in SHACL_DATATYPE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in preview.rows" :key="rowIndex">
              <th scope="row" class="csv-row-number">{{ rowIndex + 1 }}</th>
              <td v-for="(_, columnIndex) in preview.result.columns" :key="columnIndex">{{ row[columnIndex] || '—' }}</td>
            </tr>
            <tr v-if="!preview.rows.length"><td :colspan="preview.result.columns.length + 1" class="csv-empty">This file contains headers only. Review the field names and data types above.</td></tr>
          </tbody>
        </table>
      </div>
      <p class="csv-hint">Suggestions use all non-empty values. Mixed or empty columns suggest text. You can change each field’s data type above.</p>
    </template>
    <footer class="csv-actions">
      <Button label="Cancel" severity="secondary" outlined @click="emit('close')" />
      <Button label="Add profile" icon="pi pi-plus" :disabled="!preview.result" @click="createProfile" />
    </footer>
  </section>
</template>

<style scoped>
.csv-import-panel { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
p, h3 { margin: 0; }
.csv-file { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-1); }
.csv-file__icon { display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0; color: var(--color-primary); background: var(--color-primary-soft); border-radius: var(--radius-sm); }
.csv-file__details { display: flex; flex: 1; flex-direction: column; gap: var(--space-1); min-width: 0; }
.csv-file__details strong { overflow-wrap: anywhere; font-size: 0.9rem; }
.csv-file__details span, .csv-hint, .csv-preview-heading > span { color: var(--color-text-muted); font-size: 0.75rem; line-height: 1.5; }
.csv-description { color: var(--color-text-muted); font-size: 0.875rem; line-height: 1.5; }
select { width: 100%; padding: 9px 10px; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font: inherit; }
select:focus-visible, .csv-preview:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.csv-preview-heading { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
h3 { font-size: 0.9rem; font-weight: 600; }
.csv-preview { max-height: 320px; overflow: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 0.85rem; }
th, td { padding: 10px 14px; border-bottom: 1px solid var(--color-border); border-right: 1px solid var(--color-border); min-width: 150px; max-width: 320px; overflow-wrap: anywhere; white-space: pre-wrap; }
th:last-child, td:last-child { border-right: 0; }
tbody tr:last-child > * { border-bottom: 0; }
thead th { position: sticky; top: 0; background: var(--color-surface-2); vertical-align: top; }
tbody tr:nth-child(even) { background: var(--color-surface-1); }
.csv-row-number { min-width: 44px; width: 44px; color: var(--color-text-muted); font-weight: 400; text-align: center; }
.csv-column-name { display: block; font-weight: 600; }
.csv-datatype { display: block; min-width: 150px; margin-top: 6px; padding: 5px 6px; border-color: var(--color-border-soft); border-radius: var(--radius-sm); background: var(--color-primary-soft); color: var(--color-primary); font-size: 0.75rem; font-weight: 500; }
.csv-empty { color: var(--color-text-muted); }
.csv-actions { display: flex; justify-content: flex-end; gap: var(--space-2); padding-top: var(--space-4); border-top: 1px solid var(--color-border); }
.csv-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 560px) { .csv-file { flex-wrap: wrap; } .csv-preview-heading { flex-wrap: wrap; } }
</style>
