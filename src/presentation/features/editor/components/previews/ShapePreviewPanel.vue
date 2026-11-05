<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import '@ulb-darmstadt/shacl-form'
import type { NodeShape } from '@/domain/profiles'
import { useShaclFormViewer, type ShaclFormElement } from '@/presentation/features/shacl/useShaclFormViewer'
import TurtleCodePreview from './TurtleCodePreview.vue'

interface PreviewSubject {
  iri: string
  label: string
}

const props = defineProps<{
  shape: NodeShape
  shapesTurtle: string
  sourceTurtle: string
  valuesTurtle: string
  subjects: PreviewSubject[]
}>()

const formRef = ref<ShaclFormElement | null>(null)
const title = computed(() => props.shape.label ?? props.shape.nodeId.value)
const selectedSubjectIri = ref('')
const activeTab = ref<'form' | 'turtle'>('form')
const previewId = useId()
const formTabRef = ref<HTMLButtonElement | null>(null)
const turtleTabRef = ref<HTMLButtonElement | null>(null)

watch(() => props.shape.nodeId.value, () => { activeTab.value = 'form' })

function onTabKeyDown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    activeTab.value = activeTab.value === 'form' ? 'turtle' : 'form'
  } else if (event.key === 'Home') activeTab.value = 'form'
  else if (event.key === 'End') activeTab.value = 'turtle'
  else return
  event.preventDefault()
  void nextTick(() => (activeTab.value === 'form' ? formTabRef.value : turtleTabRef.value)?.focus())
}

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

    <div class="preview-tabs" role="tablist" aria-label="Shape preview format" @keydown="onTabKeyDown">
      <button
        :id="`${previewId}-form-tab`"
        ref="formTabRef"
        type="button"
        role="tab"
        class="preview-tab"
        :aria-selected="activeTab === 'form'"
        :aria-controls="`${previewId}-form-panel`"
        :tabindex="activeTab === 'form' ? 0 : -1"
        @click="activeTab = 'form'"
      >
        <i class="pi pi-list" aria-hidden="true" /> Form
      </button>
      <button
        :id="`${previewId}-turtle-tab`"
        ref="turtleTabRef"
        type="button"
        role="tab"
        class="preview-tab"
        :aria-selected="activeTab === 'turtle'"
        :aria-controls="`${previewId}-turtle-panel`"
        :tabindex="activeTab === 'turtle' ? 0 : -1"
        @click="activeTab = 'turtle'"
      >
        <i class="pi pi-code" aria-hidden="true" /> Turtle (TTL)
      </button>
    </div>

    <div
      :id="`${previewId}-form-panel`"
      v-show="activeTab === 'form'"
      class="form-preview"
      role="tabpanel"
      :aria-labelledby="`${previewId}-form-tab`"
    >
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
    </div>
    <div
      :id="`${previewId}-turtle-panel`"
      v-show="activeTab === 'turtle'"
      role="tabpanel"
      :aria-labelledby="`${previewId}-turtle-tab`"
    >
      <TurtleCodePreview v-if="activeTab === 'turtle'" :turtle="sourceTurtle" />
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

.preview-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--color-border);
}
.preview-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}
.preview-tab[aria-selected='true'] { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.preview-tab:hover { background: var(--color-surface-2); }
.form-preview { display: flex; flex-direction: column; gap: var(--space-3); }

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
