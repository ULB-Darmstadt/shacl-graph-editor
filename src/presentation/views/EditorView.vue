<script setup lang="ts">
/**
 * SHACL editor main view.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
import { buildEditorShapeNodeId, parseEditorShapeNodeTarget } from '@/presentation/features/editor/inheritanceEditorGraph'
import type { EditorShapeReviewAnnotation } from '@/presentation/features/editor/editorGraphBuilders'
import { estimateEditorShapeHeight } from '@/presentation/features/editor/layoutEditorGraph'
import { buildEditorReviewItems, type EditorReviewItem, type EditorReviewSeverity } from '@/presentation/features/editor/editorReview'
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
const { screenToFlowCoordinate, fitView, setCenter } = useVueFlow()
const { nodeShapes, profiles, isResolvingImports, rootNodeShapes, fitViewRequestTick } = storeToRefs(profileStore)

type EditorMode = 'edit' | 'review' | 'view'

const requestedNodePositions = ref<Record<string, XYPosition>>({})
const editorMode = ref<EditorMode>('edit')
const readOnlyMode = computed(() => editorMode.value === 'view')
const reviewMode = computed(() => editorMode.value === 'review')
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
  shapeHeaderMenu.value.open = false
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

const reviewItems = computed(() => buildEditorReviewItems(nodeShapes.value))
const reviewAnnotations = computed(() => {
  const annotations = new Map<string, EditorShapeReviewAnnotation>()

  for (const item of reviewItems.value) {
    const current = annotations.get(item.shapeIri) ?? { shapeSeverity: null, propertySeverities: {} }
    if (item.subject === 'profile') {
      current.shapeSeverity = strongerReviewSeverity(current.shapeSeverity ?? null, item.severity)
    } else if (item.propertyNodeId) {
      current.propertySeverities = {
        ...current.propertySeverities,
        [item.propertyNodeId]: strongerReviewSeverity(current.propertySeverities?.[item.propertyNodeId] ?? null, item.severity),
      }
    }
    annotations.set(item.shapeIri, current)
  }

  return annotations
})

const { nodes, edges, nodeTypes, edgeTypes } = useEditorGraph({
  allShapes: nodeShapes,
  canvasShapes: rootNodeShapes,
  relayoutRequestTick: fitViewRequestTick,
  clearRequestedNodePositions: () => {
    requestedNodePositions.value = {}
  },
  readOnlyMode,
  reviewMode,
  reviewAnnotations,
  openShapePreview,
  addField: createProperty,
  removeReferenceEdge: requestRemoveReferenceEdge,
  requestedNodePositions,
  selectedShapeIri,
  selectedPropertyKey,
  selectShape,
  selectProperty,
  openShapeHeaderMenu,
  moveProperty,
})

const hasNothing = computed(() => profiles.value.length === 0)
const hasInspectorSelection = computed(() => selectedShape.value !== null)
const addProfileMenuOpen = ref(false)
const settingsMenuOpen = ref(false)
const canvasMenu = ref<{ x: number; y: number; open: boolean }>({ x: 0, y: 0, open: false })
const shapeHeaderMenu = ref<{ x: number; y: number; open: boolean; shapeIri: string | null; label: string | null; allowDelete: boolean }>({
  x: 0,
  y: 0,
  open: false,
  shapeIri: null,
  label: null,
  allowDelete: true,
})
const relationChoiceDialogOpen = ref(false)
type EditableConnection = {
  sourceShapeIri: string
  sourceHandle: string
  targetShapeIri: string
}

type CanvasNodePosition = {
  id: string
  position: XYPosition
  dimensions?: {
    width?: number
    height?: number
  }
}

type ReviewSeverityFilter = 'all' | 'urgent' | 'warning'

const pendingConnection = ref<EditableConnection | null>(null)
const selectedConnection = ref<EditableConnection | null>(null)
const graphShellRef = ref<HTMLElement | null>(null)
const canvasMenuRef = ref<HTMLElement | null>(null)
const canvasActionBarRef = ref<HTMLElement | null>(null)
const settingsMenuRef = ref<HTMLElement | null>(null)
const settingsFabRef = ref<HTMLElement | null>(null)
const actionOverlayRef = ref<HTMLElement | null>(null)
const actionOverlayWidth = ref(0)
const settingsOpen = ref(false)
const reviewDialogOpen = ref(false)
const reviewSeverityFilter = ref<ReviewSeverityFilter>('all')
const reviewSearch = ref('')
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

const EDITOR_MODE_OPTIONS: Array<{ value: EditorMode; label: string; icon: string }> = [
  { value: 'edit', label: 'Edit', icon: 'pi pi-pencil' },
  { value: 'review', label: 'Review', icon: 'pi pi-flag' },
  { value: 'view', label: 'View', icon: 'pi pi-eye' },
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
const urgentReviewItems = computed(() => reviewItems.value.filter(item => item.severity === 'urgent'))
const actionOverlayStyle = computed(() => ({
  width: actionOverlayWidth.value > 0 ? `${actionOverlayWidth.value}px` : 'min(92vw, 760px)',
}))
const filteredReviewItems = computed(() => {
  const needle = reviewSearch.value.trim().toLowerCase()
  return reviewItems.value.filter(item => {
    if (reviewSeverityFilter.value !== 'all' && item.severity !== reviewSeverityFilter.value) return false
    if (!needle) return true
    const haystack = [
      item.title,
      item.message,
      item.profileLabel,
      item.propertyLabel,
      item.subject,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
})
const filteredUrgentReviewItems = computed(() => filteredReviewItems.value.filter(item => item.severity === 'urgent'))
const filteredWarningReviewItems = computed(() => filteredReviewItems.value.filter(item => item.severity === 'warning'))

const isPlacementHintVisible = computed(() => pendingProfilePlacement.value && placementPreviewClientPosition.value !== null)
const placementHintStyle = computed(() => {
  if (!placementPreviewClientPosition.value || !graphShellRef.value) return null
  const rect = graphShellRef.value.getBoundingClientRect()
  return {
    left: `${placementPreviewClientPosition.value.x - rect.left + 18}px`,
    top: `${placementPreviewClientPosition.value.y - rect.top + 18}px`,
  }
})

function strongerReviewSeverity(
  current: EditorReviewSeverity | null,
  next: EditorReviewSeverity,
): EditorReviewSeverity {
  return current === 'urgent' || next === 'urgent' ? 'urgent' : 'warning'
}

function setEditorMode(mode: EditorMode): void {
  editorMode.value = mode
  closeActionMenus()
  closeActionOverlay()
}

function createProfile(): string {
  const iri = profileStore.createProfile()
  queueShapePlacement(iri, 0)
  applyProfileDefaults(iri)
  const shape = profileStore.applicationProfile.findNodeShape(iri)
  if (shape) selectShape(shape)
  return iri
}

function createProfileAt(position: XYPosition): string {
  pendingPlacementAnchor.value = position
  return createProfile()
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

function moveProperty(sourceShapeIri: string, propertyNodeId: string, targetShapeIri: string, targetIndex?: number): boolean {
  const moved = profileStore.movePropertyToShape(sourceShapeIri, propertyNodeId, targetShapeIri, targetIndex)
  if (!moved) return false

  const targetShape = profileStore.applicationProfile.findNodeShape(targetShapeIri)
  const movedProperty = targetShape?.properties.find(property => property.nodeId.value === propertyNodeId)
  if (targetShape && movedProperty) selectProperty(targetShape, movedProperty)
  return true
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

function closeShapeHeaderMenu(): void {
  shapeHeaderMenu.value.open = false
}

function closeActionMenus(): void {
  addProfileMenuOpen.value = false
  settingsMenuOpen.value = false
}

function closeActionOverlay(): void {
  reviewDialogOpen.value = false
  closeImportDialog()
}

function updateActionOverlayMetrics(): void {
  actionOverlayWidth.value = canvasActionBarRef.value?.getBoundingClientRect().width ?? 0
}

function openImportOverlay(importerId: string): void {
  reviewDialogOpen.value = false
  updateActionOverlayMetrics()
  openImportDialog(importerId)
  void nextTick(updateActionOverlayMetrics)
}

function handleGlobalPointerDown(event: PointerEvent): void {
  if (
    !canvasMenu.value.open
    && !shapeHeaderMenu.value.open
    && !addProfileMenuOpen.value
    && !settingsMenuOpen.value
    && !reviewDialogOpen.value
    && !activeImportDialogVisible.value
  ) return
  const target = event.target as Node | null
  if (!target) return
  if (canvasMenuRef.value?.contains(target)) return
  if (canvasActionBarRef.value?.contains(target)) return
  if (settingsFabRef.value?.contains(target)) return
  if (settingsMenuRef.value?.contains(target)) return
  if (actionOverlayRef.value?.contains(target)) return
  if ((target as Element).closest?.('.shape-header-menu')) return
  closeCanvasMenu()
  closeShapeHeaderMenu()
  closeActionMenus()
  closeActionOverlay()
}

function handlePaneClick(): void {
  if (pendingProfilePlacement.value) return
  clearSelection()
  closeCanvasMenu()
  closeShapeHeaderMenu()
  closeActionMenus()
  closeActionOverlay()
}

function handleShellContextMenu(event: MouseEvent): void {
  if (readOnlyMode.value) return
  event.preventDefault()
  closeShapeHeaderMenu()
  openCanvasMenu(event)
}

function openShapeHeaderMenu(shape: (typeof nodeShapes.value)[number], event: MouseEvent, options: { allowDelete?: boolean } = {}): void {
  if (readOnlyMode.value) return
  event.preventDefault()
  event.stopPropagation()
  closeCanvasMenu()
  cancelPendingProfilePlacement()
  resetPendingPlacement()
  selectShape(shape)
  shapeHeaderMenu.value = {
    x: event.clientX,
    y: event.clientY,
    open: true,
    shapeIri: shape.nodeId.value,
    label: shape.label ?? shape.nodeId.value,
    allowDelete: options.allowDelete ?? true,
  }
}

function handleCanvasNewProfile(): void {
  if (readOnlyMode.value) return
  const shouldPlaceImmediately = pendingPlacementAnchor.value !== null
  closeCanvasMenu()
  closeActionMenus()
  closeActionOverlay()
  if (shouldPlaceImmediately) {
    createProfileAt(pendingPlacementAnchor.value as XYPosition)
    return
  }
  beginPendingProfilePlacement()
}

function handleCanvasExistingProfile(): void {
  if (readOnlyMode.value) return
  closeCanvasMenu()
  closeActionMenus()
  openImportOverlay('aims-profile-catalog')
}

function handleCanvasUploadProfiles(): void {
  if (readOnlyMode.value) return
  closeCanvasMenu()
  closeActionMenus()
  closeActionOverlay()
  triggerSchemaUpload()
}

function handleConfirmResetAll(): void {
  closeActionMenus()
  closeActionOverlay()
  confirmResetAll()
}

function handleExportProfiles(): void {
  closeActionMenus()
  closeActionOverlay()
  exportProfiles()
}

function openDefaultSettings(): void {
  closeActionMenus()
  closeActionOverlay()
  settingsOpen.value = true
}

function handleShapeHeaderDeleteProfile(): void {
  const shapeIri = shapeHeaderMenu.value.shapeIri
  if (!shapeIri) return
  closeShapeHeaderMenu()

  confirm.require({
    header: 'Delete profile',
    message: 'Delete this profile from the editor?',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: () => {
      const result = deleteSelectedShape(shapeIri)
      if (!result.ok) window.alert(result.reason ?? 'Profile cannot be deleted.')
    },
  })
}

function handleShapeHeaderCreateInheritedProfile(): void {
  const inheritedShapeIri = shapeHeaderMenu.value.shapeIri
  if (!inheritedShapeIri) return

  const placement = resolvePlacementPosition(shapeHeaderMenu.value.x, shapeHeaderMenu.value.y)
  closeShapeHeaderMenu()
  pendingPlacementAnchor.value = placement
  const iri = createProfile()
  profileStore.setShapeInheritance(iri, inheritedShapeIri)
  queueShapePlacementAt(iri, {
    x: placement.x + IMPORT_HORIZONTAL_OFFSET,
    y: placement.y,
  })
  const shape = profileStore.applicationProfile.findNodeShape(iri)
  if (shape) selectShape(shape)
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
  addProfileMenuOpen.value = !addProfileMenuOpen.value
  settingsMenuOpen.value = false
  closeCanvasMenu()
  closeShapeHeaderMenu()
  closeActionOverlay()
}

function handleBottomAddNewProfile(): void {
  resetPendingPlacement()
  pendingPlacementAnchor.value = null
  handleCanvasNewProfile()
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
  if (actionOverlayRef.value?.contains(target)) return

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

function openReviewDialog(): void {
  closeImportDialog()
  closeCanvasMenu()
  closeShapeHeaderMenu()
  closeActionMenus()
  updateActionOverlayMetrics()
  reviewDialogOpen.value = true
  void nextTick(updateActionOverlayMetrics)
}

async function jumpToReviewItem(item: EditorReviewItem): Promise<void> {
  const shape = profileStore.applicationProfile.findNodeShape(item.shapeIri)
  if (!shape) return

  editorMode.value = 'review'

  if (item.propertyNodeId) {
    const property = shape.properties.find(candidate => candidate.nodeId.value === item.propertyNodeId)
    if (property) selectProperty(shape, property)
    else selectShape(shape)
  } else {
    selectShape(shape)
  }

  reviewDialogOpen.value = false
  await nextTick()
  await waitForAnimationFrame()
  await centerShapeInCanvas(item.shapeIri)
}

async function centerShapeInCanvas(shapeIri: string): Promise<void> {
  const preferredNodeId = buildEditorShapeNodeId(shapeIri)
  let node: CanvasNodePosition | undefined
  const canvasNodes = nodes.value as unknown as CanvasNodePosition[]

  for (const candidate of canvasNodes) {
    if (candidate.id === preferredNodeId) {
      node = candidate
      break
    }
    const target = parseEditorShapeNodeTarget(candidate.id)
    if (target?.representedShapeIri === shapeIri) {
      node = candidate
      break
    }
  }

  if (!node) return
  const dimensions = node.dimensions
  await setCenter(
    node.position.x + ((dimensions?.width ?? 340) / 2),
    node.position.y + ((dimensions?.height ?? 220) / 2),
    { zoom: 0.9, duration: 250 },
  )
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
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
  window.addEventListener('resize', updateActionOverlayMetrics)
  updateActionOverlayMetrics()
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown)
  window.removeEventListener('keydown', handleGlobalKeyDown)
  window.removeEventListener('resize', updateActionOverlayMetrics)
  cancelPendingProfilePlacement()
  resetPendingPlacement()
})

function handleGlobalKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (pendingProfilePlacement.value) cancelPendingProfilePlacement()
  closeActionMenus()
  closeActionOverlay()
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
            <span class="canvas-menu__label">Search profiles</span>
          </button>
          <button type="button" class="canvas-menu__item" @click="handleCanvasUploadProfiles">
            <i class="pi pi-upload canvas-menu__icon" />
            <span class="canvas-menu__label">Import profiles</span>
          </button>
        </div>

        <div
          v-if="shapeHeaderMenu.open"
          class="canvas-menu shape-header-menu"
          :style="{ left: `${shapeHeaderMenu.x}px`, top: `${shapeHeaderMenu.y}px` }"
        >
          <div class="shape-header-menu__title">{{ shapeHeaderMenu.label ?? 'Profile' }}</div>
          <button type="button" class="canvas-menu__item" @click="handleShapeHeaderCreateInheritedProfile">
            <i class="pi pi-sitemap canvas-menu__icon" />
            <span class="canvas-menu__label">Create inherited profile</span>
          </button>
          <button v-if="shapeHeaderMenu.allowDelete" type="button" class="canvas-menu__item canvas-menu__item--danger" @click="handleShapeHeaderDeleteProfile">
            <i class="pi pi-trash canvas-menu__icon" />
            <span class="canvas-menu__label">Delete profile</span>
          </button>
        </div>
      </div>

      <button
        ref="settingsFabRef"
        type="button"
        class="settings-fab"
        title="Settings"
        aria-label="Settings"
        @click.stop="settingsMenuOpen = !settingsMenuOpen; addProfileMenuOpen = false"
      >
        <i class="pi pi-cog" />
      </button>
      <div v-if="settingsMenuOpen" ref="settingsMenuRef" class="settings-menu">
        <button type="button" class="settings-menu__item" @click="openDefaultSettings">
          <i class="pi pi-sliders-h" />
          <span>Default Settings</span>
        </button>
        <button type="button" class="settings-menu__item" :disabled="profiles.length === 0" @click="handleExportProfiles">
          <i class="pi pi-download" />
          <span>Export Profiles</span>
        </button>
        <button type="button" class="settings-menu__item" :disabled="readOnlyMode" @click="handleCanvasUploadProfiles">
          <i class="pi pi-upload" />
          <span>Import Profiles</span>
        </button>
      </div>

      <div ref="canvasActionBarRef" class="canvas-action-bar">
        <div class="add-profile-control">
          <button type="button" class="action-tile action-tile--primary add-profile-main" :disabled="readOnlyMode" @click="handleBottomAddNewProfile">
            <i class="pi pi-plus-circle action-tile__icon" />
            <span class="action-tile__label">Add Profile</span>
          </button>
          <button
            type="button"
            class="add-profile-menu-trigger"
            title="Choose profile action"
            aria-label="Choose profile action"
            :disabled="readOnlyMode"
            @click.stop="openBottomAddMenu"
          >
            <i class="pi pi-chevron-down" />
          </button>
          <div v-if="addProfileMenuOpen" class="add-profile-menu">
            <button type="button" class="add-profile-menu__item" @click="handleBottomAddNewProfile">
              <i class="pi pi-plus-circle" />
              <span>Add new Profile</span>
            </button>
            <button type="button" class="add-profile-menu__item" @click="handleCanvasExistingProfile">
              <i class="pi pi-book" />
              <span>Search existing profiles</span>
            </button>
            <button type="button" class="add-profile-menu__item" @click="handleCanvasUploadProfiles">
              <i class="pi pi-upload" />
              <span>Import Profiles</span>
            </button>
          </div>
        </div>
        <button type="button" class="action-tile" @click="handleConfirmResetAll">
          <i class="pi pi-refresh action-tile__icon" />
          <span class="action-tile__label">Reset Editor</span>
        </button>
        <button type="button" class="action-tile action-tile--review" :disabled="profiles.length === 0" @click="openReviewDialog">
          <i class="pi pi-verified action-tile__icon" />
          <span class="action-tile__label">Review</span>
          <span v-if="reviewItems.length > 0" class="review-count" :class="{ 'has-urgent': urgentReviewItems.length > 0 }">{{ reviewItems.length }}</span>
        </button>
        <div class="action-menu-divider" aria-hidden="true" />
        <div class="mode-segment" aria-label="Editor mode">
          <button
            v-for="option in EDITOR_MODE_OPTIONS"
            :key="option.value"
            type="button"
            class="mode-segment__button"
            :class="{ 'is-active': editorMode === option.value }"
            @click="setEditorMode(option.value)"
          >
            <i :class="option.icon" />
            <span>{{ option.label }}</span>
          </button>
        </div>
      </div>

      <div
        v-if="reviewDialogOpen || activeImportDialogVisible"
        ref="actionOverlayRef"
        class="action-menu-overlay"
        :style="actionOverlayStyle"
      >
        <component
          :is="activeImportDialogDefinition.component"
          v-if="activeImportDialogDefinition && activeImportDialogVisible"
          :key="activeImportDialogKey"
          v-bind="activeImportDialogProps"
          class="action-menu-overlay__body"
          @added="closeImportDialog"
        />

        <div v-else-if="reviewDialogOpen" class="review-overlay">
          <div class="review-overlay__search">
            <input
              v-model="reviewSearch"
              class="review-search-input"
              type="search"
              placeholder="Search review findings"
            />
          </div>

          <div v-if="reviewItems.length > 0" class="review-filters" aria-label="Review filters">
            <div class="review-filter-group" aria-label="Severity">
              <button
                type="button"
                class="review-filter"
                :class="{ 'is-active': reviewSeverityFilter === 'all' }"
                @click="reviewSeverityFilter = 'all'"
              >
                All
              </button>
              <button
                type="button"
                class="review-filter"
                :class="{ 'is-active': reviewSeverityFilter === 'urgent' }"
                @click="reviewSeverityFilter = 'urgent'"
              >
                Urgent
              </button>
              <button
                type="button"
                class="review-filter"
                :class="{ 'is-active': reviewSeverityFilter === 'warning' }"
                @click="reviewSeverityFilter = 'warning'"
              >
                Warning
              </button>
            </div>
          </div>

          <div v-if="reviewItems.length === 0" class="review-empty">
            No review findings.
          </div>

          <div v-else-if="filteredReviewItems.length === 0" class="review-empty">
            No findings match the current filters.
          </div>

          <div v-else class="review-list">
            <section v-if="filteredUrgentReviewItems.length > 0" class="review-group">
              <h3 class="review-group__title">
                <span>Urgent</span>
              </h3>
              <button
                v-for="item in filteredUrgentReviewItems"
                :key="item.id"
                type="button"
                class="review-item"
                :class="`is-${item.severity}`"
                @click="jumpToReviewItem(item)"
              >
                <span class="review-item__body">
                  <strong class="review-item__title">{{ item.title }}</strong>
                  <span class="review-item__target">
                    {{ item.subject === 'profile' ? 'Profile' : 'Property' }}:
                    {{ item.profileLabel }}<template v-if="item.propertyLabel"> / {{ item.propertyLabel }}</template>
                  </span>
                </span>
                <i class="pi pi-arrow-right review-item__icon" />
              </button>
            </section>

            <section v-if="filteredWarningReviewItems.length > 0" class="review-group">
              <h3 class="review-group__title">
                <span>Warnings</span>
              </h3>
              <button
                v-for="item in filteredWarningReviewItems"
                :key="item.id"
                type="button"
                class="review-item"
                :class="`is-${item.severity}`"
                @click="jumpToReviewItem(item)"
              >
                <span class="review-item__body">
                  <strong class="review-item__title">{{ item.title }}</strong>
                  <span class="review-item__target">
                    {{ item.subject === 'profile' ? 'Profile' : 'Property' }}:
                    {{ item.profileLabel }}<template v-if="item.propertyLabel"> / {{ item.propertyLabel }}</template>
                  </span>
                </span>
                <i class="pi pi-arrow-right review-item__icon" />
              </button>
            </section>
          </div>
        </div>
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
      :shape-preview-open="shapePreviewOpen"
      :preview-shape="previewShape"
      :combined-canvas-shapes-turtle="combinedCanvasShapesTurtle"
      :preview-shape-values-turtle="previewShapeValuesTurtle"
      :preview-shape-subjects="previewShapeSubjects"
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
  gap: 14px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
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

.settings-menu {
  position: absolute;
  left: 18px;
  bottom: 86px;
  z-index: 20;
  min-width: 210px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.settings-menu__item {
  width: 100%;
  display: grid;
  grid-template-columns: 22px 1fr;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.settings-menu__item:hover:not(:disabled) {
  background: var(--color-surface-2);
}

.settings-menu__item:disabled {
  cursor: not-allowed;
  color: var(--color-text-muted);
}

.action-tile {
  min-width: 72px;
  min-height: 59px;
  padding: 7px 8px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--color-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
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
  font-size: 1.27rem;
}

.action-tile__label {
  font-size: 0.72rem;
  line-height: 1.25;
  text-align: center;
}

.action-tile--review {
  position: relative;
}

.add-profile-control {
  position: relative;
  display: grid;
  grid-template-columns: minmax(72px, auto) 20px;
  gap: 3px;
  align-items: stretch;
}

.add-profile-main {
  min-width: 72px;
  border-radius: 9px;
}

.add-profile-menu-trigger {
  width: 20px;
  min-height: 59px;
  border: 0;
  border-radius: 9px;
  background: var(--color-surface);
  color: var(--color-primary);
  cursor: pointer;
  font-size: 0.48rem;
}

.add-profile-menu-trigger:hover:not(:disabled) {
  background: var(--color-surface-2);
}

.add-profile-menu-trigger:disabled {
  cursor: not-allowed;
  color: var(--color-text-muted);
  background: transparent;
}

.add-profile-menu-trigger .pi {
  font-size: 0.48rem;
}

.add-profile-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 20;
  min-width: 190px;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.add-profile-menu__item {
  width: 100%;
  display: grid;
  grid-template-columns: 22px 1fr;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.add-profile-menu__item:hover {
  background: var(--color-primary-soft);
}

.action-menu-divider {
  width: 1px;
  align-self: stretch;
  min-height: 48px;
  background: rgba(15, 23, 42, 0.14);
}

.mode-segment {
  display: inline-flex;
  align-items: stretch;
  gap: 3px;
  padding: 3px;
  border-radius: 12px;
  background: #f3f4f6;
}

.mode-segment__button {
  min-width: 64px;
  min-height: 59px;
  padding: 7px 8px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.mode-segment__button:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}

.mode-segment__button.is-active {
  background: var(--color-surface);
  color: #111827;
  box-shadow: var(--shadow-sm);
}

.mode-segment__button .pi {
  font-size: 1.15rem;
}

.mode-segment__button span {
  font-size: 0.72rem;
  line-height: 1.25;
}

.review-count {
  position: absolute;
  top: -7px;
  right: -7px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #f59e0b;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 20px;
  box-shadow: var(--shadow-sm);
}

.review-count.has-urgent {
  background: #dc2626;
}

.action-menu-overlay {
  position: absolute;
  left: 50%;
  bottom: 106px;
  transform: translateX(-50%);
  z-index: 15;
  height: 520px;
  max-height: min(72vh, 520px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface) 98%, transparent);
  box-shadow: var(--shadow-md);
  pointer-events: auto;
}

.action-menu-overlay__body {
  min-height: 0;
  flex: 1;
}

.editor-graph {
  width: 100%;
  height: 100%;
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

.review-overlay {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.review-overlay__search {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.review-search-input {
  width: 100%;
  min-height: 36px;
  padding: 8px 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-1);
  color: var(--color-text);
  font: inherit;
  outline: none;
}

.review-search-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.14);
}

.review-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: var(--space-2) var(--space-3) 0;
}

.review-filter-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.review-filter {
  min-height: 30px;
  padding: 5px 11px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: #a3a3a3;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.review-filter:hover {
  color: #111827;
}

.review-filter.is-active {
  background: #f3f4f6;
  color: #111827;
}

.review-empty {
  margin: var(--space-3);
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  text-align: center;
}

.review-list {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
  padding: var(--space-3);
}

.review-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.review-group__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--color-text);
  font-size: 0.86rem;
  font-weight: 800;
}

.review-item {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-left-width: 4px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.review-item:hover {
  background: var(--color-surface-1);
  box-shadow: var(--shadow-sm);
}

.review-item.is-urgent {
  border-left-color: #dc2626;
}

.review-item.is-warning {
  border-left-color: #f59e0b;
}

.review-item__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.review-item__title {
  color: var(--color-text);
}

.review-item__target {
  color: var(--color-text-muted);
  font-size: 0.82rem;
  overflow-wrap: anywhere;
}

.review-item__icon {
  color: var(--color-text-muted);
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

.canvas-menu__item--danger {
  color: #b42323;
}

.canvas-menu__item--danger:hover {
  background: #fff1f1;
}

.canvas-menu__icon {
  font-size: 1rem;
  color: var(--color-text-muted);
}

.canvas-menu__item--danger .canvas-menu__icon {
  color: #b42323;
}

.canvas-menu__label {
  line-height: 1.3;
}

.shape-header-menu__title {
  max-width: 280px;
  padding: 8px 12px 6px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 700;
  overflow-wrap: anywhere;
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
    width: min(92vw, 640px);
    justify-content: center;
    border-radius: var(--radius-md);
  }

}
</style>
