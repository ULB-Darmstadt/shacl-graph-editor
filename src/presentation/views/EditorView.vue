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
import { inferPropertyEditorType, propertyNodeTargets } from '@/domain/profiles'
import type { PropertyEditorType } from '@/application/profiles/profileEditorStore'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const profileStore = useProfileEditorStore()
const toast = useToast()
const confirm = useConfirm()
const { screenToFlowCoordinate, fitView } = useVueFlow()
const { nodeShapes, profiles, isResolvingImports, rootNodeShapes, fitViewRequestTick } = storeToRefs(profileStore)

const requestedNodePositions = ref<Record<string, XYPosition>>({})
const readOnlyMode = ref(false)
const draftPropertyNodeId = ref<string | null>(null)
const pendingPlacementAnchor = ref<XYPosition | null>(null)
const pendingPlacementOffset = ref(0)
const pendingProfilePlacement = ref(false)
const placementPreviewClientPosition = ref<{ x: number; y: number } | null>(null)
const placementPreviewFlowPosition = ref<XYPosition | null>(null)
const lastGraphPointerClientPosition = ref<{ x: number; y: number } | null>(null)
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
  relationChoiceDialogOpen.value = false
  pendingConnection.value = null
  selectedConnection.value = null
  canvasMenu.value.open = false
  clearSelection()
  cancelPendingProfilePlacement()
  resetPendingPlacement()
  requestedNodePositions.value = {}
  draftPropertyNodeId.value = null
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
  relayoutRequestTick: fitViewRequestTick,
  clearRequestedNodePositions: () => {
    requestedNodePositions.value = {}
  },
  readOnlyMode,
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
const modeToggleLabel = computed(() => readOnlyMode.value ? 'View Mode' : 'Edit Mode')
const modeToggleIcon = computed(() => readOnlyMode.value ? 'pi pi-eye' : 'pi pi-pencil')
const canvasMenu = ref<{ x: number; y: number; open: boolean }>({ x: 0, y: 0, open: false })
const relationChoiceDialogOpen = ref(false)
type EditableConnection = {
  sourceShapeIri: string
  sourceHandle: string
  targetShapeIri: string
}
const pendingConnection = ref<EditableConnection | null>(null)
const selectedConnection = ref<EditableConnection | null>(null)
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

const CONNECTABLE_RELATION_OPTIONS: Array<{
  type: PropertyEditorType
  title: string
  shaclType: string
  description: string
}> = [
  {
    type: 'profile',
    title: 'Satisfies Profile',
    shaclType: 'sh:node',
    description: 'The field must match exactly this target profile.',
  },
  {
    type: 'qualifiedProfile',
    title: 'Satisfies Profile (m-n times)',
    shaclType: 'sh:qualifiedValueShape',
    description: 'The field matches this target profile with qualified min/max counts.',
  },
  {
    type: 'oneOfProfiles',
    title: 'Satisfies One Of Profiles',
    shaclType: 'sh:or',
    description: 'The field may satisfy one of several target profiles.',
  },
]

const activeEditableConnection = computed(() => pendingConnection.value ?? selectedConnection.value)
const activeConnectionSourcePropertyLabel = computed(() => {
  const sourceHandle = activeEditableConnection.value?.sourceHandle
  const sourceShapeIri = activeEditableConnection.value?.sourceShapeIri
  if (!sourceHandle?.startsWith('ref:') || !sourceShapeIri) return null
  const propertyNodeId = sourceHandle.slice('ref:'.length)
  const shape = nodeShapes.value.find(candidate => candidate.nodeId.value === sourceShapeIri)
  const property = shape?.properties.find(candidate => candidate.nodeId.value === propertyNodeId)
  return property?.name ?? property?.path?.value ?? 'selected field'
})

