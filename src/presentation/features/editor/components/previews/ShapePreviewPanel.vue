<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import '@ulb-darmstadt/shacl-form'
import type { NodeShape } from '@/domain/profiles'
import { useShaclFormViewer, type ShaclFormElement } from '@/presentation/features/shacl/useShaclFormViewer'

interface PreviewSubject {
  iri: string
  label: string
}

const props = defineProps<{
  shape: NodeShape
  shapesTurtle: string
  valuesTurtle: string
  subjects: PreviewSubject[]
}>()

const formRef = ref<ShaclFormElement | null>(null)
const title = computed(() => props.shape.label ?? props.shape.nodeId.value)
const selectedSubjectIri = ref('')

const hasSubjects = computed(() => props.subjects.length > 0)
const currentSubject = computed(() => props.subjects.find(subject => subject.iri === selectedSubjectIri.value) ?? null)

watch(
  () => props.subjects,
  subjects => {
    if (subjects.length === 0) {
      selectedSubjectIri.value = ''
      return
    }

    if (!subjects.some(subject => subject.iri === selectedSubjectIri.value)) {
      selectedSubjectIri.value = subjects[0].iri
    }
  },
  { immediate: true },
)

useShaclFormViewer({
  formRef,
  watchSources: [
    () => props.shapesTurtle,
    () => props.valuesTurtle,
    () => props.shape.nodeId.value,
    selectedSubjectIri,
  ],
  getShapesTurtle: () => props.shapesTurtle,
  getValuesTurtle: () => props.valuesTurtle,
  getValuesSubject: () => selectedSubjectIri.value || undefined,
  getShapeSubject: () => props.shape.nodeId.termType === 'NamedNode'
    ? props.shape.nodeId.value
    : undefined,
  getExtraAttributes: () => ({
    'data-view': hasSubjects.value ? 'true' : undefined,
  }),
})
</script>

<template>
  <section class="shape-preview">
    <header class="preview-header">
      <h3 class="panel-title">{{ title }}</h3>
      <p class="helper-text shape-target">{{ props.shape.targetClass?.value ?? props.shape.nodeId.value }}</p>
    </header>

    <div v-if="hasSubjects" class="record-toolbar">
      <label class="record-picker">
        <span class="meta-label">Record</span>
        <select v-model="selectedSubjectIri" class="form-select">
          <option v-for="subject in subjects" :key="subject.iri" :value="subject.iri">
            {{ subject.label }}
          </option>
        </select>
      </label>
      <div class="record-meta">
        <strong>{{ currentSubject?.label }}</strong>
        <span>{{ subjects.length }} record(s)</span>
      </div>
    </div>

    <div class="form-shell">
      <shacl-form
        ref="formRef"
        data-collapse="closed"
        data-language="en"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.shape-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.shape-target {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  word-break: break-all;
}

.form-shell {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  padding: var(--space-3);
  max-height: 70vh;
  overflow: auto;
}

.record-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.record-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .form-select {
    min-width: 280px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: var(--color-surface-1);
  }
}

.record-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;

  strong,
  span {
    overflow-wrap: anywhere;
  }

  span {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }
}

</style>
