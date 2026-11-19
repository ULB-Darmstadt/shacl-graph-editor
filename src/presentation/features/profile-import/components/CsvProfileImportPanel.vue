<script setup lang="ts">
import { computed, ref } from 'vue'
import Message from 'primevue/message'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { analyzeCsv, type CsvHeaderMode } from '@/application/profiles/csvProfile'
import { useProfileEditorStore } from '@/application/profiles/profileEditorStore'

const emit = defineEmits<{ added: [] }>()
const store = useProfileEditorStore()
const toast = useToast()
const text = ref<string | null>(null)
const filename = ref('')
const headerMode = ref<CsvHeaderMode>('auto')
const delimiter = ref('auto')
const loading = ref(false)
const error = ref('')
const preview = computed(() => {
  if (text.value === null) return null
  try { return { result: analyzeCsv(text.value, headerMode.value, delimiter.value), error: '' } }
  catch (err) { return { result: null, error: err instanceof Error ? err.message : String(err) } }
})

async function readFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  text.value = null
  error.value = ''
  loading.value = true
  try {
    const contents = await file.text()
    filename.value = file.name
    text.value = contents
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
    input.value = ''
  }
}

function createProfile() {
  if (loading.value || text.value === null || !preview.value?.result) return
  try {
    store.addCsvProfile(text.value, filename.value, headerMode.value, delimiter.value)
    toast.add({ severity: 'success', summary: 'Profile created', detail: `${filename.value}: ${preview.value.result.columns.length} fields added.`, life: 3500 })
    emit('added')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}
</script>

<template>
  <section class="csv-import-panel" aria-label="Create profile from CSV">
    <h3>Create profile from CSV</h3>
    <label class="csv-control">
      <span>CSV file</span>
      <input type="file" accept=".csv,text/csv" :disabled="loading" @change="readFile" />
    </label>
    <div class="csv-options">
      <label class="csv-control">
        <span>Headers</span>
        <select v-model="headerMode">
          <option value="auto">Detect automatically</option>
          <option value="present">First row contains headers</option>
          <option value="absent">No headers</option>
        </select>
      </label>
      <label class="csv-control">
        <span>Separator</span>
        <select v-model="delimiter">
          <option value="auto">Detect automatically</option>
          <option value=",">Comma</option>
          <option value=";">Semicolon</option>
          <option :value="'\t'">Tab</option>
        </select>
      </label>
    </div>
    <p>Automatic detection assumes headers when the first row contains only text. For text-only data without headers, choose “No headers”. Empty column names become “Unnamed field”.</p>
    <Message v-if="error || preview?.error" severity="error" :closable="false">{{ error || preview?.error }}</Message>
    <p v-if="loading" role="status">Reading CSV…</p>
    <template v-if="preview?.result">
      <p role="status">{{ filename }} · {{ preview.result.rowCount }} data rows · {{ preview.result.hasHeaders ? 'First row used as headers' : 'No headers' }}</p>
      <p>Separator: {{ preview.result.delimiter === ';' ? 'Semicolon' : preview.result.delimiter === '\t' ? 'Tab' : 'Comma' }}</p>
      <p>Types use all non-empty values. Mixed or empty columns use text.</p>
      <div class="csv-preview">
        <table>
          <caption>Fields to create</caption>
          <thead><tr><th scope="col">Column</th><th scope="col">Field</th><th scope="col">Data type</th></tr></thead>
          <tbody>
            <tr v-for="(column, index) in preview.result.columns" :key="index">
              <td>{{ index + 1 }}</td><td>{{ column.name }}</td><td>{{ column.datatype.split('#')[1] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <Button label="Create profile" icon="pi pi-plus" :disabled="loading || !preview?.result" @click="createProfile" />
  </section>
</template>

<style scoped>
.csv-import-panel { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3); min-height: 0; overflow: auto; }
h3, p { margin: 0; }
p { font-size: 0.875rem; }
.csv-control { display: flex; flex-direction: column; gap: var(--space-2); }
.csv-options { display: flex; flex-wrap: wrap; gap: var(--space-3); }
select { padding: var(--space-2); color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; }
.csv-preview { max-height: 18rem; overflow: auto; }
table { width: 100%; border-collapse: collapse; text-align: left; }
caption { text-align: left; font-weight: 600; }
th, td { padding: var(--space-2); border-bottom: 1px solid var(--color-border); overflow-wrap: anywhere; }
</style>
