<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  label: string
  value?: string | number | null
  placeholder?: string
  multiline?: boolean
  type?: 'text' | 'number' | 'date'
  options?: Array<{ label: string; value: string }>
  disabled?: boolean
  invalid?: boolean
  helperText?: string | null
  autoFocus?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:value', value: string): void
}>()

function onInput(event: Event): void {
  emit('update:value', (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value)
}

const inputRef = ref<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null)

async function focusInput(): Promise<void> {
  if (!props.autoFocus || props.disabled) return
  await nextTick()
  inputRef.value?.focus()
  if (inputRef.value instanceof HTMLInputElement || inputRef.value instanceof HTMLTextAreaElement) {
    inputRef.value.select()
  }
}

onMounted(() => {
  void focusInput()
})

watch(() => props.autoFocus, enabled => {
  if (!enabled) return
  void focusInput()
})
</script>

<template>
  <label class="editable-field">
    <span class="editable-field__label ui-sidepanel-field-label">{{ label }}</span>

    <textarea
      v-if="multiline"
      ref="inputRef"
      class="editable-field__input ui-sidepanel-field-input"
      :class="{ 'is-invalid': invalid }"
      :placeholder="placeholder"
      :value="value ?? ''"
      :disabled="disabled"
      rows="3"
      @input="onInput"
    />

    <select
      v-else-if="options"
      ref="inputRef"
      class="editable-field__input ui-sidepanel-field-input"
      :class="{ 'is-invalid': invalid }"
      :value="value ?? ''"
      :disabled="disabled"
      @change="onInput"
    >
      <option value="" hidden>{{ placeholder ?? '' }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>

    <input
      v-else
      ref="inputRef"
      class="editable-field__input ui-sidepanel-field-input"
      :class="{ 'is-invalid': invalid }"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :value="value ?? ''"
      :disabled="disabled"
      @input="onInput"
    />

    <span v-if="helperText" class="editable-field__helper" :class="{ 'is-invalid': invalid }">{{ helperText }}</span>
  </label>
</template>

<style scoped lang="scss">
.editable-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editable-field__input {
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

.editable-field__input.is-invalid {
  border-color: #d84c4c;
  box-shadow: 0 0 0 1px rgba(216, 76, 76, 0.14), inset 0 -2px 0 rgba(216, 76, 76, 0.16);
}

.editable-field__helper {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.editable-field__helper.is-invalid {
  color: #b42323;
}

textarea.editable-field__input {
  resize: vertical;
}

.editable-field__input:disabled {
  cursor: not-allowed;
  color: var(--color-text-muted);
  background: linear-gradient(180deg, var(--color-surface-2) 0%, var(--color-surface-1) 100%);
  border-color: var(--color-border);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.03);
  opacity: 0.9;
}
</style>