const activeConnectionTargetLabel = computed(() => {
  const targetShapeIri = activeEditableConnection.value?.targetShapeIri
  if (!targetShapeIri) return null
  const targetShape = nodeShapes.value.find(candidate => candidate.nodeId.value === targetShapeIri)
  return targetShape?.label ?? targetShapeIri
})
const selectedConnectionType = computed<PropertyEditorType | null>(() => {
  const connection = selectedConnection.value
  if (!connection) return null
  const property = propertyForConnection(connection)
  return property ? (property.editorType ?? inferPropertyEditorType(property)) as PropertyEditorType : null
})

const isPlacementHintVisible = computed(() => pendingProfilePlacement.value && placementPreviewClientPosition.value !== null)
const placementHintStyle = computed(() => {
  if (!placementPreviewClientPosition.value || !graphShellRef.value) return null
  const rect = graphShellRef.value.getBoundingClientRect()
  return {
    left: `${placementPreviewClientPosition.value.x - rect.left + 18}px`,
    top: `${placementPreviewClientPosition.value.y - rect.top + 18}px`,
  }
})

function createProfile(): void {
  const iri = profileStore.createProfile()
  queueShapePlacement(iri, 0)
  applyProfileDefaults(iri)
  const shape = profileStore.applicationProfile.findNodeShape(iri)
  if (shape) selectShape(shape)
}

function createProfileAt(position: XYPosition): void {
  pendingPlacementAnchor.value = position
  createProfile()
}

function createProperty(shapeIri: string): void {
  const propertyNodeId = profileStore.createProperty(shapeIri)
  const shape = profileStore.applicationProfile.findNodeShape(shapeIri)
  const property = shape?.properties.find(candidate => candidate.nodeId.value === propertyNodeId)
  if (shape && property) {
    draftPropertyNodeId.value = property.nodeId.value
    selectProperty(shape, property)
  }
}

function deleteSelectedShape(shapeIri: string): { ok: boolean; reason?: string } {
  const result = profileStore.removeProfile(shapeIri)
  if (result.ok) clearSelection()
  return result
}

function deleteSelectedProperty(shapeIri: string, propertyNodeId: string): boolean {
  const deleted = profileStore.removeProperty(shapeIri, propertyNodeId)
  if (deleted) {
    if (draftPropertyNodeId.value === propertyNodeId) {
      draftPropertyNodeId.value = null
    }
    const shape = profileStore.applicationProfile.findNodeShape(shapeIri)
    if (shape) selectShape(shape)
    else clearSelection()
  }
  return deleted
}

function commitDraftProperty(propertyNodeId: string): void {
  if (draftPropertyNodeId.value === propertyNodeId) {
    draftPropertyNodeId.value = null
  }
}

function openCanvasMenu(event: MouseEvent): void {
  cancelPendingProfilePlacement()
  resetPendingPlacement()
  pendingPlacementAnchor.value = resolvePlacementPosition(event.clientX, event.clientY)
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
  if (pendingProfilePlacement.value) return
  clearSelection()
  closeCanvasMenu()
}

function handleShellContextMenu(event: MouseEvent): void {
  if (readOnlyMode.value) return
  event.preventDefault()
  openCanvasMenu(event)
}

function handleCanvasNewProfile(): void {
  if (readOnlyMode.value) return
  const shouldPlaceImmediately = pendingPlacementAnchor.value !== null
  closeCanvasMenu()
  if (shouldPlaceImmediately) {
    createProfileAt(pendingPlacementAnchor.value as XYPosition)
    return
  }
  beginPendingProfilePlacement()
}

function handleCanvasExistingProfile(): void {
  if (readOnlyMode.value) return
  closeCanvasMenu()
  openImportDialog('aims-profile-catalog')
}

function handleCanvasUploadProfiles(): void {
  if (readOnlyMode.value) return
  closeCanvasMenu()
  triggerSchemaUpload()
}

function requestRemoveReferenceEdge(shapeIri: string, propertyNodeId: string, targetShapeIri: string): void {
  if (readOnlyMode.value) return
  selectedConnection.value = {
    sourceShapeIri: shapeIri,
    sourceHandle: `ref:${propertyNodeId}`,
    targetShapeIri,
  }
}

