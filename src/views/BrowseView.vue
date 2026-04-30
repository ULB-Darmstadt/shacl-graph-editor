<script setup lang="ts">
/**
 * BrowseView — list and card view over generated RDF subjects.
 *
 * On mount: regenerates RDF + runs SHACL validation automatically. The
 * validation report can be opened in a dialog via a toolbar button —
 * users no longer need to switch to a separate "Daten" view.
 *
 * Cross-references between subjects are rendered with the referenced
 * subject's resolved label (resolvedLabel from browseService) instead
 * of raw IRIs, so a card that points to "recF60FgOJh6JERc" actually
 * shows "Bosch Capdeferro Architecture".
 *
 * The list view pivots properties into table columns: each unique
 * predicate within a class group becomes a column whose header shows
 * the human label on top and the property path underneath.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useShapesStore } from '@/stores/shapesStore'
import { useDataStore } from '@/stores/dataStore'
import { useMappingStore } from '@/stores/mappingStore'
import { generateRdf, serializeGraph } from '@/services/rdfGenerator'
import { buildBrowseModel, type BrowseModel, type BrowseSubject, type BrowseClassGroup, type BrowsePropertyValue } from '@/services/browseService'
import { validateMapping, type ValidationResult } from '@/services/shaclValidator'
import Message from 'primevue/message'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import MultiSelect from 'primevue/multiselect'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import ValidationResultPanel from '@/components/data/ValidationResultPanel.vue'
import SubjectDetailDialog from '@/components/browse/SubjectDetailDialog.vue'

const shapesStore = useShapesStore()
const dataStore = useDataStore()
const mappingStore = useMappingStore()
const { ap, hasShapes, nodeShapes, profiles } = storeToRefs(shapesStore)
const { sources } = storeToRefs(dataStore)

/**
 * Combined raw Turtle of every loaded data-shape profile. Passed to the
 * `<shacl-form>` web component as `data-shapes` for the detail dialog.
 */
const combinedShapesTurtle = computed(() =>
  profiles.value.map(p => p.rawTurtle).join('\n\n'),
)

const canBrowse = computed(() =>
  hasShapes.value && sources.value.length > 0 && mappingStore.state.hasMappings,
)

// ---------- RDF + validation, auto-built from current state ----------
const model = ref<BrowseModel | null>(null)
const validationResult = ref<ValidationResult | null>(null)
const ttlOutput = ref('')
const generationError = ref<string | null>(null)
const isGenerating = ref(false)

async function regenerate(): Promise<void> {
  if (!canBrowse.value) {
    model.value = null
    validationResult.value = null
    ttlOutput.value = ''
    return
  }
  isGenerating.value = true
  generationError.value = null
  try {
    validationResult.value = validateMapping(ap.value, mappingStore.state, sources.value)
    const result = generateRdf(ap.value, mappingStore.state, sources.value)
    model.value = buildBrowseModel(result.store, nodeShapes.value)
    ttlOutput.value = await serializeGraph(result.store, 'text/turtle')
  } catch (err) {
    generationError.value = err instanceof Error ? err.message : String(err)
    model.value = null
    ttlOutput.value = ''
  } finally {
    isGenerating.value = false
  }
}

onMounted(regenerate)
// Re-run if the underlying data changes while the view is mounted.
watch(
  [
    () => sources.value.length,
    () => sources.value.map(s => s.id).join('|'),
    () => nodeShapes.value.length,
    () => mappingStore.state.edges.length,
  ],
  regenerate,
)

// ---------- Validation report dialog ----------
const reportOpen = ref(false)
const validationSeverity = computed<'success' | 'warn' | 'error'>(() => {
  if (!validationResult.value) return 'success'
  if (validationResult.value.errorCount > 0) return 'error'
  if (validationResult.value.warningCount > 0) return 'warn'
  return 'success'
})
const validationLabel = computed(() => {
  if (!validationResult.value) return 'Validierung läuft…'
  const v = validationResult.value
  if (v.errorCount > 0) return `${v.errorCount} Verletzung(en)`
  if (v.warningCount > 0) return `${v.warningCount} Warnung(en)`
  return 'Alles gültig'
})

