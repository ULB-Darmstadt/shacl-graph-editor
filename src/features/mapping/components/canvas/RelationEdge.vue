<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@vue-flow/core'

interface RelationEdgeData {
  relationLabel?: string
  edgeKind?: 'mapping' | 'structural' | 'inherited' | 'extension'
}

const props = defineProps<EdgeProps<RelationEdgeData>>()

const edgeGeometry = computed(() => getBezierPath({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  sourcePosition: props.sourcePosition,
  targetX: props.targetX,
  targetY: props.targetY,
  targetPosition: props.targetPosition,
}))

const edgePath = computed(() => edgeGeometry.value[0])
const labelX = computed(() => edgeGeometry.value[1])
const labelY = computed(() => edgeGeometry.value[2])
const relationLabel = computed(() => props.label ?? props.data?.relationLabel ?? '')
const edgeKindClass = computed(() => `is-${props.data?.edgeKind ?? 'mapping'}`)
</script>

<template>
  <BaseEdge :id="id" :path="edgePath" :style="style" :marker-end="markerEnd" />
  <EdgeLabelRenderer>
    <div
      v-if="relationLabel"
      class="relation-edge-label nodrag nopan"
      :class="edgeKindClass"
      :style="{
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      }"
    >
      {{ relationLabel }}
    </div>
  </EdgeLabelRenderer>
</template>

<style scoped lang="scss">
.relation-edge-label {
  position: absolute;
  pointer-events: none;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.92);
  color: var(--color-text);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.01em;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
}

.is-mapping {
  background: rgba(255, 255, 255, 0.94);
  color: var(--color-text);
}

.is-structural {
  background: color-mix(in srgb, #eff6ff 88%, white);
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.is-inherited {
  background: color-mix(in srgb, var(--color-surface-2) 92%, white);
  border-color: #d1d5db;
  color: #6b7280;
}

.is-extension {
  background: color-mix(in srgb, #eff6ff 88%, white);
  color: #1d4ed8;
}
</style>