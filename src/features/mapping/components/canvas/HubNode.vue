<script setup lang="ts">
import Button from 'primevue/button'
import { Handle, Position } from '@vue-flow/core'
import { CANVAS_NODE_COLORS } from '@/features/mapping/canvasTheme'

type HubNodeRow = {
  label: string
  value: string
  asCode?: boolean
}

type HubNodeSection = {
  label: string
  items: string[]
}

type HubNodeAction = {
  label: string
  icon: string
  loading?: boolean
  onClick?: () => Promise<void> | void
}

const props = defineProps<{
  data: {
    title: string
    subtitle: string
    icon: string
    sourceHandleId: string
    rows: HubNodeRow[]
    section?: HubNodeSection
    action?: HubNodeAction
    theme?: {
      background?: string
      borderColor?: string
      accentColor?: string
      mutedColor?: string
      handleColor?: string
      codeBackground?: string
    }
    onOpenConfig?: () => void
    onHoverChange?: (isHovered: boolean) => void
  }
}>()

async function handleAction(): Promise<void> {
  await props.data.action?.onClick?.()
}

function openConfig(): void {
  props.data.onOpenConfig?.()
}

function setHovered(isHovered: boolean): void {
  props.data.onHoverChange?.(isHovered)
}
</script>

<template>
  <div
    class="hub-node"
    :style="{
      '--hub-node-bg': data.theme?.background ?? CANVAS_NODE_COLORS.importer.headerBackground,
      '--hub-node-border': data.theme?.borderColor ?? CANVAS_NODE_COLORS.importer.borderColor,
      '--hub-node-accent': data.theme?.accentColor ?? CANVAS_NODE_COLORS.importer.headerColor,
      '--hub-node-muted': data.theme?.mutedColor ?? CANVAS_NODE_COLORS.importer.subtleColor,
      '--hub-node-handle': data.theme?.handleColor ?? CANVAS_NODE_COLORS.importer.handleColor,
      '--hub-node-code-bg': data.theme?.codeBackground ?? CANVAS_NODE_COLORS.importer.codeBackground,
    }"
    @click="openConfig"
    @mouseenter="setHovered(true)"
    @mouseleave="setHovered(false)"
  >
    <header>
      <Handle
        :id="data.sourceHandleId"
        type="source"
        :position="Position.Right"
        class="hub-handle"
      />
      <i :class="data.icon" />
      <div>
        <strong>{{ data.title }}</strong>
        <span>{{ data.subtitle }}</span>
      </div>
    </header>

    <div class="body">
      <div v-for="row in data.rows" :key="row.label" class="row-block">
        <span class="label">{{ row.label }}</span>
        <code v-if="row.asCode">{{ row.value }}</code>
        <span v-else class="value">{{ row.value }}</span>
      </div>
    </div>

    <div v-if="data.section && data.section.items.length > 0" class="section">
      <span class="label">{{ data.section.label }}</span>
      <ul>
        <li v-for="item in data.section.items" :key="item">{{ item }}</li>
      </ul>
    </div>

    <Button
      v-if="data.action"
      :label="data.action.label"
      :icon="data.action.icon"
      size="small"
      :loading="data.action.loading"
      @click.stop="handleAction"
    />
  </div>
</template>

<style scoped lang="scss">
.hub-node {
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--hub-node-bg);
  border: 1px solid var(--hub-node-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  position: relative;
  cursor: pointer;
}

header {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

header i {
  font-size: 1rem;
  color: var(--hub-node-accent);
}

header div {
  display: flex;
  flex-direction: column;
}

header span {
  font-size: 0.8rem;
  color: var(--hub-node-muted);
}

.body,
.section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section ul {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.78rem;
  color: var(--hub-node-muted);
}

.section li,
.value {
  word-break: break-word;
}

.label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hub-node-accent);
}

code {
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--hub-node-code-bg);
  font-size: 0.75rem;
  word-break: break-all;
}

.hub-handle {
  width: 10px !important;
  height: 10px !important;
  border: 2px solid white !important;
  background: var(--hub-node-handle) !important;
}
</style>

