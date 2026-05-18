<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import ValidationResultPanel from '@/features/mapping/components/ValidationResultPanel.vue'
import type { ValidationResult } from '@/services/validation/validationTypes'

defineProps<{
  open: boolean
  result: ValidationResult | null
  error: string | null
  isValidating: boolean
  canValidate: boolean
  statusSeverity: string
  statusIcon: string
  statusLabel: string
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'open'): void
}>()
</script>

<template>
  <aside class="validation-sidebar" :class="{ open }">
    <header class="validation-sidebar-header">
      <div class="validation-sidebar-status" :class="`sev-${statusSeverity}`">
        <i :class="statusIcon" />
        <div>
          <strong>SHACL validation</strong>
          <span>{{ statusLabel }}</span>
        </div>
      </div>
      <Button
        icon="pi pi-angle-right"
        size="small"
        severity="secondary"
        text
        rounded
        @click="emit('close')"
      />
    </header>

    <div class="validation-sidebar-body">
      <Message v-if="!canValidate" severity="info" :closable="false">
        Load shapes, data, or form values to start SHACL validation.
      </Message>
      <Message v-else-if="error" severity="error" :closable="false">
        {{ error }}
      </Message>
      <div v-else-if="isValidating" class="validation-loading">
        <i class="pi pi-spin pi-spinner" />
        <span>Validation in progress...</span>
      </div>
      <ValidationResultPanel v-else-if="result" :result="result" />
    </div>
  </aside>

  <Button
    v-if="!open"
    class="validation-sidebar-tab"
    :icon="statusIcon"
    :severity="statusSeverity"
    rounded
    @click="emit('open')"
  />
</template>

<style scoped lang="scss">
.validation-sidebar {
  position: absolute;
  top: 16px;
  right: 16px;
  bottom: 16px;
  width: min(420px, calc(100vw - 48px));
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--color-surface-1) 94%, white 6%);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  transform: translateX(calc(100% + 24px));
  transition: transform 0.2s ease;
  z-index: 20;
}

.validation-sidebar.open {
  transform: translateX(0);
}

.validation-sidebar-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  justify-content: space-between;
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-2);
}

.validation-sidebar-status {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);

  i {
    font-size: 1.1rem;
    margin-top: 2px;
  }

  strong {
    display: block;
    font-size: 0.95rem;
  }

  span {
    display: block;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  &.sev-success i { color: #16a34a; }
  &.sev-warn i { color: #d97706; }
  &.sev-danger i { color: #dc2626; }
}

.validation-sidebar-body {
  flex: 1;
  overflow: auto;
  padding: var(--space-3);
}

.validation-loading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-muted);
  padding: var(--space-3);
}

.validation-sidebar-tab {
  position: absolute;
  right: 16px;
  top: 16px;
  z-index: 18;
}

@media (max-width: 900px) {
  .validation-sidebar {
    top: auto;
    left: 12px;
    right: 12px;
    bottom: 12px;
    width: auto;
    max-height: 55vh;
  }
}
</style>
