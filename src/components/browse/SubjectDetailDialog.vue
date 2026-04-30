<script setup lang="ts">
/**
 * SubjectDetailDialog
 *
 * Opens a modal that renders one RDF subject through the `<shacl-form>`
 * web component in viewer mode. Cross-references to other subjects
 * (resolved via the current browse model) appear in a side list that
 * lets the user navigate to the linked subject without leaving the
 * dialog. A breadcrumb of the navigation history allows going back.
 *
 * Inputs:
 *  - `modelValue`  controls dialog visibility (v-model)
 *  - `subjectIri`  IRI of the subject to display
 *  - `model`       the current `BrowseModel` (used to resolve labels and
 *                  find the matching NodeShape per class)
 *  - `shapesTurtle`  combined SHACL turtle (data shapes only — same as
 *                    used to drive the canvas)
 *  - `valuesTurtle`  full generated data graph as turtle (drives the
 *                    pre-populated form)
 *
 * The dialog maintains an internal navigation stack so users can drill
 * into a `Stakeholder` from a `Building`, then return.
 */
import { computed, ref, watch } from 'vue'
import '@ulb-darmstadt/shacl-form'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { BrowseModel, BrowseSubject } from '@/services/browseService'
import type { NodeShape } from '@/domain/NodeShape'

