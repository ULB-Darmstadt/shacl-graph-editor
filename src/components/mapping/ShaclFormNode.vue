<script setup lang="ts">
/**
 * ShaclFormNode
 *
 * Vue Flow node that hosts the `<shacl-form>` web component from
 * `@ulb-darmstadt/shacl-form`. The node renders a real, validating
 * SHACL form for a metadata profile (e.g. DCAT Collection Dataset)
 * and persists the serialized turtle in the mapping store on every
 * change event.
 *
 * Side-effect import registers the custom element globally.
 *
 * NOTE: Vue Flow passes everything via a single `data` prop, NOT as
 * individual props — that's why this component receives `data: {...}`
 * and unwraps it locally.
 */
import { computed, onMounted, ref, watch } from 'vue'
import '@ulb-darmstadt/shacl-form'
import { useMappingStore } from '@/stores/mappingStore'

interface NodeData {
  /** Application-Profile IRI (key for stored turtle). */
  profileIri: string
  /** Raw SHACL turtle to render (concatenated profiles, imports inline). */
  shapesTurtle: string
  /** IRI of the root NodeShape to render (sets `data-shape-subject`). */
  shapeSubject?: string
  /** Optional human-readable title (label for the node header). */
  title?: string
}
const props = defineProps<{ data: NodeData }>()

const mapping = useMappingStore()
const formRef = ref<HTMLElement | null>(null)

const profileIri = computed(() => props.data.profileIri)
const shapesTurtle = computed(() => props.data.shapesTurtle ?? '')
const shapeSubject = computed(() => props.data.shapeSubject)
const title = computed(() => props.data.title)

function applyAttrs(): void {
  if (!formRef.value) return
  const el = formRef.value
  if (shapesTurtle.value) el.setAttribute('data-shapes', shapesTurtle.value)
  else el.removeAttribute('data-shapes')
  if (shapeSubject.value) el.setAttribute('data-shape-subject', shapeSubject.value)
  else el.removeAttribute('data-shape-subject')
}

onMounted(() => {
  if (!formRef.value) return
  const el = formRef.value as HTMLElement & { serialize?: () => string }

  applyAttrs()

  // Restore previous turtle (if any) into the form
  const existing = mapping.metadataTurtle[profileIri.value]
  if (existing) el.setAttribute('data-values', existing)

  el.addEventListener('change', () => {
    try {
      const turtle = el.serialize?.() ?? ''
      mapping.setMetadataTurtle(profileIri.value, turtle)
    } catch {
      /* ignore — form not yet ready */
    }
  })
})

// Re-apply if profile/shapes change
watch([shapesTurtle, shapeSubject], applyAttrs)
</script>

<template>
  <div class="shacl-form-node nowheel">
    <header class="node-header">
      <i class="pi pi-id-card" />
      <span>{{ title ?? 'Datensatz-Metadaten' }}</span>
    </header>
    <div class="node-body nodrag">
      <shacl-form
        ref="formRef"
        data-collapse="open"
        data-ignore-owl-imports
        data-language="de"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.shacl-form-node {
  width: 520px;
  background: var(--color-surface-1);
  border: 1.5px solid #f59e0b;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.18);
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  // Allow Vue Flow to drag the whole node by its header.
  cursor: default;
}
.node-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #fbbf24;
  color: #78350f;
  font-weight: 600;
  border-radius: calc(var(--radius-md) - 1px) calc(var(--radius-md) - 1px) 0 0;
  cursor: grab;
  user-select: none;

  &:active { cursor: grabbing; }
}
.node-body {
  padding: 8px 12px 12px;
  // Auto-grow with content; only scroll when the form gets enormous.
  max-height: min(85vh, 1200px);
  overflow-y: auto;
}
</style>