function openBottomAddMenu(): void {
  if (readOnlyMode.value) return
  closeCanvasMenu()
  resetPendingPlacement()
  pendingPlacementAnchor.value = null
  beginPendingProfilePlacement()
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

function beginPendingProfilePlacement(): void {
  const shell = graphShellRef.value
  if (!shell) return

  pendingProfilePlacement.value = true
  closeCanvasMenu()

  const rect = shell.getBoundingClientRect()
  const pointer = lastGraphPointerClientPosition.value ?? {
    x: rect.left + (rect.width / 2),
    y: rect.top + (rect.height / 2),
  }
  updatePlacementPreview(pointer.x, pointer.y)
}

function cancelPendingProfilePlacement(): void {
  pendingProfilePlacement.value = false
  placementPreviewClientPosition.value = null
  placementPreviewFlowPosition.value = null
}

function updatePlacementPreview(clientX: number, clientY: number): void {
  lastGraphPointerClientPosition.value = { x: clientX, y: clientY }
  if (!pendingProfilePlacement.value) return

  placementPreviewClientPosition.value = { x: clientX, y: clientY }
  placementPreviewFlowPosition.value = resolvePlacementPosition(clientX, clientY)
}

function handleGraphPointerMove(event: PointerEvent): void {
  updatePlacementPreview(event.clientX, event.clientY)
}

function handleGraphShellClick(event: MouseEvent): void {
  if (!pendingProfilePlacement.value || event.button !== 0) return

  const target = event.target as Node | null
  if (!target) return
  if (canvasMenuRef.value?.contains(target)) return
  if (canvasActionBarRef.value?.contains(target)) return

  event.preventDefault()
  event.stopPropagation()

  const placement = placementPreviewFlowPosition.value ?? resolvePlacementPosition(
    event.clientX,
    event.clientY,
  )

  cancelPendingProfilePlacement()
  createProfileAt(placement)
}

function resolvePlacementPosition(clientX: number, clientY: number): XYPosition {
  if (!hasNothing.value) {
    return screenToFlowCoordinate({ x: clientX, y: clientY })
  }

  const shellRect = graphShellRef.value?.getBoundingClientRect()
  if (!shellRect) {
    return { x: clientX, y: clientY }
  }

  return {
    x: clientX - shellRect.left,
    y: clientY - shellRect.top,
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
  if (readOnlyMode.value) return
  const source = connection.source ? parseEditorShapeNodeTarget(connection.source) : null
  const target = connection.target ? parseEditorShapeNodeTarget(connection.target) : null
  if (!source?.representedShapeIri || !target?.representedShapeIri) return
  const sourceHandle = connection.sourceHandle
  const propertyNodeId = propertyNodeIdFromReferenceHandle(sourceHandle)
  if (!propertyNodeId || !sourceHandle) return
  if (source.representedShapeIri === target.representedShapeIri) return

  const sourceShape = nodeShapes.value.find(shape => shape.nodeId.value === source.representedShapeIri)
  const sourceProperty = sourceShape?.properties.find(property => property.nodeId.value === propertyNodeId)
  if (!sourceProperty) return

  if (sourceProperty?.editorType === 'oneOfProfiles') {
    profileStore.connectPropertyToShape(
      source.representedShapeIri,
      sourceHandle,
      target.representedShapeIri,
    )
    return
  }

  pendingConnection.value = {
    sourceShapeIri: source.representedShapeIri,
    sourceHandle,
    targetShapeIri: target.representedShapeIri,
  }
  relationChoiceDialogOpen.value = true
}

function propertyNodeIdFromReferenceHandle(sourceHandle: string | null | undefined): string | null {
  if (!sourceHandle?.startsWith('ref:')) return null
  const propertyNodeId = sourceHandle.slice('ref:'.length).trim()
  return propertyNodeId ? propertyNodeId : null
}

function closeRelationChoiceDialog(): void {
  relationChoiceDialogOpen.value = false
  pendingConnection.value = null
}

function applyConnectionRelation(type: PropertyEditorType): void {
  const connection = pendingConnection.value
  if (!connection) return

  const propertyNodeId = propertyNodeIdFromReferenceHandle(connection.sourceHandle)
  if (!propertyNodeId) {
    closeRelationChoiceDialog()
    return
  }

  profileStore.setPropertyType(connection.sourceShapeIri, propertyNodeId, type)
  profileStore.connectPropertyToShape(
    connection.sourceShapeIri,
    connection.sourceHandle,
    connection.targetShapeIri,
  )
  closeRelationChoiceDialog()
}

function closeSelectedConnectionDialog(): void {
  selectedConnection.value = null
}

function updateSelectedConnectionDialogVisible(visible: boolean): void {
  if (!visible) closeSelectedConnectionDialog()
}

function applySelectedConnectionRelation(type: PropertyEditorType): void {
  const connection = selectedConnection.value
  if (!connection) return

  const propertyNodeId = propertyNodeIdFromReferenceHandle(connection.sourceHandle)
  if (!propertyNodeId) {
    closeSelectedConnectionDialog()
    return
  }

  profileStore.setPropertyType(connection.sourceShapeIri, propertyNodeId, type)
  profileStore.connectPropertyToShape(
    connection.sourceShapeIri,
    connection.sourceHandle,
    connection.targetShapeIri,
  )
  closeSelectedConnectionDialog()
}

function removeSelectedConnection(): void {
  const connection = selectedConnection.value
  if (!connection) return

  const propertyNodeId = propertyNodeIdFromReferenceHandle(connection.sourceHandle)
  if (!propertyNodeId) {
    closeSelectedConnectionDialog()
    return
  }

  profileStore.removePropertyTarget(connection.sourceShapeIri, propertyNodeId, connection.targetShapeIri)
  closeSelectedConnectionDialog()
}

function propertyForConnection(connection: EditableConnection): (typeof nodeShapes.value)[number]['properties'][number] | null {
  const propertyNodeId = propertyNodeIdFromReferenceHandle(connection.sourceHandle)
  if (!propertyNodeId) return null

  const shape = nodeShapes.value.find(candidate => candidate.nodeId.value === connection.sourceShapeIri)
  return shape?.properties.find(property => property.nodeId.value === propertyNodeId) ?? null
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

watch(nodes, nextNodes => {
  const nextPositions: Record<string, XYPosition> = {}

  for (const node of nextNodes) {
    nextPositions[node.id] = {
      x: node.position.x,
      y: node.position.y,
    }
  }

  const currentEntries = Object.entries(requestedNodePositions.value)
  const nextEntries = Object.entries(nextPositions)
  const unchanged = currentEntries.length === nextEntries.length
    && nextEntries.every(([nodeId, position]) => {
      const current = requestedNodePositions.value[nodeId]
      return current?.x === position.x && current?.y === position.y
    })

  if (!unchanged) {
    requestedNodePositions.value = nextPositions
  }
}, { deep: true })

function resolveConnectedPlacement(
  shape: (typeof rootNodeShapes.value)[number],
  allShapes: (typeof rootNodeShapes.value),
  knownPositions: Map<string, XYPosition>,
  anchorUsage: Map<string, number>,
  anchorOffsets: Map<string, number>,
): XYPosition | null {
  const incomingSources = allShapes.filter(candidate =>
    candidate.properties.some(property => propertyNodeTargets(property).some(target => target.value === shape.nodeId.value)),
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
    for (const target of propertyNodeTargets(property)) {
      const targetPosition = knownPositions.get(target.value)
      if (!targetPosition) continue
      return resolveAnchoredPlacement(
        shape,
        allShapes,
        targetPosition,
        `left:${target.value}`,
        anchorUsage,
        anchorOffsets,
        -IMPORT_HORIZONTAL_OFFSET,
      )
    }
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

watch(fitViewRequestTick, (tick) => {
  if (tick <= 0) return

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void fitView({
        padding: 0.18,
        duration: 250,
      })
    })
  })
})

onMounted(() => {
  window.addEventListener('pointerdown', handleGlobalPointerDown)
  window.addEventListener('keydown', handleGlobalKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown)
  window.removeEventListener('keydown', handleGlobalKeyDown)
  cancelPendingProfilePlacement()
  resetPendingPlacement()
})

function handleGlobalKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !pendingProfilePlacement.value) return
  cancelPendingProfilePlacement()
}

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
      <div
        ref="graphShellRef"
        class="editor-graph-shell"
        :class="{ 'is-placement-active': pendingProfilePlacement }"
        @contextmenu="handleShellContextMenu"
        @pointermove="handleGraphPointerMove"
        @click.capture="handleGraphShellClick"
      >
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
            :min-zoom="0.05"
            :max-zoom="2"
            fit-view-on-init
            @connect="handleConnect"
            @pane-click="handlePaneClick"
          >
            <Background pattern-color="var(--color-border)" :gap="20" />
            <Controls position="top-left" />
            <MiniMap pannable zoomable />
          </VueFlow>

          <div class="canvas-hint">
            {{ pendingProfilePlacement ? 'Move the profile and click to place it. Press Escape to cancel.' : 'Use Add Profile below or right-click empty canvas.' }}
          </div>
        </template>

        <div
          v-if="isPlacementHintVisible && placementHintStyle"
          class="placement-hint-float"
          :style="placementHintStyle"
          aria-hidden="true"
        >
          <span class="placement-hint-float__plus">+</span>
          <span>Click to add</span>
        </div>

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

      <button type="button" class="settings-fab" title="Settings" aria-label="Settings" @click="settingsOpen = true">
        <i class="pi pi-cog" />
      </button>

      <div ref="canvasActionBarRef" class="canvas-action-bar">
        <button type="button" class="action-tile action-tile--primary" :disabled="readOnlyMode" @click="openBottomAddMenu">
          <i class="pi pi-plus-circle action-tile__icon" />
          <span class="action-tile__label">Add new profile</span>
        </button>
        <button type="button" class="action-tile" :disabled="readOnlyMode" @click="handleCanvasExistingProfile">
          <i class="pi pi-book action-tile__icon" />
          <span class="action-tile__label">Load existing profiles</span>
        </button>
        <button type="button" class="action-tile" :disabled="readOnlyMode" @click="handleCanvasUploadProfiles">
          <i class="pi pi-upload action-tile__icon" />
          <span class="action-tile__label">Upload profiles</span>
        </button>
        <button type="button" class="action-tile" @click="confirmResetAll">
          <i class="pi pi-refresh action-tile__icon" />
          <span class="action-tile__label">Reset Editor</span>
        </button>
        <button type="button" class="action-tile action-tile--mode" @click="readOnlyMode = !readOnlyMode">
          <i :class="modeToggleIcon" class="action-tile__icon" />
          <span class="action-tile__label">{{ modeToggleLabel }}</span>
        </button>
        <button type="button" class="action-tile" :disabled="profiles.length === 0" @click="exportProfiles">
          <i class="pi pi-download action-tile__icon" />
          <span class="action-tile__label">Export Profiles</span>
        </button>
      </div>

      <div v-if="hasInspectorSelection" class="editor-inspector-overlay">
        <EditorInspector
          :shape="selectedShape"
          :property="selectedProperty"
          :profile="selectedProfile"
          :read-only="readOnlyMode"
          :draft-property-node-id="draftPropertyNodeId"
          :all-shapes="nodeShapes"
          :create-property="createProperty"
          :commit-draft-property="commitDraftProperty"
          :update-shape-field="profileStore.updateShapeField"
          :update-property-field="profileStore.updatePropertyField"
          :set-shape-inheritance="profileStore.setShapeInheritance"
          :set-property-node-target="profileStore.setPropertyNodeTarget"
          :set-property-alternative-targets="profileStore.setPropertyAlternativeTargets"
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
      :visible="relationChoiceDialogOpen"
      modal
      header="Choose relation type"
      :style="{ width: 'min(760px, 96vw)' }"
      @update:visible="relationChoiceDialogOpen = $event"
      @hide="closeRelationChoiceDialog"
    >
      <div class="relation-choice">
        <p class="relation-choice__intro">
          Choose how
          <strong>{{ activeConnectionSourcePropertyLabel ?? 'this field' }}</strong>
          should point to
          <strong>{{ activeConnectionTargetLabel ?? 'this profile' }}</strong>.
        </p>
        <div class="relation-choice__grid">
          <button
            v-for="option in CONNECTABLE_RELATION_OPTIONS"
            :key="option.type"
            type="button"
            class="relation-tile"
            @click="applyConnectionRelation(option.type)"
          >
            <strong class="relation-tile__title">{{ option.title }}</strong>
            <span class="relation-tile__code">{{ option.shaclType }}</span>
            <span class="relation-tile__description">{{ option.description }}</span>
          </button>
        </div>
      </div>
    </Dialog>

    <Dialog
      :visible="selectedConnection !== null"
      modal
      header="Edit connection"
      :style="{ width: 'min(760px, 96vw)' }"
      @update:visible="updateSelectedConnectionDialogVisible"
      @hide="closeSelectedConnectionDialog"
    >
      <div class="relation-choice">
        <p class="relation-choice__intro">
          Change how
          <strong>{{ activeConnectionSourcePropertyLabel ?? 'this field' }}</strong>
          points to
          <strong>{{ activeConnectionTargetLabel ?? 'this profile' }}</strong>,
          or remove the connection.
        </p>
        <div class="relation-choice__grid">
          <button
            v-for="option in CONNECTABLE_RELATION_OPTIONS"
            :key="option.type"
            type="button"
            class="relation-tile"
            :class="{ 'is-selected': selectedConnectionType === option.type }"
            @click="applySelectedConnectionRelation(option.type)"
          >
            <strong class="relation-tile__title">{{ option.title }}</strong>
            <span class="relation-tile__code">{{ option.shaclType }}</span>
            <span class="relation-tile__description">{{ option.description }}</span>
          </button>
        </div>
        <div class="connection-dialog-actions">
          <Button label="Remove connection" icon="pi pi-trash" severity="danger" size="small" @click="removeSelectedConnection" />
        </div>
      </div>
    </Dialog>

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

