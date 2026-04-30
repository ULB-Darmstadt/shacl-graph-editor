<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { NodeShape, PropertyShape } from '@/domain/NodeShape'
import { classifyShape } from '@/domain/NodeShape'
import { useShapesStore } from '@/stores/shapesStore'

const props = defineProps<{ data: { shape: NodeShape } }>()
const shapes = useShapesStore()

const kind = computed(() => classifyShape(props.data.shape))
const label = computed(() => props.data.shape.label ?? localName(props.data.shape.nodeId.value))

function localName(iri: string): string {
  return iri.split(/[/#]/).filter(Boolean).pop() ?? iri
}

function propertyLabel(p: PropertyShape): string {
  return p.name ?? (p.path ? localName(p.path.value) : p.nodeId.value)
}

function isObjectRef(p: PropertyShape): boolean {
  return Boolean(p.node)
}

function refShapeLabel(p: PropertyShape): string {
  if (!p.node) return ''
  const linked = shapes.ap.findNodeShape(p.node.value)
  return linked?.label ?? localName(p.node.value)
}

function cardinality(p: PropertyShape): string {
  const min = p.minCount ?? 0
  const max = p.maxCount ?? '*'
  return `${min}..${max}`
}
</script>

<template>
  <div class="shape-node" :class="`kind-${kind}`">
    <header>
      <Handle
        id="shape-header"
        type="target"
        :position="Position.Left"
        class="handle handle-shape-target"
      />
      <i class="pi pi-bookmark" />
      <span class="label">{{ label }}</span>
    </header>

    <ul class="properties">
      <li
        v-for="p in data.shape.properties"
        :key="p.path?.value ?? p.nodeId.value"
        class="row"
        :class="{ 'is-ref': isObjectRef(p) }"
      >
        <Handle
          v-if="p.path"
          :id="`p:${p.path.value}`"
          type="target"
          :position="Position.Left"
          class="handle"
          :class="isObjectRef(p) ? 'handle-ref-target' : 'handle-target'"
        />

        <!-- FK reference property -->
        <template v-if="isObjectRef(p)">
          <i class="pi pi-link fk-icon" title="FK-Referenz" />
          <span class="prop-name">{{ propertyLabel(p) }}</span>
          <span class="fk-badge" :title="`Referenziert: ${refShapeLabel(p)}`">
            → {{ refShapeLabel(p) }}
          </span>
          <span class="prop-meta">{{ cardinality(p) }}</span>
          <Handle
            v-if="p.path"
            :id="`ref:${p.path.value}`"
            type="source"
            :position="Position.Right"
            class="handle handle-ref-source"
          />
        </template>

        <!-- Regular literal property -->
        <template v-else>
          <span class="prop-name">{{ propertyLabel(p) }}</span>
          <span v-if="p.datatype" class="type-badge">{{ localName(p.datatype.value) }}</span>
          <span class="prop-meta">{{ cardinality(p) }}</span>
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.shape-node {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 300px;
  max-width: 380px;
  font-size: 0.85rem;
  box-shadow: var(--shadow-sm);
  overflow: hidden;

  &.kind-reference {
    border-color: #f59e0b;
    header { background: #fffbeb; color: #92400e; }
  }
}

header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-accent-soft);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
  color: var(--color-accent);
}
.label { flex: 1; word-break: break-all; }

.kind-badge {
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0,0,0,0.08);
  color: inherit;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.target-class {
  margin: 0;
  padding: 4px 12px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}

.properties { list-style: none; padding: 0; margin: 0; }

.row {
  position: relative;
  padding: 5px 12px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: default;
  &:last-child { border-bottom: none; }
  &.is-ref {
    background: #fffbeb;
    &:hover { background: #fef3c7; }
  }
  &:not(.is-ref):hover { background: var(--color-surface-2); }
}

.fk-icon {
  font-size: 0.75rem;
  color: #f59e0b;
  flex-shrink: 0;
}

.prop-name {
  flex: 1;
  font-family: var(--font-mono);
  word-break: break-all;
  font-size: 0.82rem;
}

.fk-badge {
  font-size: 0.7rem;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.type-badge {
  font-size: 0.7rem;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.prop-meta {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.handle {
  width: 10px !important;
  height: 10px !important;
  border: 2px solid var(--color-surface-1) !important;
}
.handle-target      { background: var(--color-accent) !important; }
.handle-ref-target  { background: #f59e0b !important; }
.handle-ref-source  { background: #f59e0b !important; }
.handle-shape-target { background: #f59e0b !important; }
</style>
