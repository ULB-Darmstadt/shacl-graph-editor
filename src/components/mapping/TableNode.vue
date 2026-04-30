<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { DataSource } from '@/domain/DataSource'
import { useDataStore } from '@/stores/dataStore'
import { detectLinkedColumns, type LinkedColumnInfo } from '@/services/linkDetector'

const props = defineProps<{ data: { source: DataSource } }>()
const dataStore = useDataStore()

/** Detected linked-record columns, indexed by header name. */
const linkInfo = computed<Map<string, LinkedColumnInfo>>(() => {
  const map = new Map<string, LinkedColumnInfo>()
  const detected = detectLinkedColumns(props.data.source, dataStore.sources)
  for (const info of detected) map.set(info.header, info)
  return map
})
</script>

<template>
  <div class="table-node">
    <header>
      <i class="pi pi-table" />
      <span class="name">{{ data.source.name }}</span>
    </header>
    <ul class="headers">
      <li
        v-for="header in data.source.headers"
        :key="header"
        class="row"
        :class="{ 'is-link': linkInfo.has(header) }"
      >
        <i v-if="linkInfo.has(header)" class="pi pi-link link-icon" />
        <span class="header-name">{{ header }}</span>
        <Handle
          :id="`h:${header}`"
          type="source"
          :position="Position.Right"
          class="handle"
          :class="linkInfo.has(header) ? 'handle-link' : 'handle-source'"
        />
      </li>
    </ul>
    <footer class="meta">
      {{ data.source.rows.length }} Zeilen
    </footer>
  </div>
</template>

<style scoped lang="scss">
.table-node {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 260px;
  max-width: 340px;
  font-size: 0.85rem;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
}
.name { flex: 1; word-break: break-all; }
.badge {
  font-size: 0.7rem;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  padding: 2px 6px;
  border-radius: 999px;
  text-transform: uppercase;
}

.headers { list-style: none; padding: 0; margin: 0; }
.row {
  position: relative;
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 6px;
  &:last-child { border-bottom: none; }

  &.is-link {
    background: #fffbeb;
    &:hover { background: #fef3c7; }
  }
  &:not(.is-link):hover { background: var(--color-surface-2); }
}

.link-icon {
  font-size: 0.75rem;
  color: #f59e0b;
  flex-shrink: 0;
}

.header-name {
  flex: 1;
  font-family: var(--font-mono);
  word-break: break-all;
}

.link-target-badge {
  font-size: 0.7rem;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.handle {
  width: 10px !important;
  height: 10px !important;
  border: 2px solid var(--color-surface-1) !important;
}
.handle-source { background: var(--color-accent) !important; }
.handle-link   { background: #f59e0b !important; }

.meta {
  padding: 6px 12px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-2);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.link-count { color: #92400e; }
</style>
