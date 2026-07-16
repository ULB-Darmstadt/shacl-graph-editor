<script setup lang="ts">
/**
 * SHACL editor main view.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { VueFlow, useVueFlow, type Connection, type XYPosition } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import Dialog from 'primevue/dialog'
import { useProfileEditorStore } from '@/application/profiles/profileEditorStore'
import { useEditorGraph } from '@/presentation/features/editor/useEditorGraph'
import { useEditorPreviews } from '@/presentation/features/editor/useEditorPreviews'
import { useEditorSelection } from '@/presentation/features/editor/useEditorSelection'
import EditorDialogs from '@/presentation/features/editor/EditorDialogs.vue'
import EditorInspector from '@/presentation/features/editor/components/inspector/EditorInspector.vue'
import { useProfileWorkflowMenu } from '@/presentation/features/profile-workflow/useProfileWorkflowMenu'
import { parseEditorShapeNodeTarget } from '@/presentation/features/editor/inheritanceEditorGraph'
import { estimateEditorShapeHeight } from '@/presentation/features/editor/layoutEditorGraph'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { PROFILE_LICENSE_OPTIONS, fetchSubjectHeadingOptions, type SelectOption } from '@/application/profiles/profileEditorCatalogs'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const profileStore = useProfileEditorStore()
const toast = useToast()
const confirm = useConfirm()
const { screenToFlowCoordinate } = useVueFlow()
const { nodeShapes, profiles, isResolvingImports, rootNodeShapes } = storeToRefs(profileStore)

const requestedNodePositions = ref<Record<string, XYPosition>>({})
const pendingPlacementAnchor = ref<XYPosition | null>(null)
const pendingPlacementOffset = ref(0)
let pendingPlacementResetTimer: number | null = null

const {
  selectedShapeIri,
  selectedPropertyKey,
  selectedShape,
  selectedProperty,
  selectedProfile,
  selectShape,
  selectProperty,
  clearSelection,
} = useEditorSelection({
  profiles: () => profiles.value,
  allShapes: () => nodeShapes.value,
})

const {
  shapePreviewOpen,
  previewShape,
  previewShapeValuesTurtle,
  previewShapeSubjects,
  combinedCanvasShapesTurtle,
  openShapePreview,
} = useEditorPreviews({
  profileStore,
  profiles,
  toast,
})

function resetEditorUiState(): void {
  closeImportDialog()
  shapePreviewOpen.value = false
}

const {
  schemaInputRef,
  activeImportDialogDefinition,
  activeImportDialogVisible,
  activeImportDialogKey,
  activeImportDialogProps,
  onSchemaFiles,
  closeImportDialog,
  triggerSchemaUpload,
  openImportDialog,
  exportProfiles,
  confirmResetAll,
} = useProfileWorkflowMenu({
  profileStore,
  toast,
  confirm,
  resetUiState: resetEditorUiState,
})

const { nodes, edges, nodeTypes, edgeTypes } = useEditorGraph({
  allShapes: nodeShapes,
  canvasShapes: rootNodeShapes,
  openShapePreview,
  addField: createProperty,
  removeReferenceEdge: requestRemoveReferenceEdge,
  requestedNodePositions,
  selectedShapeIri,
  selectedPropertyKey,
  selectShape,
  selectProperty,
})

const hasNothing = computed(() => profiles.value.length === 0)
const hasInspectorSelection = computed(() => selectedShape.value !== null)
const canvasMenu = ref<{ x: number; y: number; open: boolean }>({ x: 0, y: 0, open: false })
const graphShellRef = ref<HTMLElement | null>(null)
const canvasMenuRef = ref<HTMLElement | null>(null)
const canvasActionBarRef = ref<HTMLElement | null>(null)
const settingsOpen = ref(false)
const subjectHeadingOptions = ref<SelectOption[]>([])
const defaultCreator = ref(localStorage.getItem('editor.defaultCreator') ?? '')
const defaultCreated = ref(localStorage.getItem('editor.defaultCreated') ?? '')
const defaultLicense = ref(localStorage.getItem('editor.defaultLicense') ?? '')
const defaultSubject = ref(localStorage.getItem('editor.defaultSubject') ?? '')
const IMPORT_SIBLING_GAP = 36
const IMPORT_HORIZONTAL_OFFSET = 460

function createProfile(): void {
  const iri = profileStore.createProfile()
  applyProfileDefaults(iri)
  queueShapePlacement(iri, 0)
  const shape = profileStore.applicationProfile.findNodeShape(iri)
  if (shape) selectShape(shape)
}

function createProperty(shapeIri: string): void {
  const propertyNodeId = profileStore.createProperty(shapeIri)
  const shape = profileStore.applicationProfile.findNodeShape(shapeIri)
  const property = shape?.properties.find(candidate => candidate.nodeId.value === propertyNodeId)
  if (shape && property) selectProperty(shape, property)
}

function deleteSelectedShape(shapeIri: string): { ok: boolean; reason?: string } {
  const result = profileStore.removeProfile(shapeIri)
  if (result.ok) clearSelection()
  return result
}

function deleteSelectedProperty(shapeIri: string, propertyNodeId: string): boolean {
  const deleted = profileStore.removeProperty(shapeIri, propertyNodeId)
  if (deleted) {
    const shape = profileStore.applicationProfile.findNodeShape(shapeIri)
    if (shape) selectShape(shape)
    else clearSelection()
  }
  return deleted
}

function openCanvasMenu(event: MouseEvent): void {
  resetPendingPlacement()
  pendingPlacementAnchor.value = screenToFlowCoordinate({
    x: event.clientX,
    y: event.clientY,
  })
  canvasMenu.value = {
    x: event.clientX,
    y: event.clientY,
    open: true,
  }
}

function closeCanvasMenu(): void {
  canvasMenu.value.open = false
}

function handleGlobalPointerDown(event: PointerEvent): void {
  if (!canvasMenu.value.open) return
  const target = event.target as Node | null
  if (!target) return
  if (canvasMenuRef.value?.contains(target)) return
  if (canvasActionBarRef.value?.contains(target)) return
  closeCanvasMenu()
}

function handlePaneClick(): void {
  clearSelection()
  closeCanvasMenu()
}

function handleShellContextMenu(event: MouseEvent): void {
  event.preventDefault()
  openCanvasMenu(event)
}

function handleCanvasNewProfile(): void {
  closeCanvasMenu()
  createProfile()
}

function handleCanvasExistingProfile(): void {
  closeCanvasMenu()
  openImportDialog('aims-profile-catalog')
}

function handleCanvasUploadProfiles(): void {
  closeCanvasMenu()
  triggerSchemaUpload()
}

function requestRemoveReferenceEdge(shapeIri: string, propertyNodeId: string, _targetShapeIri: string): void {
  confirm.require({
    header: 'Remove connection',
    message: 'Remove this linked profile connection from the field?',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Remove',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: () => {
      profileStore.setPropertyNodeTarget(shapeIri, propertyNodeId, null)
    },
  })
}

function openBottomAddMenu(): void {
  const shell = graphShellRef.value
  if (!shell) return

  const rect = shell.getBoundingClientRect()
  const screenX = rect.left + (rect.width / 2)
  const screenY = rect.top + (rect.height / 2)
  resetPendingPlacement()
  pendingPlacementAnchor.value = screenToFlowCoordinate({ x: screenX, y: screenY })
  canvasMenu.value = {
    x: rect.left + (rect.width / 2) - 110,
    y: rect.bottom - 150,
    open: true,
  }
}

function applyProfileDefaults(shapeIri: string): void {
  if (defaultCreator.value.trim()) profileStore.updateShapeField(shapeIri, 'creator', defaultCreator.value)
  if (defaultCreated.value.trim()) profileStore.updateShapeField(shapeIri, 'created', defaultCreated.value)
  if (defaultLicense.value.trim()) profileStore.updateShapeField(shapeIri, 'license', defaultLicense.value)
  if (defaultSubject.value.trim()) profileStore.updateShapeField(shapeIri, 'subject', defaultSubject.value)
}

function saveSettings(): void {
  localStorage.setItem('editor.defaultCreator', defaultCreator.value)
  localStorage.setItem('editor.defaultCreated', defaultCreated.value)
  localStorage.setItem('editor.defaultLicense', defaultLicense.value)
  localStorage.setItem('editor.defaultSubject', defaultSubject.value)
  settingsOpen.value = false
}

function queueShapePlacement(shapeIri: string, offsetIndex: number): void {
  if (!pendingPlacementAnchor.value) return

  queueShapePlacementAt(shapeIri, {
    x: pendingPlacementAnchor.value.x,
    y: pendingPlacementAnchor.value.y + (offsetIndex * (180 + IMPORT_SIBLING_GAP)),
  })
}

function queueShapePlacementAt(shapeIri: string, position: XYPosition): void {
  requestedNodePositions.value = {
    ...requestedNodePositions.value,
    [`shape:${shapeIri}`]: position,
  }
}

function resetPendingPlacement(): void {
  pendingPlacementAnchor.value = null
  pendingPlacementOffset.value = 0
  if (pendingPlacementResetTimer !== null) {
    window.clearTimeout(pendingPlacementResetTimer)
    pendingPlacementResetTimer = null
  }
}

function schedulePendingPlacementReset(): void {
  if (pendingPlacementResetTimer !== null) window.clearTimeout(pendingPlacementResetTimer)
  pendingPlacementResetTimer = window.setTimeout(() => {
    resetPendingPlacement()
  }, 250)
}

function handleConnect(connection: Connection): void {
  const source = connection.source ? parseEditorShapeNodeTarget(connection.source) : null
  const target = connection.target ? parseEditorShapeNodeTarget(connection.target) : null
  if (!source?.representedShapeIri || !target?.representedShapeIri) return

  profileStore.connectPropertyToShape(
    source.representedShapeIri,
    connection.sourceHandle,
    target.representedShapeIri,
  )
}

watch(
  rootNodeShapes,
  (nextShapes, previousShapes = []) => {
    if (!pendingPlacementAnchor.value) return

    const previousIds = new Set(previousShapes.map(shape => shape.nodeId.value))
    const newShapes = nextShapes.filter(shape => !previousIds.has(shape.nodeId.value))
    if (newShapes.length === 0) return

    const knownPositions = new Map<string, XYPosition>()
    const anchorUsage = new Map<string, number>()
    const anchorOffsets = new Map<string, number>()

    for (const node of nodes.value) {
      const target = parseEditorShapeNodeTarget(node.id)
      if (!target?.representedShapeIri) continue
      knownPositions.set(target.representedShapeIri, node.position)
    }

    for (const [nodeId, position] of Object.entries(requestedNodePositions.value)) {
      const target = parseEditorShapeNodeTarget(nodeId)
      if (!target?.representedShapeIri) continue
      knownPositions.set(target.representedShapeIri, position)
    }

    const unresolved = [...newShapes]
    let fallbackIndex = pendingPlacementOffset.value

    while (unresolved.length > 0) {
      let resolvedInPass = false

      for (let index = unresolved.length - 1; index >= 0; index -= 1) {
        const shape = unresolved[index]
        const relatedPosition = resolveConnectedPlacement(
          shape,
          nextShapes,
          knownPositions,
          anchorUsage,
          anchorOffsets,
        )
        if (!relatedPosition) continue

        queueShapePlacementAt(shape.nodeId.value, relatedPosition)
        knownPositions.set(shape.nodeId.value, relatedPosition)
        unresolved.splice(index, 1)
        resolvedInPass = true
      }

      if (resolvedInPass) continue

      const fallbackShape = unresolved.shift()
      if (!fallbackShape) break
      const fallbackHeight = estimateEditorShapeHeight(fallbackShape, nextShapes)
      const fallbackPosition = {
        x: pendingPlacementAnchor.value.x,
        y: pendingPlacementAnchor.value.y + fallbackIndex,
      }
      queueShapePlacementAt(fallbackShape.nodeId.value, fallbackPosition)
      knownPositions.set(fallbackShape.nodeId.value, fallbackPosition)
      fallbackIndex += fallbackHeight + IMPORT_SIBLING_GAP
    }

    pendingPlacementOffset.value = fallbackIndex
    schedulePendingPlacementReset()
  },
)

function resolveConnectedPlacement(
  shape: (typeof rootNodeShapes.value)[number],
  allShapes: (typeof rootNodeShapes.value),
  knownPositions: Map<string, XYPosition>,
  anchorUsage: Map<string, number>,
  anchorOffsets: Map<string, number>,
): XYPosition | null {
  const incomingSources = allShapes.filter(candidate =>
    candidate.properties.some(property => property.node?.value === shape.nodeId.value),
  )

  for (const sourceShape of incomingSources) {
    const sourcePosition = knownPositions.get(sourceShape.nodeId.value)
    if (!sourcePosition) continue
    return resolveAnchoredPlacement(
      shape,
      allShapes,
      sourcePosition,
      `right:${sourceShape.nodeId.value}`,
      anchorUsage,
      anchorOffsets,
      IMPORT_HORIZONTAL_OFFSET,
    )
  }

  for (const targetIri of shape.inheritedShapeIris ?? []) {
    const inheritedPosition = knownPositions.get(targetIri)
    if (!inheritedPosition) continue
    return resolveAnchoredPlacement(
      shape,
      allShapes,
      inheritedPosition,
      `inherit:${targetIri}`,
      anchorUsage,
      anchorOffsets,
      IMPORT_HORIZONTAL_OFFSET,
    )
  }

  for (const property of shape.properties) {
    const targetIri = property.node?.value
    if (!targetIri) continue
    const targetPosition = knownPositions.get(targetIri)
    if (!targetPosition) continue
    return resolveAnchoredPlacement(
      shape,
      allShapes,
      targetPosition,
      `left:${targetIri}`,
      anchorUsage,
      anchorOffsets,
      -IMPORT_HORIZONTAL_OFFSET,
    )
  }

  return null
}

function resolveAnchoredPlacement(
  shape: (typeof rootNodeShapes.value)[number],
  allShapes: (typeof rootNodeShapes.value),
  anchorPosition: XYPosition,
  usageKey: string,
  anchorUsage: Map<string, number>,
  anchorOffsets: Map<string, number>,
  xOffset: number,
): XYPosition {
  const siblingIndex = anchorUsage.get(usageKey) ?? 0
  const nextOffset = anchorOffsets.get(usageKey) ?? 0
  const height = estimateEditorShapeHeight(shape, allShapes)

  anchorUsage.set(usageKey, siblingIndex + 1)
  anchorOffsets.set(usageKey, nextOffset + height + IMPORT_SIBLING_GAP)

  return {
    x: anchorPosition.x + xOffset,
    y: anchorPosition.y + nextOffset,
  }
}

onMounted(() => {
  window.addEventListener('pointerdown', handleGlobalPointerDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown)
  resetPendingPlacement()
})

void fetchSubjectHeadingOptions().then(options => {
  subjectHeadingOptions.value = options
}).catch(() => {
  subjectHeadingOptions.value = defaultSubject.value
    ? [{ label: defaultSubject.value, value: defaultSubject.value }]
    : []
})
</script>

<template>
  <div class="editor-view">
    <input ref="schemaInputRef" type="file" accept=".ttl,.shacl,text/turtle" multiple style="display:none" @change="onSchemaFiles" />

    <div class="editor-workspace">
      <div ref="graphShellRef" class="editor-graph-shell" @contextmenu="handleShellContextMenu">
        <div v-if="isResolvingImports" class="graph-status">
          <i class="pi pi-spin pi-spinner" /> Resolving imports...
        </div>

        <div v-if="hasNothing" class="empty-state">
          <i class="pi pi-plus-circle" />
          <h2 class="section-title">Start with a profile</h2>
          <p class="helper-text">Use the Add Profile button below or right-click the canvas to create, load, or upload profiles.</p>
        </div>

        <template v-else>
          <VueFlow
            class="editor-graph"
            v-model:nodes="nodes"
            v-model:edges="edges"
            :node-types="nodeTypes"
            :edge-types="edgeTypes"
            :default-edge-options="{ animated: false, type: 'default' }"
            fit-view-on-init
            @connect="handleConnect"
            @pane-click="handlePaneClick"
          >
            <Background pattern-color="var(--color-border)" :gap="20" />
            <Controls position="top-left" />
            <MiniMap pannable zoomable />
          </VueFlow>

          <div class="canvas-hint">
            Use Add Profile below or right-click empty canvas.
          </div>
        </template>

        <div
          v-if="canvasMenu.open"
          ref="canvasMenuRef"
          class="canvas-menu"
          :style="{ left: `${canvasMenu.x}px`, top: `${canvasMenu.y}px` }"
        >
          <button type="button" class="canvas-menu__item" @click="handleCanvasNewProfile">
            <i class="pi pi-plus-circle canvas-menu__icon" />
            <span class="canvas-menu__label">Add new profile</span>
          </button>
          <button type="button" class="canvas-menu__item" @click="handleCanvasExistingProfile">
            <i class="pi pi-book canvas-menu__icon" />
            <span class="canvas-menu__label">Add existing profile</span>
          </button>
          <button type="button" class="canvas-menu__item" @click="handleCanvasUploadProfiles">
            <i class="pi pi-upload canvas-menu__icon" />
            <span class="canvas-menu__label">Upload profile(s)</span>
          </button>
        </div>
      </div>

      <div ref="canvasActionBarRef" class="canvas-action-bar">
        <button type="button" class="action-tile action-tile--primary" @click="openBottomAddMenu">
          <i class="pi pi-plus-circle action-tile__icon" />
          <span class="action-tile__label">Add Profile</span>
        </button>
        <button type="button" class="action-tile" @click="confirmResetAll">
          <i class="pi pi-refresh action-tile__icon" />
          <span class="action-tile__label">Reset Editor</span>
        </button>
        <button type="button" class="action-tile" @click="settingsOpen = true">
          <i class="pi pi-cog action-tile__icon" />
          <span class="action-tile__label">Settings</span>
        </button>
        <button type="button" class="action-tile" :disabled="profiles.length === 0" @click="exportProfiles">
          <i class="pi pi-download action-tile__icon" />
          <span class="action-tile__label">Export SHACL</span>
        </button>
      </div>

      <div v-if="hasInspectorSelection" class="editor-inspector-overlay">
        <EditorInspector
          :shape="selectedShape"
          :property="selectedProperty"
          :profile="selectedProfile"
          :all-shapes="nodeShapes"
          :update-shape-field="profileStore.updateShapeField"
          :update-property-field="profileStore.updatePropertyField"
          :set-shape-inheritance="profileStore.setShapeInheritance"
          :set-property-node-target="profileStore.setPropertyNodeTarget"
          :set-property-type="profileStore.setPropertyType"
          :delete-shape="deleteSelectedShape"
          :delete-property="deleteSelectedProperty"
        />
      </div>
    </div>

    <EditorDialogs
      :active-import-dialog-definition="activeImportDialogDefinition"
      :active-import-dialog-visible="activeImportDialogVisible"
      :active-import-dialog-key="activeImportDialogKey"
      :active-import-dialog-props="activeImportDialogProps"
      :shape-preview-open="shapePreviewOpen"
      :preview-shape="previewShape"
      :combined-canvas-shapes-turtle="combinedCanvasShapesTurtle"
      :preview-shape-values-turtle="previewShapeValuesTurtle"
      :preview-shape-subjects="previewShapeSubjects"
      @close-import-dialog="closeImportDialog"
      @update:active-import-dialog-visible="activeImportDialogVisible = $event"
      @update:shape-preview-open="shapePreviewOpen = $event"
    />

    <Dialog
      :visible="settingsOpen"
      modal
      header="Editor Settings"
      :style="{ width: 'min(560px, 96vw)' }"
      @update:visible="settingsOpen = $event"
    >
      <div class="settings-form">
        <label class="settings-field">
          <span>Default Creator</span>
          <input v-model="defaultCreator" class="settings-input" type="text" placeholder="Creator" />
        </label>
        <label class="settings-field">
          <span>Default Creation Date</span>
          <input v-model="defaultCreated" class="settings-input" type="date" />
        </label>
        <label class="settings-field">
          <span>Default License</span>
          <select v-model="defaultLicense" class="settings-input">
            <option value=""></option>
            <option v-for="option in PROFILE_LICENSE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="settings-field">
          <span>Default Subject Heading</span>
          <select v-model="defaultSubject" class="settings-input">
            <option value=""></option>
            <option v-for="option in subjectHeadingOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <div class="settings-actions">
          <Button label="Save" icon="pi pi-check" size="small" @click="saveSettings" />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped lang="scss">
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-workspace {
  flex: 1;
  min-height: 0;
  position: relative;
}

.editor-graph-shell {
  position: relative;
  overflow: hidden;
  height: 100%;
  user-select: none;
}

.graph-status {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: var(--color-text-muted);
  font-size: 0.8rem;
  box-shadow: var(--shadow-sm);
}

.canvas-action-bar {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 6;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow-md);
}

.action-tile {
  min-width: 108px;
  min-height: 88px;
  padding: 10px 12px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: var(--color-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.action-tile:hover:not(:disabled) {
  background: var(--color-surface-2);
}

.action-tile:disabled {
  cursor: not-allowed;
  color: var(--color-text-muted);
}

.action-tile--primary {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.action-tile--primary:hover:not(:disabled) {
  background: rgba(90, 62, 155, 0.18);
}

.action-tile__icon {
  font-size: 1.9rem;
}

.action-tile__label {
  line-height: 1.25;
  text-align: center;
}

.editor-graph {
  width: 100%;
  height: 100%;
}

.canvas-hint {
  position: absolute;
  left: 50%;
  bottom: 72px;
  transform: translateX(-50%);
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--color-text-muted);
  font-size: 0.8rem;
  box-shadow: var(--shadow-sm);
  pointer-events: none;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-input {
  width: 100%;
  min-height: 42px;
  padding: 10px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font: inherit;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-2);
}

.canvas-menu {
  position: fixed;
  z-index: 12;
  display: flex;
  flex-direction: column;
  min-width: 220px;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.canvas-menu__item {
  padding: 10px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
}

.canvas-menu__item:hover {
  background: var(--color-primary-soft);
}

.canvas-menu__icon {
  font-size: 1rem;
  color: var(--color-text-muted);
}

.canvas-menu__label {
  line-height: 1.3;
}

.editor-inspector-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(500px, 42vw);
  min-width: 380px;
  max-width: 100%;
  z-index: 4;
  pointer-events: auto;
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
  user-select: none;

  .pi-plus-circle { font-size: 3rem; color: var(--color-accent); }
  .section-title { color: var(--color-text); }
  .helper-text { max-width: 560px; }
}

@media (max-width: 1100px) {
  .editor-inspector-overlay {
    width: min(100%, 520px);
    min-width: 0;
  }

  .canvas-action-bar {
    flex-wrap: wrap;
    width: min(92vw, 540px);
    justify-content: center;
    border-radius: var(--radius-md);
  }

}
</style>
