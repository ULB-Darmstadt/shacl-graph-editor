<script setup lang="ts">
import Dialog from 'primevue/dialog'
import ShapePreviewPanel from '@/presentation/features/editor/components/previews/ShapePreviewPanel.vue'
import type { NodeShape } from '@/domain/profiles'

interface PreviewSubject {
  iri: string
  label: string
}

defineProps<{
  shapePreviewOpen: boolean
  previewShape: NodeShape | null
  combinedCanvasShapesTurtle: string
  previewShapeValuesTurtle: string
  previewShapeSubjects: PreviewSubject[]
}>()

const emit = defineEmits<{
  (event: 'update:shapePreviewOpen', value: boolean): void
}>()
</script>

<template>
  <Dialog
    :visible="shapePreviewOpen"
    modal
    header="Shape preview"
    :style="{ width: 'min(1080px, 96vw)' }"
    @update:visible="emit('update:shapePreviewOpen', $event)"
  >
    <ShapePreviewPanel
      v-if="previewShape"
      :shape="previewShape"
      :shapes-turtle="combinedCanvasShapesTurtle"
      :values-turtle="previewShapeValuesTurtle"
      :subjects="previewShapeSubjects"
    />
  </Dialog>
</template>