// ---------- View state ----------
const layout = ref<'cards' | 'list'>('cards')
const layoutOptions = [
  { value: 'cards', icon: 'pi pi-th-large', label: 'Karten' },
  { value: 'list',  icon: 'pi pi-list',     label: 'Liste' },
]
const search = ref('')
/** Selected class IRIs; empty = show all. */
const selectedClasses = ref<string[]>([])

// Reset class filter when groups change (e.g. after re-mapping).
watch(model, () => { selectedClasses.value = [] })

const classOptions = computed(() =>
  (model.value?.groups ?? []).map(g => ({
    value: g.classIri,
    label: `${g.classLabel} (${g.count})`,
  })),
)

const filteredGroups = computed(() => {
  if (!model.value) return []
  const groups = model.value.groups
  const classFilter = new Set(selectedClasses.value)
  const term = search.value.trim().toLowerCase()

  return groups
    .filter(g => classFilter.size === 0 || classFilter.has(g.classIri))
    .map(g => {
      const subjects = term
        ? g.subjects.filter(s => subjectMatches(s, term))
        : g.subjects
      return { ...g, subjects, count: subjects.length }
    })
    .filter(g => g.subjects.length > 0)
})

function subjectMatches(s: BrowseSubject, term: string): boolean {
  if (s.label.toLowerCase().includes(term)) return true
  if (s.iri.toLowerCase().includes(term)) return true
  for (const p of s.properties) {
    if (p.value.toLowerCase().includes(term)) return true
    if (p.label.toLowerCase().includes(term)) return true
    if (p.resolvedLabel && p.resolvedLabel.toLowerCase().includes(term)) return true
  }
  return false
}

const visibleSubjectCount = computed(() =>
  filteredGroups.value.reduce((acc, g) => acc + g.subjects.length, 0),
)

function clearFilters(): void {
  selectedClasses.value = []
  search.value = ''
}

function localName(iri: string): string {
  const idx = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'))
  return idx >= 0 ? iri.slice(idx + 1) : iri
}

// ---------- Detail dialog ----------
const detailOpen = ref(false)
const detailSubjectIri = ref<string | null>(null)

function openDetail(subj: BrowseSubject): void {
  detailSubjectIri.value = subj.iri
  detailOpen.value = true
}

/** Display text for a single property value — prefers cross-ref labels. */
function displayValue(p: BrowsePropertyValue): string {
  if (p.isResource) return p.resolvedLabel ?? (localName(p.value) || p.value)
  return p.value
}

// ---------- List-view pivot ----------
interface Column {
  /** Predicate IRI — used as the row-cell key. */
  predicate: string
  /** Human label (sh:name → fallback). */
  label: string
}

/**
 * Builds a stable column list for a class group: union of all predicates
 * appearing on its subjects, sorted alphabetically by label. Predicates
 * are unique even if multiple subjects use them with different values.
 */
