<script setup lang="ts">
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@vue-flow/core'
import { computed } from 'vue'

const props = defineProps<EdgeProps<{ relationLabel?: string; edgeKind?: 'structural' | 'inherited'; onRemove?: () => void }>>()

const edgeKindClass = computed(() => `is-${props.data?.edgeKind ?? 'structural'}`)

const edgePath = computed(() => getBezierPath({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  sourcePosition: props.sourcePosition,
  targetX: props.targetX,
  targetY: props.targetY,
  targetPosition: props.targetPosition,
}))
</script>

<template>
  <BaseEdge :id="id" :path="edgePath[0]" :style="style" />
  <path
    class="edge-hitbox"
    :d="edgePath[0]"
    fill="none"
    stroke="transparent"
    stroke-width="18"
    @click.stop="data?.onRemove?.()"
  />
  <EdgeLabelRenderer>
    <div
      v-if="data?.relationLabel"
      class="edge-label"
      :class="edgeKindClass"
      :style="{ transform: `translate(-50%, -50%) translate(${edgePath[1]}px, ${edgePath[2]}px)` }"
    >
      {{ data.relationLabel }}
    </div>
  </EdgeLabelRenderer>
</template>

<style scoped lang="scss">
.edge-hitbox {
  cursor: pointer;
  pointer-events: stroke;
}

.edge-label {
  position: absolute;
  pointer-events: none;
  font-size: 0.72rem;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.45);
  color: #334155;
  white-space: nowrap;
}

.is-structural {
  background: rgba(248, 250, 252, 0.96);
}

.is-inherited {
  background: rgba(241, 245, 249, 0.96);
}
</style>
