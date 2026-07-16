<script setup lang="ts">
import Dialog from 'primevue/dialog'
import ShapePreviewPanel from '@/presentation/features/editor/components/previews/ShapePreviewPanel.vue'
import type { ProfileImportDialogDefinition } from '@/presentation/features/profile-import/profileImportRegistry'
import type { NodeShape } from '@/domain/profiles'

interface PreviewSubject {
  iri: string
  label: string
}

defineProps<{
  activeImportDialogDefinition: ProfileImportDialogDefinition | null
  activeImportDialogVisible: boolean
  activeImportDialogKey: string | number
  activeImportDialogProps: Record<string, unknown>
  shapePreviewOpen: boolean
  previewShape: NodeShape | null
  combinedCanvasShapesTurtle: string
  previewShapeValuesTurtle: string
  previewShapeSubjects: PreviewSubject[]
}>()

const emit = defineEmits<{
  (event: 'close-import-dialog'): void
  (event: 'update:activeImportDialogVisible', value: boolean): void
  (event: 'update:shapePreviewOpen', value: boolean): void
}>()
</script>

<template>
  <Dialog
    v-if="activeImportDialogDefinition"
    :visible="activeImportDialogVisible"
    modal
    :header="activeImportDialogDefinition.header"
    :style="{ width: activeImportDialogDefinition.width, maxWidth: '95vw' }"
    @update:visible="emit('update:activeImportDialogVisible', $event)"
    @hide="emit('close-import-dialog')"
  >
    <component
      :is="activeImportDialogDefinition.component"
      :key="activeImportDialogKey"
      v-bind="activeImportDialogProps"
      @added="emit('close-import-dialog')"
    />
  </Dialog>

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
