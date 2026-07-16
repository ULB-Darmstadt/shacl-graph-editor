<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value?: string | null
  placeholder?: string
  options: Array<{ label: string; value: string }>
  disabled?: boolean
  invalid?: boolean
  helperText?: string | null
  autoFocus?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:value', value: string): void
}>()

const listId = computed(() =>
  `autocomplete-${props.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
)

function onInput(event: Event): void {
  emit('update:value', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <label class="autocomplete-field">
    <span class="autocomplete-field__label ui-sidepanel-field-label">{{ label }}</span>

    <input
      class="autocomplete-field__input ui-sidepanel-field-input"
      :class="{ 'is-invalid': invalid }"
      :value="value ?? ''"
      :placeholder="placeholder"
      :disabled="disabled"
      :list="listId"
      :autofocus="autoFocus"
      @input="onInput"
    >

    <datalist :id="listId">
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </datalist>

    <span v-if="helperText" class="autocomplete-field__helper" :class="{ 'is-invalid': invalid }">{{ helperText }}</span>
  </label>
</template>

<style scoped lang="scss">
.autocomplete-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.autocomplete-field__input {
  width: 100%;
  min-height: 46px;
  padding: 10px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-1) 100%);
  color: var(--color-text);
  box-shadow: var(--shadow-sm), inset 0 -2px 0 var(--color-border-soft);
  font: inherit;
}

.autocomplete-field__input.is-invalid {
  border-color: #d84c4c;
  box-shadow: 0 0 0 1px rgba(216, 76, 76, 0.14), inset 0 -2px 0 rgba(216, 76, 76, 0.16);
}

.autocomplete-field__helper {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.autocomplete-field__helper.is-invalid {
  color: #b42323;
}

.autocomplete-field__input:disabled {
  cursor: not-allowed;
  color: var(--color-text-muted);
  background: linear-gradient(180deg, var(--color-surface-2) 0%, var(--color-surface-1) 100%);
  border-color: var(--color-border);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.03);
  opacity: 0.9;
}
</style>