interface Props {
  modelValue: boolean
  subjectIri: string | null
  model: BrowseModel | null
  shapes: readonly NodeShape[]
  shapesTurtle: string
  valuesTurtle: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

/** Navigation history — newest entry at the end. */
const stack = ref<string[]>([])

watch(
  () => [props.modelValue, props.subjectIri] as const,
  ([open, iri]) => {
    if (open && iri) {
      // Reset the stack to the freshly opened subject when the dialog opens.
      stack.value = [iri]
    } else if (!open) {
      stack.value = []
    }
  },
  { immediate: true },
)

const currentIri = computed(() => stack.value[stack.value.length - 1] ?? null)

/**
 * Resolves the subject (across all groups). A subject may appear in
 * multiple class groups — we return the first occurrence; properties
 * are identical regardless of bucket.
 */
const currentSubject = computed<BrowseSubject | null>(() => {
  const iri = currentIri.value
  if (!iri || !props.model) return null
  for (const group of props.model.groups) {
    const found = group.subjects.find(s => s.iri === iri)
    if (found) return found
  }
  return null
})

/** Resolves the NodeShape whose targetClass matches one of the subject's classes. */
const matchingShape = computed<NodeShape | null>(() => {
  const subj = currentSubject.value
  if (!subj) return null
  for (const cls of subj.classes) {
    const shape = props.shapes.find(s => s.targetClass?.value === cls)
    if (shape) return shape
  }
  return null
})

/** Outgoing resource refs that point to other subjects we know about. */
const linkedSubjects = computed(() => {
  const subj = currentSubject.value
  if (!subj) return []
  return subj.properties.filter(p => p.isResource && p.resolvedLabel !== undefined)
})

function openSubject(iri: string): void {
  if (iri === currentIri.value) return
  stack.value = [...stack.value, iri]
}

function goBack(): void {
  if (stack.value.length > 1) {
    stack.value = stack.value.slice(0, -1)
  }
}

function jumpTo(idx: number): void {
  stack.value = stack.value.slice(0, idx + 1)
}

function labelFor(iri: string): string {
  if (!props.model) return iri
  for (const g of props.model.groups) {
    const s = g.subjects.find(x => x.iri === iri)
    if (s) return s.label
  }
  return iri
}

// ---------- shacl-form wiring ----------
const formRef = ref<HTMLElement | null>(null)

function applyAttrs(): void {
  if (!formRef.value) return
  const el = formRef.value
  const subj = currentSubject.value
  const shape = matchingShape.value

  if (props.shapesTurtle) el.setAttribute('data-shapes', props.shapesTurtle)
  else el.removeAttribute('data-shapes')

  if (props.valuesTurtle) el.setAttribute('data-values', props.valuesTurtle)
  else el.removeAttribute('data-values')

  if (subj?.iri) el.setAttribute('data-values-subject', subj.iri)
  else el.removeAttribute('data-values-subject')

  if (shape?.nodeId.termType === 'NamedNode') {
    el.setAttribute('data-shape-subject', shape.nodeId.value)
  } else {
    el.removeAttribute('data-shape-subject')
  }
}

watch(
  [
    visible,
    currentIri,
    () => props.shapesTurtle,
    () => props.valuesTurtle,
    matchingShape,
  ],
  () => {
    if (visible.value) {
      // Defer to next microtask so the shacl-form element is in the DOM.
      queueMicrotask(applyAttrs)
    }
  },
)

function localName(iri: string): string {
  const idx = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'))
  return idx >= 0 ? iri.slice(idx + 1) : iri
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :style="{ width: '1080px', maxWidth: '95vw' }"
    :header="currentSubject?.label ?? 'Subject'"
    :pt="{ content: { class: 'subject-dialog-content' } }"
  >
    <div v-if="currentSubject" class="subject-detail">
      <!-- Header: breadcrumb + class tags + IRI -->
      <div class="detail-toolbar">
        <Button
          v-if="stack.length > 1"
          icon="pi pi-arrow-left"
          size="small"
          severity="secondary"
          outlined
          @click="goBack"
          aria-label="Zurück"
        />
        <nav v-if="stack.length > 1" class="breadcrumb" aria-label="Navigationsverlauf">
          <template v-for="(iri, idx) in stack" :key="iri + idx">
            <button
              class="crumb"
              :class="{ active: idx === stack.length - 1 }"
              :disabled="idx === stack.length - 1"
              @click="jumpTo(idx)"
            >
              {{ labelFor(iri) }}
            </button>
            <span v-if="idx < stack.length - 1" class="crumb-sep">›</span>
          </template>
        </nav>
        <span class="iri" :title="currentSubject.iri">{{ localName(currentSubject.iri) }}</span>
        <span class="classes">
          <Tag
            v-for="cls in currentSubject.classes"
            :key="cls"
            :value="localName(cls)"
            severity="info"
            :title="cls"
          />
        </span>
      </div>

      <div class="detail-body">
        <!-- shacl-form viewer for the subject -->
        <div class="form-pane">
          <shacl-form
            ref="formRef"
            data-view
            data-collapse="open"
            data-ignore-owl-imports
            data-language="de"
            data-show-root-shape-label="false"
          />
        </div>

        <!-- Linked subjects sidebar -->
        <aside v-if="linkedSubjects.length > 0" class="links-pane">
          <h3>Verknüpfte Resourcen</h3>
          <ul class="links">
            <li v-for="(p, idx) in linkedSubjects" :key="idx">
              <span class="link-label">{{ p.label }}</span>
              <button class="link-btn" @click="openSubject(p.value)" :title="p.value">
                <i class="pi pi-external-link" />
                <span>{{ p.resolvedLabel }}</span>
              </button>
            </li>
          </ul>
        </aside>
      </div>
    </div>
    <p v-else class="empty">Kein Subjekt ausgewählt.</p>
  </Dialog>
</template>

<style scoped lang="scss">
.subject-detail { display: flex; flex-direction: column; gap: var(--space-3); }

.detail-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}
.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 0.85rem;
}
.crumb {
  background: transparent;
  border: 0;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-primary);
  font-size: 0.85rem;
  &:hover:not(:disabled) { background: var(--color-surface-2); }
  &.active { color: var(--color-text); cursor: default; }
}
.crumb-sep { color: var(--color-text-muted); }
.iri {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-left: auto;
}
.classes { display: flex; gap: 4px; flex-wrap: wrap; }

.detail-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: var(--space-4);
  align-items: start;
}
@media (max-width: 900px) {
  .detail-body { grid-template-columns: 1fr; }
}

.form-pane {
  min-height: 200px;
  max-height: 65vh;
  overflow: auto;
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.links-pane {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  position: sticky;
  top: 0;
  h3 { margin: 0 0 var(--space-2); font-size: 0.95rem; }
}
.links { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.link-label { display: block; font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 2px; }
.link-btn {
  width: 100%;
  text-align: left;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-primary);
  font-size: 0.85rem;
  transition: border-color 0.15s, background-color 0.15s;
  &:hover { border-color: var(--color-primary); background: var(--color-surface-1); }
  i { font-size: 0.75rem; }
}

.empty { color: var(--color-text-muted); font-style: italic; padding: var(--space-4); }
</style>
