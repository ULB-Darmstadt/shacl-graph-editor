<script setup lang="ts">
import { onMounted, ref } from 'vue'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Listbox from 'primevue/listbox'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { AirtableService, type AirtableTable } from '@/services/airtableService'
import { loadAirtableCredentials, saveAirtableCredentials, clearAirtableCredentials } from '@/services/credentialStore'
import { useDataStore } from '@/stores/dataStore'

const toast = useToast()
const data = useDataStore()

const emit = defineEmits<{ added: [] }>()

const pat = ref('')
const baseId = ref('')
const tables = ref<AirtableTable[]>([])
const selectedTables = ref<AirtableTable[]>([])
const isConnecting = ref(false)
const isImporting = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  const creds = await loadAirtableCredentials()
  if (creds) {
    pat.value = creds.pat
    baseId.value = creds.baseId
  }
})

async function connect(): Promise<void> {
  error.value = null
  if (!pat.value || !baseId.value) {
    error.value = 'Bitte PAT und Base-ID angeben.'
    return
  }
  isConnecting.value = true
  try {
    const svc = new AirtableService(pat.value, baseId.value)
    tables.value = await svc.listTables()
    await saveAirtableCredentials({ pat: pat.value, baseId: baseId.value })
    toast.add({ severity: 'success', summary: 'Verbunden', detail: `${tables.value.length} Tabellen gefunden.`, life: 3000 })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isConnecting.value = false
  }
}

async function importSelected(): Promise<void> {
  if (selectedTables.value.length === 0) return
  isImporting.value = true
  try {
    const svc = new AirtableService(pat.value, baseId.value)
    for (const table of selectedTables.value) {
      const records = await svc.fetchTableRecords(table.id)
      const { headers, rows, recordIds } = AirtableService.recordsToTable(records)
      data.addAirtableTable(table.name, headers, rows, recordIds)
    }
    toast.add({
      severity: 'success',
      summary: 'Import erfolgreich',
      detail: `${selectedTables.value.length} Tabelle(n) übernommen.`,
      life: 3000,
    })
    selectedTables.value = []
    emit('added')
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Import fehlgeschlagen',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    })
  } finally {
    isImporting.value = false
  }
}

async function forgetCredentials(): Promise<void> {
  await clearAirtableCredentials()
  pat.value = ''
  baseId.value = ''
  tables.value = []
  toast.add({ severity: 'info', summary: 'Zugangsdaten gelöscht', life: 2000 })
}
</script>

<template>
  <div class="airtable-panel">
    <div class="form">
      <label>
        <span>Personal Access Token</span>
        <Password v-model="pat" :feedback="false" toggle-mask placeholder="patXXXXXXXXX" fluid />
      </label>
      <label>
        <span>Base ID</span>
        <InputText v-model="baseId" placeholder="appXXXXXXXXXXXXXX" fluid />
      </label>
      <div class="form-actions">
        <Button label="Verbinden" icon="pi pi-link" :loading="isConnecting" @click="connect" />
        <Button label="Zugangsdaten vergessen" icon="pi pi-trash" severity="secondary" text @click="forgetCredentials" />
      </div>
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <div v-if="tables.length > 0" class="tables">
      <h4>Tabellen auswählen</h4>
      <Listbox
        v-model="selectedTables"
        :options="tables"
        option-label="name"
        multiple
        list-style="max-height:240px"
      />
      <Button
        label="Ausgewählte Tabellen importieren"
        icon="pi pi-download"
        :disabled="selectedTables.length === 0"
        :loading="isImporting"
        @click="importSelected"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.airtable-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 480px;
}
label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.9rem;
}
.form-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.tables {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
h4 { margin: 0; font-size: 0.95rem; }
</style>