function columnsFor(group: BrowseClassGroup): Column[] {
  const seen = new Map<string, string>()
  for (const subj of group.subjects) {
    for (const p of subj.properties) {
      if (!seen.has(p.predicate)) seen.set(p.predicate, p.label)
    }
  }
  return Array.from(seen.entries())
    .map(([predicate, label]) => ({ predicate, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** All values of a subject for a given predicate column. */
function valuesForColumn(subject: BrowseSubject, predicate: string): BrowsePropertyValue[] {
  return subject.properties.filter(p => p.predicate === predicate)
}
</script>

<template>
  <div class="browse-view">
    <header class="view-header">
      <h1>Browse</h1>
      <p class="subtitle">Erkunde die generierten RDF-Subjekte gruppiert nach Klasse.</p>
    </header>

    <Message v-if="!canBrowse" severity="warn" :closable="false">
      Lade Profile, Daten und definiere mindestens ein Mapping, um Daten zu browsen.
    </Message>

    <Message v-if="generationError" severity="error" :closable="false">
      {{ generationError }}
    </Message>

    <template v-if="canBrowse && model">
      <!-- Filter toolbar -->
      <div class="toolbar">
        <span class="p-input-icon-left search-wrapper">
          <i class="pi pi-search" />
          <InputText
            v-model="search"
            placeholder="Suche in allen Eigenschaften…"
            class="search-input"
          />
        </span>

        <MultiSelect
          v-model="selectedClasses"
          :options="classOptions"
          option-label="label"
          option-value="value"
          placeholder="Alle Klassen"
          display="chip"
          :max-selected-labels="3"
          class="class-filter"
        />

        <SelectButton
          v-model="layout"
          :options="layoutOptions"
          option-label="label"
          option-value="value"
          aria-label="Ansicht"
        >
          <template #option="slotProps">
            <i :class="slotProps.option.icon" />
            <span class="layout-label">{{ slotProps.option.label }}</span>
          </template>
        </SelectButton>

        <Button
          v-if="search || selectedClasses.length > 0"
          icon="pi pi-filter-slash"
          label="Zurücksetzen"
          size="small"
          severity="secondary"
          outlined
          @click="clearFilters"
        />

        <Button
          icon="pi pi-shield"
          :label="validationLabel"
          size="small"
          :severity="validationSeverity === 'success' ? 'success' : validationSeverity === 'warn' ? 'warn' : 'danger'"
          :loading="isGenerating"
          @click="reportOpen = true"
        />

        <span class="status">
          <Tag :value="`${visibleSubjectCount} / ${model.totalSubjects} Subjekte`" />
        </span>
      </div>

      <!-- Empty state -->
      <Message v-if="filteredGroups.length === 0" severity="info" :closable="false">
        Keine Subjekte entsprechen den aktuellen Filtern.
      </Message>

      <!-- Groups -->
      <section v-for="group in filteredGroups" :key="group.classIri" class="group">
        <header class="group-header">
          <h2>{{ group.classLabel }}</h2>
          <Tag :value="`${group.count}`" severity="info" />
          <span class="group-iri">{{ group.classIri }}</span>
        </header>

        <!-- Card layout -->
        <div v-if="layout === 'cards'" class="cards">
          <article
            v-for="subj in group.subjects"
            :key="subj.iri"
            class="card clickable"
            tabindex="0"
            role="button"
            @click="openDetail(subj)"
            @keydown.enter="openDetail(subj)"
            @keydown.space.prevent="openDetail(subj)"
          >
            <header class="card-header">
              <h3 :title="subj.iri">{{ subj.label }}</h3>
              <span class="card-iri" :title="subj.iri">{{ localName(subj.iri) }}</span>
            </header>
            <dl v-if="subj.properties.length > 0" class="props">
              <template v-for="(p, idx) in subj.properties" :key="`${subj.iri}-${idx}`">
                <dt :title="p.predicate">{{ p.label }}</dt>
                <dd>
                  <button
                    v-if="p.isResource && p.resolvedLabel"
                    class="ref-btn"
                    :title="p.value"
                    @click.stop="openDetail({ iri: p.value, label: p.resolvedLabel, classes: [], properties: [] })"
                  >
                    {{ p.resolvedLabel }}
                  </button>
                  <a v-else-if="p.isResource" :href="p.value" target="_blank" rel="noopener" :title="p.value" @click.stop>
                    {{ localName(p.value) }}
                  </a>
                  <span v-else>{{ p.value }}</span>
                </dd>
              </template>
            </dl>
            <p v-else class="empty">Keine Eigenschaften.</p>
          </article>
        </div>

        <!-- List layout (pivot) -->
        <div v-else class="list-table-wrapper">
          <table class="list-table">
            <thead>
              <tr>
                <th class="col-label">
                  <div class="col-name">Label</div>
                  <div class="col-path">@id</div>
                </th>
                <th
                  v-for="col in columnsFor(group)"
                  :key="col.predicate"
                  :title="col.predicate"
                >
                  <div class="col-name">{{ col.label }}</div>
                  <div class="col-path">{{ col.predicate }}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="subj in group.subjects"
                :key="subj.iri"
                class="clickable-row"
                @click="openDetail(subj)"
              >
                <td class="cell-label">
                  <div class="cell-name">{{ subj.label }}</div>
                  <div class="cell-iri" :title="subj.iri">{{ localName(subj.iri) }}</div>
                </td>
                <td
                  v-for="col in columnsFor(group)"
                  :key="col.predicate"
                >
                  <div
                    v-for="(p, idx) in valuesForColumn(subj, col.predicate)"
                    :key="idx"
                    class="cell-value"
                  >
                    <button
                      v-if="p.isResource && p.resolvedLabel"
                      class="ref-btn"
                      :title="p.value"
                      @click.stop="openDetail({ iri: p.value, label: p.resolvedLabel, classes: [], properties: [] })"
                    >
                      {{ p.resolvedLabel }}
                    </button>
                    <a v-else-if="p.isResource" :href="p.value" target="_blank" rel="noopener" :title="p.value" @click.stop>
                      {{ localName(p.value) }}
                    </a>
                    <span v-else>{{ p.value }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- Validation report dialog -->
    <Dialog
      v-model:visible="reportOpen"
      modal
      header="Validierungsbericht"
      :style="{ width: '900px', maxWidth: '95vw' }"
    >
      <ValidationResultPanel v-if="validationResult" :result="validationResult" />
      <Message v-else severity="info" :closable="false">
        Noch keine Validierung verfügbar.
      </Message>
      <details v-if="ttlOutput" class="ttl-details">
        <summary>Generiertes Turtle anzeigen</summary>
        <pre class="ttl-output"><code>{{ ttlOutput }}</code></pre>
      </details>
    </Dialog>

    <!-- Subject detail dialog (shacl-form viewer) -->
    <SubjectDetailDialog
      v-model="detailOpen"
      :subject-iri="detailSubjectIri"
      :model="model"
      :shapes="nodeShapes"
      :shapes-turtle="combinedShapesTurtle"
      :values-turtle="ttlOutput"
    />
  </div>
</template>

<style scoped lang="scss">
.browse-view {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.view-header h1 { margin: 0 0 var(--space-1); font-size: 1.75rem; }
.subtitle { margin: 0; color: var(--color-text-muted); }

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.search-wrapper {
  flex: 1 1 280px;
  min-width: 200px;
  position: relative;
  display: flex;
  align-items: center;
  i { position: absolute; left: 0.75rem; color: var(--color-text-muted); pointer-events: none; }
  .search-input { padding-left: 2.25rem; width: 100%; }
}
.class-filter { min-width: 240px; }
.layout-label { margin-left: var(--space-1); }
.status { margin-left: auto; }

.group { display: flex; flex-direction: column; gap: var(--space-3); }
.group-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
  h2 { margin: 0; font-size: 1.15rem; }
  .group-iri { font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-text-muted); margin-left: auto; }
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-3);
}
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition: border-color 0.15s, box-shadow 0.15s;
  &:hover { border-color: var(--color-primary); box-shadow: var(--shadow-sm); }
  &.clickable { cursor: pointer; }
  &.clickable:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
}
.card-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  h3 {
    margin: 0;
    font-size: 1rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-iri {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.props {
  display: grid;
  grid-template-columns: minmax(80px, max-content) 1fr;
  gap: var(--space-1) var(--space-2);
  margin: 0;
  font-size: 0.85rem;
  dt {
    color: var(--color-text-muted);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  dd {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
    a { color: var(--color-primary); text-decoration: none; &:hover { text-decoration: underline; } }
  }
}
.empty { color: var(--color-text-muted); font-style: italic; margin: 0; font-size: 0.85rem; }

.list-table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.list-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  th, td {
    text-align: left;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }
  th {
    background: var(--color-bg);
    font-weight: 600;
    position: sticky;
    top: 0;
  }
  tr:last-child td { border-bottom: 0; }
}
.col-name { font-weight: 600; }
.col-path {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--color-text-muted);
  font-weight: 400;
  margin-top: 2px;
  word-break: break-all;
}
.cell-label .cell-name { font-weight: 500; }
.cell-label .cell-iri {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--color-text-muted);
}
.cell-value {
  word-break: break-word;
  & + .cell-value { margin-top: 2px; }
  a { color: var(--color-primary); text-decoration: none; &:hover { text-decoration: underline; } }
}

.clickable-row {
  cursor: pointer;
  transition: background-color 0.15s;
  &:hover { background: var(--color-surface-1); }
}

.ref-btn {
  background: transparent;
  border: 0;
  padding: 0;
  margin: 0;
  cursor: pointer;
  color: var(--color-primary);
  font: inherit;
  text-align: left;
  &:hover { text-decoration: underline; }
}

.ttl-details {
  margin-top: var(--space-4);
  summary { cursor: pointer; color: var(--color-text-muted); font-size: 0.85rem; padding: var(--space-2) 0; }
}
.ttl-output {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  max-height: 400px;
  overflow: auto;
  white-space: pre;
  margin: 0;
}
</style>
