<script setup lang="ts">
defineProps<{
  label: string
  value?: string | null
  placeholder?: string
  mode?: 'inclusive' | 'exclusive' | null
  editable?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:value', value: string): void
  (event: 'update:mode', value: 'inclusive' | 'exclusive'): void
}>()
</script>

<template>
  <label class="constraint-field">
    <span class="constraint-field__label ui-sidepanel-field-label">{{ label }}</span>
    <div class="constraint-field__row">
      <input
        v-if="editable"
        class="constraint-field__input ui-sidepanel-field-input"
        :placeholder="placeholder ?? 'Not defined'"
        :value="value ?? ''"
        @input="emit('update:value', ($event.target as HTMLInputElement).value)"
      >
      <div v-else class="constraint-field__input ui-sidepanel-field-input" :class="{ 'is-placeholder': !value }">
        <span class="ui-sidepanel-field-value">{{ value ?? placeholder ?? 'Not defined' }}</span>
      </div>

      <div class="constraint-field__modes">
        <button
          type="button"
          class="constraint-mode ui-sidepanel-choice"
          :class="{ active: mode === 'inclusive' }"
          @click="emit('update:mode', 'inclusive')"
        >
          <span class="constraint-mode__dot" />
          Inclusive
        </button>
        <button
          type="button"
          class="constraint-mode ui-sidepanel-choice"
          :class="{ active: mode === 'exclusive' }"
          @click="emit('update:mode', 'exclusive')"
        >
          <span class="constraint-mode__dot" />
          Exclusive
        </button>
      </div>
    </div>
  </label>
</template>

<style scoped lang="scss">
.constraint-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.constraint-field__row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.constraint-field__input {
  min-width: 160px;
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-1) 100%);
  box-shadow: var(--shadow-sm), inset 0 -2px 0 var(--color-border-soft);
  font: inherit;
  color: var(--color-text);
}

.constraint-field__input.is-placeholder {
  color: var(--color-text-muted);
}

.constraint-field__modes {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-1) 100%);
  box-shadow: var(--shadow-sm);
}

.constraint-mode {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.constraint-mode__dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid var(--color-primary);
  display: inline-block;
  position: relative;
}

.constraint-mode.active {
  color: var(--color-text);
}

.constraint-mode.active .constraint-mode__dot::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 999px;
  background: var(--color-primary);
}
</style>
