<script setup lang="ts">
/**
 * AppView — unified main view that merges Setup + Mapping + Export.
 *
 * Components are added via the Menubar (top): Schema TTL, Dataset
 * Metadata TTL, CSV, Airtable, plus actions Auto-Match / Import-Mapping
 * / Export-RO-Crate / Reset. The canvas itself stays minimal — no legend,
 * no help asides, no info banners.
 */
import { computed, markRaw, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { VueFlow, useVueFlow, type Edge, type Node, type Connection, type EdgeMouseEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import TableNode from '@/components/mapping/TableNode.vue'
import ShapeNode from '@/components/mapping/ShapeNode.vue'
import ShaclFormNode from '@/components/mapping/ShaclFormNode.vue'
import { useDataStore } from '@/stores/dataStore'
import { useShapesStore } from '@/stores/shapesStore'
import { useMetadataStore } from '@/stores/metadataStore'
import { useMappingStore } from '@/stores/mappingStore'
import { useProjectStore } from '@/stores/projectStore'
import { layoutMappingGraph } from '@/services/graphLayout'
import { classifyShape } from '@/domain/NodeShape'
import { suggestMappings, type SuggestedMapping } from '@/services/autoMatcher'
import { detectLinkedColumns } from '@/services/linkDetector'
import { exportRoCrate } from '@/services/exportService'
import { DATASET_SCHEMA_CATALOG, type DatasetCatalogEntry } from '@/services/embeddedProfiles'
import Menubar from 'primevue/menubar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import CsvUploadPanel from '@/components/setup/CsvUploadPanel.vue'
import AirtableConnectPanel from '@/components/setup/AirtableConnectPanel.vue'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const data = useDataStore()
const shapes = useShapesStore()
const metadata = useMetadataStore()
const mapping = useMappingStore()
const project = useProjectStore()
const toast = useToast()
const confirm = useConfirm()
const { sources } = storeToRefs(data)
const { nodeShapes, profiles, isResolvingImports } = storeToRefs(shapes)
const {
  rootProfiles: metadataRootProfiles,
  combinedTurtle: metadataCombinedTurtle,
} = storeToRefs(metadata)

// ---------- Component-add menu ----------
const schemaInputRef = ref<HTMLInputElement | null>(null)
const metadataInputRef = ref<HTMLInputElement | null>(null)
const mappingImportRef = ref<HTMLInputElement | null>(null)

const csvDialogOpen = ref(false)
const airtableDialogOpen = ref(false)
const datasetSchemaDialogOpen = ref(false)

function triggerSchemaUpload(): void { schemaInputRef.value?.click() }
function triggerMetadataUpload(): void { metadataInputRef.value?.click() }
function triggerMappingImport(): void { mappingImportRef.value?.click() }

async function onSchemaFiles(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const files = Array.from(input.files)
  try {
    await shapes.addTtlFiles(files)
    toast.add({
      severity: 'success',
      summary: 'Schema geladen',
      detail: `${files.length} TTL-Datei(en) hinzugefügt.`,
      life: 3000,
    })
    if (shapes.lastResolveErrors.length > 0) {
      toast.add({
        severity: 'warn',
        summary: 'Einige Imports nicht aufgelöst',
        detail: `${shapes.lastResolveErrors.length} owl:import(s) konnten nicht geladen werden.`,
        life: 4000,
      })
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Parse-Fehler',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    })
  } finally {
    input.value = ''
  }
}

async function onMetadataFiles(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const files = Array.from(input.files)
  try {
    await metadata.addRootsFromFiles(files)
    toast.add({
      severity: 'success',
      summary: 'Dataset-Schema geladen',
      detail: `${files.length} TTL-Datei(en) hinzugefügt.`,
      life: 3000,
    })
    if (metadata.lastResolveErrors.length > 0) {
      toast.add({
        severity: 'warn',
        summary: 'Einige Imports nicht aufgelöst',
        detail: `${metadata.lastResolveErrors.length} owl:import(s) konnten nicht geladen werden.`,
        life: 4000,
      })
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Parse-Fehler',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    })
  } finally {
    input.value = ''
  }
}

async function loadDatasetCatalogEntry(entry: DatasetCatalogEntry): Promise<void> {
  try {
    await metadata.addRootFromTurtle(entry.rawTurtle, `${entry.id}.ttl`, entry.iri)
    toast.add({
      severity: 'success',
      summary: 'Dataset-Schema geladen',
      detail: entry.title,
      life: 3000,
    })
    datasetSchemaDialogOpen.value = false
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Konnte nicht geladen werden',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    })
  }
}

const menuItems = computed(() => [
  {
    label: 'Data Schema',
    icon: 'pi pi-bookmark',
    command: triggerSchemaUpload,
  },
  {
    label: 'Data',
    icon: 'pi pi-table',
    items: [
      {
        label: 'CSV-Datei',
        icon: 'pi pi-file',
        command: () => { csvDialogOpen.value = true },
      },
      {
        label: 'Airtable-Tabelle',
        icon: 'pi pi-database',
        command: () => { airtableDialogOpen.value = true },
      },
    ],
  },
  {
    label: 'Dataset Schema',
    icon: 'pi pi-id-card',
    items: [
      ...DATASET_SCHEMA_CATALOG.map(entry => ({
        label: entry.title,
        icon: 'pi pi-bookmark-fill',
        command: () => loadDatasetCatalogEntry(entry),
      })),
      { separator: true },
      {
        label: 'Eigene TTL hochladen',
        icon: 'pi pi-upload',
        command: triggerMetadataUpload,
      },
    ],
  },
  {
    label: 'Mapping',
    icon: 'pi pi-share-alt',
    items: [
      {
        label: 'Auto-Mapping vorschlagen',
        icon: 'pi pi-magic-wand',
        disabled: !isReady.value,
        command: autoMatch,
      },
      {
        label: 'Mapping-Datei importieren',
        icon: 'pi pi-upload',
        command: triggerMappingImport,
      },
      { separator: true },
      {
        label: 'Mapping zurücksetzen',
        icon: 'pi pi-trash',
        disabled: mapping.state.edges.length === 0,
        command: confirmResetMapping,
      },
    ],
  },
  {
    label: 'Alles zurücksetzen',
    icon: 'pi pi-refresh',
    command: confirmResetAll,
  },
])

function confirmResetMapping(): void {
  confirm.require({
    header: 'Mapping zurücksetzen',
    message: 'Alle Mapping-Verbindungen werden entfernt.',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Zurücksetzen',
    rejectLabel: 'Abbrechen',
    acceptClass: 'p-button-danger',
    accept: () => mapping.reset(),
  })
}

function confirmResetAll(): void {
  confirm.require({
    header: 'Alles zurücksetzen',
    message: 'Profile, Datenquellen und Mappings werden komplett gelöscht.',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Zurücksetzen',
    rejectLabel: 'Abbrechen',
    acceptClass: 'p-button-danger',
    accept: () => {
      shapes.reset()
      metadata.reset()
      data.reset()
      mapping.reset()
    },
  })
}

// ---------- Auto-match ----------
const suggestions = ref<SuggestedMapping[]>([])
const showSuggestions = ref(false)
const selectedSuggestions = ref<Set<string>>(new Set())

function autoMatch(): void {
  suggestions.value = suggestMappings(sources.value, nodeShapes.value)
  selectedSuggestions.value = new Set(suggestions.value.map(s => suggestionKey(s)))
  showSuggestions.value = true
}

function suggestionKey(s: SuggestedMapping): string {
  return `${s.shapeIri}::${s.propertyPath}`
}

function toggleSuggestion(s: SuggestedMapping): void {
  const k = suggestionKey(s)
  if (selectedSuggestions.value.has(k)) selectedSuggestions.value.delete(k)
  else selectedSuggestions.value.add(k)
}

function applySuggestions(): void {
  let applied = 0
  for (const s of suggestions.value) {
    if (selectedSuggestions.value.has(suggestionKey(s))) {
      mapping.set({ sourceId: s.sourceId, sourceHeader: s.sourceHeader, shapeIri: s.shapeIri, propertyPath: s.propertyPath })
      applied++
    }
  }
  showSuggestions.value = false
  toast.add({ severity: 'success', summary: 'Auto-Mapping', detail: `${applied} übernommen.`, life: 3000 })
}

function confidenceLabel(c: number): string {
  if (c >= 0.9) return 'Sehr hoch'
  if (c >= 0.7) return 'Hoch'
  if (c >= 0.55) return 'Mittel'
  return 'Niedrig'
}

function confidenceSeverity(c: number): string {
  if (c >= 0.7) return 'success'
  if (c >= 0.55) return 'warn'
  return 'secondary'
}

// ---------- Mapping import ----------
function onImportMapping(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const { imported, skipped } = mapping.importFromJson(reader.result as string)
    toast.add({
      severity: imported > 0 ? 'success' : 'warn',
      summary: 'Mapping importiert',
      detail: `${imported} Kante(n)${skipped > 0 ? `, ${skipped} übersprungen` : ''}.`,
      life: 4000,
    })
  }
  reader.readAsText(file)
  ;(e.target as HTMLInputElement).value = ''
}

// ---------- Export ----------
const canExport = computed(() =>
  shapes.profiles.length > 0
    && sources.value.length > 0
    && mapping.state.edges.length > 0,
)

const isExporting = ref(false)

async function doExport(): Promise<void> {
  if (!canExport.value) return
  isExporting.value = true
  try {
    const result = await exportRoCrate({
      projectTitle: project.project.title,
      ap: shapes.ap,
      profiles: shapes.profiles,
      sources: sources.value,
      mapping: mapping.state,
      metadataTurtle: mapping.getCombinedMetadataTurtle(),
    })
    toast.add({
      severity: 'success',
      summary: 'RO-Crate exportiert',
      detail: `${result.filename} (${result.subjectCount} Subjekte, ${result.tripleCount} Triples)`,
      life: 5000,
    })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Export fehlgeschlagen',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    })
  } finally {
    isExporting.value = false
  }
}

// ---------- Canvas graph ----------
const { onConnect, onEdgeClick } = useVueFlow()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = {
  tableNode: markRaw(TableNode),
  shapeNode: markRaw(ShapeNode),
  metadataNode: markRaw(ShaclFormNode),
}

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

// Canvas data-shapes come from shapesStore. Dataset-metadata profiles
// live in a fully separate metadataStore and never appear here.
const { canvasShapes } = storeToRefs(shapes)

function rebuildGraph(): void {
  const tableNodes: Node[] = sources.value.map(src => ({
    id: `src:${src.id}`,
    type: 'tableNode',
    position: { x: 0, y: 0 },
    data: { source: src },
  }))

  const shapeNodes: Node[] = canvasShapes.value.map(ns => ({
    id: `shape:${ns.nodeId.value}`,
    type: 'shapeNode',
    position: { x: 0, y: 0 },
    data: { shape: ns },
  }))

  const metadataNodes: Node[] = metadataRootProfiles.value.map(p => {
    // Prefer a form-classified NodeShape; fall back to the first one.
    const rootForm = p.nodeShapes.find(ns => classifyShape(ns) === 'form') ?? p.nodeShapes[0]
    const rootIri = rootForm?.nodeId.termType === 'NamedNode' ? rootForm.nodeId.value : undefined
    return {
      id: `meta:${p.iri}`,
      type: 'metadataNode',
      position: { x: 0, y: 0 },
      data: {
        profileIri: p.iri,
        shapesTurtle: metadataCombinedTurtle.value,
        shapeSubject: rootIri,
        title: rootForm?.label ?? 'Datensatz-Metadaten',
      },
      draggable: true,
      selectable: true,
    }
  })

  const mappingEdges: Edge[] = mapping.state.edges.map(edge => {
    const targetShape = canvasShapes.value.find(ns => ns.nodeId.value === edge.shapeIri)
    const targetProp = targetShape?.properties.find(p => p.path?.value === edge.propertyPath)
    const isFkProp = Boolean(targetProp?.node)
    const sourceObj = sources.value.find(s => s.id === edge.sourceId)
    const sourceIsLink = sourceObj
      ? detectLinkedColumns(sourceObj, sources.value).some(c => c.header === edge.sourceHeader)
      : false
    const isFkEdge = isFkProp || sourceIsLink
    return {
      id: `e:${edge.shapeIri}::${edge.propertyPath}`,
      source: `src:${edge.sourceId}`,
      sourceHandle: `h:${edge.sourceHeader}`,
      target: `shape:${edge.shapeIri}`,
      targetHandle: `p:${edge.propertyPath}`,
      animated: true,
      style: isFkEdge
        ? { stroke: '#f59e0b', strokeWidth: 2 }
        : { stroke: 'var(--color-accent)', strokeWidth: 2 },
    }
  })

  const canvasIriSet = new Set(canvasShapes.value.map(ns => ns.nodeId.value))
  const structuralEdges: Edge[] = []
  for (const ns of canvasShapes.value) {
    for (const p of ns.properties) {
      if (!p.node || !p.path) continue
      if (!canvasIriSet.has(p.node.value)) continue
      structuralEdges.push({
        id: `ref:${ns.nodeId.value}::${p.path.value}->${p.node.value}`,
        source: `shape:${ns.nodeId.value}`,
        sourceHandle: `ref:${p.path.value}`,
        target: `shape:${p.node.value}`,
        targetHandle: 'shape-header',
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '6 3' },
      })
    }
  }

  const allEdges = [...mappingEdges, ...structuralEdges]
  const layouted = layoutMappingGraph([...tableNodes, ...shapeNodes, ...metadataNodes], allEdges)
  nodes.value = layouted
  edges.value = allEdges
}

watch(
  [
    () => sources.value.length,
    () => sources.value.map(s => s.id).join('|'),
    canvasShapes,
    metadataRootProfiles,
    metadataCombinedTurtle,
    () => mapping.state.edges.length,
  ],
  rebuildGraph,
  { immediate: true },
)

onConnect((connection: Connection) => {
  if (!connection.source || !connection.target) return
  if (!connection.source.startsWith('src:')) return
  if (!connection.target.startsWith('shape:')) return
  const sourceId = connection.source.slice(4)
  const shapeIri = connection.target.slice(6)
  const sourceHeader = connection.sourceHandle?.startsWith('h:') ? connection.sourceHandle.slice(2) : ''
  const propertyPath = connection.targetHandle?.startsWith('p:') ? connection.targetHandle.slice(2) : ''
  if (!sourceHeader || !propertyPath) return
  mapping.set({ sourceId, sourceHeader, shapeIri, propertyPath })
})

// ---------- Edge deletion ----------
const selectedEdgeId = ref<string | null>(null)

function deleteMappingEdgeById(edgeId: string): boolean {
  if (!edgeId.startsWith('e:')) return false
  const rest = edgeId.slice(2)
  const sep = rest.lastIndexOf('::')
  if (sep < 0) return false
  mapping.unset(rest.slice(0, sep), rest.slice(sep + 2))
  return true
}

onEdgeClick((event: EdgeMouseEvent) => {
  selectedEdgeId.value = event.edge.id
  if (event.edge.id.startsWith('ref:')) return
  confirm.require({
    header: 'Verbindung lösen',
    message: 'Diese Mapping-Verbindung wirklich löschen?',
    icon: 'pi pi-question-circle',
    acceptLabel: 'Löschen',
    rejectLabel: 'Abbrechen',
    acceptClass: 'p-button-danger',
    accept: () => {
      if (deleteMappingEdgeById(event.edge.id)) {
        selectedEdgeId.value = null
        toast.add({ severity: 'success', summary: 'Verbindung gelöscht', life: 2000 })
      }
    },
  })
})

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return
  if (!selectedEdgeId.value) return
  const tgt = e.target as HTMLElement | null
  if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return
  if (selectedEdgeId.value.startsWith('ref:')) return
  if (deleteMappingEdgeById(selectedEdgeId.value)) {
    selectedEdgeId.value = null
    toast.add({ severity: 'success', summary: 'Verbindung gelöscht', life: 2000 })
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))

const isReady = computed(() => sources.value.length > 0 && canvasShapes.value.length > 0)

const hasNothing = computed(() =>
  profiles.value.length === 0
  && sources.value.length === 0
  && metadataRootProfiles.value.length === 0,
)
</script>

<template>
  <div class="app-view">
    <!-- Top toolbar / menu -->
    <div class="toolbar">
      <Menubar :model="menuItems" />
      <span v-if="isResolvingImports" class="toolbar-status">
        <i class="pi pi-spin pi-spinner" /> Imports werden aufgelöst…
      </span>
      <span v-if="mapping.state.edges.length > 0" class="toolbar-status">
        {{ mapping.state.edges.length }} Mapping(s) · Klick auf Kante = lösen
      </span>
      <Button
        label="Export"
        icon="pi pi-download"
        size="small"
        :disabled="!canExport || isExporting"
        :loading="isExporting"
        @click="doExport"
      />
    </div>

    <!-- Hidden file inputs -->
    <input ref="schemaInputRef" type="file" accept=".ttl,.shacl,text/turtle" multiple style="display:none" @change="onSchemaFiles" />
    <input ref="metadataInputRef" type="file" accept=".ttl,.shacl,text/turtle" multiple style="display:none" @change="onMetadataFiles" />
    <input ref="mappingImportRef" type="file" accept=".json,application/json" style="display:none" @change="onImportMapping" />

    <!-- Auto-match suggestions overlay -->
    <div v-if="showSuggestions" class="suggestions-panel">
      <div class="suggestions-header">
        <strong>Auto-Mapping Vorschläge</strong>
        <div class="suggestions-actions">
          <Button label="Übernehmen" icon="pi pi-check" size="small" @click="applySuggestions" :disabled="selectedSuggestions.size === 0" />
          <Button label="Schließen" icon="pi pi-times" size="small" severity="secondary" outlined @click="showSuggestions = false" />
        </div>
      </div>
      <div v-if="suggestions.length === 0" class="no-suggestions">
        Keine Vorschläge gefunden.
      </div>
      <ul v-else class="suggestion-list">
        <li
          v-for="s in suggestions"
          :key="suggestionKey(s)"
          class="suggestion-item"
          :class="{ selected: selectedSuggestions.has(suggestionKey(s)) }"
          @click="toggleSuggestion(s)"
        >
          <input type="checkbox" :checked="selectedSuggestions.has(suggestionKey(s))" @change.stop="toggleSuggestion(s)" />
          <span class="src-label">{{ s.sourceId }} / <strong>{{ s.sourceHeader }}</strong></span>
          <i class="pi pi-arrow-right" />
          <span class="tgt-label">{{ s.shapeLabel }} / <strong>{{ s.propertyLabel }}</strong></span>
          <Tag :value="confidenceLabel(s.confidence)" :severity="confidenceSeverity(s.confidence) as any" style="font-size:0.7rem" />
        </li>
      </ul>
    </div>

    <!-- Canvas -->
    <div class="canvas-wrapper">
      <div v-if="hasNothing" class="empty-state">
        <i class="pi pi-plus-circle" />
        <h2>Komponenten hinzufügen</h2>
        <p>Verwende oben das Menü, um <strong>Data Schema</strong>, <strong>Data</strong> und <strong>Dataset Schema</strong> hinzuzufügen.</p>
      </div>
      <VueFlow
        v-else
        v-model:nodes="nodes"
        v-model:edges="edges"
        :node-types="nodeTypes"
        :default-edge-options="{ animated: false }"
        fit-view-on-init
      >
        <Background pattern-color="var(--color-border)" :gap="20" />
        <Controls position="top-left" />
        <MiniMap pannable zoomable />
      </VueFlow>
    </div>

    <!-- Dialogs -->
    <Dialog v-model:visible="csvDialogOpen" modal header="CSV importieren" :style="{ width: '720px', maxWidth: '95vw' }">
      <CsvUploadPanel @added="csvDialogOpen = false" />
    </Dialog>
    <Dialog v-model:visible="airtableDialogOpen" modal header="Airtable verbinden" :style="{ width: '720px', maxWidth: '95vw' }">
      <AirtableConnectPanel @added="airtableDialogOpen = false" />
    </Dialog>
  </div>
</template>

<style scoped lang="scss">
.app-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface-1);
  border-bottom: 1px solid var(--color-border);
  :deep(.p-menubar) { background: transparent; border: 0; padding: 0; }
}
.toolbar-status {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-left: auto;
}

.canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-5);
  .pi-plus-circle { font-size: 3rem; color: var(--color-accent); }
  h2 { margin: 0; font-size: 1.25rem; color: var(--color-text); }
  p { margin: 0; max-width: 480px; line-height: 1.55; }
}

.suggestions-panel {
  position: absolute;
  top: 64px;
  right: 24px;
  z-index: 50;
  width: 480px;
  max-height: 60vh;
  background: var(--color-surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.suggestions-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-2);
  strong { flex: 1; }
}
.suggestions-actions { display: flex; gap: var(--space-2); }
.no-suggestions { padding: var(--space-4); color: var(--color-text-muted); }
.suggestion-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}
.suggestion-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  font-size: 0.85rem;
  &:hover { background: var(--color-surface-2); }
  &.selected { background: var(--color-accent-soft); }
  .src-label { flex: 1; }
  .tgt-label { flex: 1; text-align: right; }
}
</style>
