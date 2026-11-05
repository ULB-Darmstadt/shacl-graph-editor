<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PropertyShape } from '@/domain/profiles'
import { SHACL_DATATYPE_OPTIONS } from '@/application/profiles/profileEditorCatalogs'

interface ValueRow {
  value: string
  datatype: string
  language: string
}

const props = defineProps<{ values?: PropertyShape['hasValues']; disabled: boolean }>()
const emit = defineEmits<{ (event: 'update:value', value: string): void }>()
const open = ref(false)
const rows = ref<ValueRow[]>([])
const rowInputs = computed(() => [...rows.value, { value: '', datatype: 'http://www.w3.org/2001/XMLSchema#string', language: 'en' }])
const langString = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'
const canSave = computed(() => !props.disabled && rows.value.every(row =>
  (row.datatype !== '@iri' || /^[a-z][a-z0-9+.-]*:[^\s<>"{}|^`\\]+$/i.test(row.value))
  && (row.datatype !== langString || !row.language || /^[a-z]+(?:-[a-z0-9]+)*$/i.test(row.language)),
))
const options = computed(() => {
  const choices = [...SHACL_DATATYPE_OPTIONS,
    { label: 'IRI (resource)', value: '@iri' }, { label: 'Blank node', value: '@blank' }]
  for (const row of rows.value) {
    if (!choices.some(choice => choice.value === row.datatype)) choices.push({ label: row.datatype, value: row.datatype })
  }
  return choices
})
const displayValues = computed(() => (props.values ?? []).map(value => ({
  value: value.value || '""',
  type: value.termType === 'Literal' ? (value.language || value.datatype.value.split(/[/#]/).pop())
    : value.termType === 'NamedNode' ? 'IRI' : 'Blank node',
})))

function edit(): void {
  if (props.disabled) return
  rows.value = (props.values ?? []).map(value => ({
    value: value.value,
    datatype: value.termType === 'Literal' ? value.datatype.value : value.termType === 'NamedNode' ? '@iri' : '@blank',
    language: value.termType === 'Literal' ? value.language : '',
  }))
  open.value = true
}

function updateRow(index: number, field: keyof ValueRow, event: Event): void {
  const value = (event.target as HTMLInputElement | HTMLSelectElement).value
  const next = [...rows.value]
  while (next.length <= index) next.push({ value: '', datatype: 'http://www.w3.org/2001/XMLSchema#string', language: 'en' })
  next[index] = { ...next[index], [field]: value }
  rows.value = next
}

function save(): void {
  if (!canSave.value) return
  emit('update:value', JSON.stringify(rows.value))
  open.value = false
}
</script>

<template>
  <div class="allowed-values-sidebar" :class="{ 'is-invalid': !displayValues.length }">
    <span class="editable-field__label ui-sidepanel-field-label">Required Values</span>
    <div v-if="displayValues.length" class="allowed-values-sidebar__items">
      <div v-for="(item, index) in displayValues" :key="index" class="allowed-values-sidebar__item">
        <span class="allowed-values-sidebar__label">{{ item.value }}</span>
        <span class="allowed-values-sidebar__iri">{{ item.type }}</span>
      </div>
    </div>
    <p v-else class="allowed-values-sidebar__empty is-invalid">At least one value is required.</p>
    <button type="button" class="allowed-values-label-button" :disabled="disabled" @click="edit">Edit Values</button>
    <Teleport to="body">
      <div v-if="open" class="metadata-dialog" role="dialog" aria-modal="true" aria-label="Required values">
        <div class="metadata-dialog__panel">
          <div class="metadata-dialog__header">
            <h3 class="ui-sidepanel-section-title">Required Values</h3>
            <button type="button" class="metadata-dialog__close" title="Close" @click="open = false">
              <i class="pi pi-times" />
            </button>
          </div>
          <div class="allowed-value-dialog__rows">
            <div class="allowed-value-dialog__head" aria-hidden="true">
              <span>Value</span><span>Datatype</span><span />
            </div>
            <div v-for="(row, index) in rowInputs" :key="index" class="allowed-value-dialog__row">
              <input
                class="allowed-value-dialog__input ui-sidepanel-field-input"
                :value="row.value"
                placeholder="Fixed value"
                :disabled="disabled"
                :aria-label="`Required value ${index + 1}`"
                @input="updateRow(index, 'value', $event)"
              />
              <select
                class="allowed-value-dialog__input ui-sidepanel-field-input"
                :value="row.datatype"
                :disabled="disabled"
                :aria-label="`Datatype ${index + 1}`"
                @change="updateRow(index, 'datatype', $event)"
              >
                <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <button
                v-if="index < rows.length"
                type="button"
                class="allowed-value-dialog__remove"
                :disabled="disabled"
                title="Remove value"
                @click="rows.splice(index, 1)"
              >
                <i class="pi pi-times" />
              </button>
              <input
                v-if="row.datatype === langString"
                class="allowed-value-dialog__input fixed-value-language ui-sidepanel-field-input"
                :value="row.language"
                placeholder="Language, e.g. en"
                :disabled="disabled"
                :aria-label="`Language ${index + 1}`"
                @input="updateRow(index, 'language', $event)"
              />
            </div>
          </div>
          <div class="metadata-dialog__footer">
            <button type="button" class="metadata-dialog__secondary" @click="open = false">Cancel</button>
            <button type="button" class="metadata-dialog__primary" :disabled="!canSave" @click="save">Save</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
@use './inspectorValueDialogs';

.fixed-value-language { grid-column: 1 / -1; }
.metadata-dialog__header h3 { margin: 0; }
</style>