.editor-graph-shell.is-placement-active {
  cursor: copy;
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

.settings-fab {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 6;
  width: 56px;
  height: 56px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  color: var(--color-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.settings-fab:hover {
  background: var(--color-surface-2);
  transform: translateY(-1px);
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

.canvas-action-bar .action-tile:nth-child(4) {
  position: relative;
  margin-left: 10px;
  margin-right: 10px;
}

.canvas-action-bar .action-tile:nth-child(4)::before,
.canvas-action-bar .action-tile:nth-child(4)::after {
  content: '';
  position: absolute;
  top: -10px;
  bottom: -10px;
  width: 1px;
  background: rgba(15, 23, 42, 0.12);
}

.canvas-action-bar .action-tile:nth-child(4)::before {
  left: -10px;
}

.canvas-action-bar .action-tile:nth-child(4)::after {
  right: -10px;
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

.placement-hint-float {
  position: absolute;
  z-index: 7;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(90, 62, 155, 0.35);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: var(--color-text);
  font-size: 0.82rem;
  font-weight: 600;
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(4px);
}

.placement-hint-float__plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.95rem;
  line-height: 1;
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

.relation-choice {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.relation-choice__intro {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.relation-choice__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
}

.relation-tile {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 148px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-1) 100%);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.relation-tile:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.relation-tile.is-selected {
  border-color: var(--color-primary);
  box-shadow: inset 3px 0 0 var(--color-primary), var(--shadow-sm);
}

.relation-tile__title {
  color: var(--color-text);
  line-height: 1.35;
}

.relation-tile__code {
  color: var(--color-primary);
  font-family: var(--font-mono);
  font-size: 0.82rem;
  line-height: 1.35;
}

.relation-tile__description {
  color: var(--color-text-muted);
  line-height: 1.5;
}

.connection-dialog-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
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
