<script setup lang="ts">
const props = defineProps<{
  label: string
  value?: string | null
  placeholder?: string
  suffix?: string
  link?: boolean
  multiline?: boolean
  showInfoIcon?: boolean
  trailingIcon?: string
}>()

const displayValue = () => props.value?.trim() ? props.value : null
</script>

<template>
  <label class="inspector-field">
    <span class="inspector-field__label-row">
      <span class="inspector-field__label ui-sidepanel-field-label">{{ label }}</span>
      <i v-if="showInfoIcon" class="pi pi-info-circle inspector-field__info ui-sidepanel-field-info" />
    </span>

    <div
      class="inspector-field__input ui-sidepanel-field-input"
      :class="{
        'is-link': link,
        'is-multiline': multiline,
        'is-placeholder': !displayValue(),
      }"
    >
      <span class="inspector-field__value ui-sidepanel-field-value">{{ displayValue() ?? placeholder ?? 'Not defined' }}</span>
      <span v-if="suffix" class="inspector-field__suffix ui-sidepanel-field-suffix">{{ suffix }}</span>
      <i v-if="trailingIcon" class="inspector-field__trailing-icon ui-sidepanel-field-icon" :class="trailingIcon" />
    </div>
  </label>
</template>

<style scoped lang="scss">
.inspector-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inspector-field__label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inspector-field__input {
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-1) 100%);
  color: var(--color-text);
  overflow-wrap: anywhere;
  box-shadow: var(--shadow-sm), inset 0 -2px 0 var(--color-border-soft);
}

.inspector-field__input.is-multiline {
  align-items: flex-start;
  line-height: 1.5;
}

.inspector-field__value {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}

.inspector-field__suffix {
  flex-shrink: 0;
  align-self: stretch;
  display: inline-flex;
  align-items: center;
  padding-left: 12px;
  border-left: 1px solid var(--color-border-strong);
}

.inspector-field__trailing-icon {
  flex-shrink: 0;
}
</style>