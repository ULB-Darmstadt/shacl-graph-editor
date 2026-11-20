<script setup lang="ts">
/**
 * SHACL editor main view.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { defineAsyncComponent } from 'vue'
import { loadQuantityBaseProfiles } from '@/infrastructure/external/qudtService'
import type { QuantityDefinition } from '@/application/profiles/quantityGenerator'
import { isPlaceholderTermIri } from '@/shared/rdf/placeholderTermIri'
import { storeToRefs } from 'pinia'
import { VueFlow, useVueFlow, type Connection, type XYPosition } from '@vue-flow/core'
import { combineCanvasSelection, type CanvasSelectionMode } from '@/presentation/features/editor/canvasSelection'
import ProfileDeletionDialog from '@/presentation/features/editor/components/ProfileDeletionDialog.vue'
import GettingStartedDialog from '@/presentation/features/getting-started/GettingStartedDialog.vue'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import Dialog from 'primevue/dialog'
import { useProfileEditorStore } from '@/application/profiles/profileEditorStore'
import { useEditorGraph } from '@/presentation/features/editor/useEditorGraph'
import { propertyConnectionKey } from '@/presentation/features/editor/collapsedPropertyConnections'
import { useEditorPreviews } from '@/presentation/features/editor/useEditorPreviews'
import { useEditorSelection } from '@/presentation/features/editor/useEditorSelection'
import EditorProfileSidebar, { type CanvasProfileSidebarItem } from '@/presentation/features/editor/components/EditorProfileSidebar.vue'
import { canvasShapeIncludesProfile, collectSidebarProfileShapes } from '@/presentation/features/editor/editorProfileSidebar'
import EditorDialogs from '@/presentation/features/editor/EditorDialogs.vue'
import EditorInspector from '@/presentation/features/editor/components/inspector/EditorInspector.vue'
import { useProfileWorkflowMenu } from '@/presentation/features/profile-workflow/useProfileWorkflowMenu'
import { buildEditorShapeNodeId, collectReachableShapeIris, parseEditorShapeNodeTarget, propertyGraphTargetIris } from '@/presentation/features/editor/inheritanceEditorGraph'
import type { EditorShapeReviewAnnotation } from '@/presentation/features/editor/editorGraphBuilders'
import { estimateEditorShapeHeight } from '@/presentation/features/editor/layoutEditorGraph'
import { buildEditorReviewItems, type EditorReviewItem, type EditorReviewSeverity } from '@/presentation/features/editor/editorReview'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { PROFILE_LICENSE_OPTIONS, fetchSubjectHeadingOptions, type SelectOption } from '@/application/profiles/profileEditorCatalogs'
import { inferPropertyEditorType, propertyNodeTargets, type NodeShape, type PropertyShape } from '@/domain/profiles'
import type { PropertyEditorType } from '@/application/profiles/profileEditorStore'
import { aimsProfileBadges, loadAimsProfiles, type AimsProfile } from '@/infrastructure/external/aimsProfileService'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const profileStore = useProfileEditorStore()
const QuantityGeneratorDialog = defineAsyncComponent(() => import('@/presentation/features/editor/components/QuantityGeneratorDialog.vue'))
const quantityGenerator = ref<{ connection: { shapeIri: string; propertyNodeId: string }; name: string; path: string } | null>(null)
const quantityGeneratorBusy = ref(false)
const quantityGeneratorError = ref<string | null>(null)
const toast = useToast()
const confirm = useConfirm()
const { screenToFlowCoordinate, fitView, setCenter, viewport, setViewport, nodesSelectionActive } = useVueFlow()
const deleteRequestIris = ref<string[] | null>(null)
const deleteInheritedParents = ref(false)
let middlePanAbort: AbortController | null = null
const isCanvasPanning = ref(false)
const selectionFrame = ref<{ x: number; y: number; width: number; height: number } | null>(null)
let selectionAbort: AbortController | null = null
let suppressSelectionClick = false
const deletionPlan = computed(() => profileStore.profileDeletionPlan(deleteRequestIris.value ?? [], deleteInheritedParents.value))
const deletionHasParents = computed(() => (deleteRequestIris.value ?? []).some(iri => profileStore.applicationProfile.findNodeShape(iri)?.inheritedShapeIris?.length))
const { nodeShapes, profiles, isResolvingImports, rootNodeShapes, fitViewRequestTick, canUndo, canRedo, lockImportedProfiles, lockedShapeIris } = storeToRefs(profileStore)

type EditorMode = 'edit' | 'review' | 'view'

const requestedNodePositions = ref<Record<string, XYPosition>>({})
const collapsedPropertyConnections = ref(new Set<string>())
const editorMode = ref<EditorMode>('edit')
const readOnlyMode = computed(() => editorMode.value === 'view')
const reviewMode = computed(() => editorMode.value === 'review')
const draftPropertyNodeId = ref<string | null>(null)
const sidebarHoveredShapeIri = ref<string | null>(null)
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
  previewShapeTurtle,
  openShapePreview,
} = useEditorPreviews({
  profileStore,
  profiles,
  toast,
})

const selectionImportedLocked = computed(() => Boolean(selectedShapeIri.value && (
  selectedPropertyKey.value
    ? profileStore.isPropertyLocked(selectedShapeIri.value, selectedPropertyKey.value)
    : profileStore.isShapeLocked(selectedShapeIri.value)
)))
const selectionReadOnly = computed(() => readOnlyMode.value || selectionImportedLocked.value)

function updateProfileUrl(profileIri: string, value: string): { ok: boolean; reason?: string } {
  if (readOnlyMode.value) return { ok: false, reason: 'Switch to Edit mode to change the Metadata Profile URL.' }
  const result = profileStore.updateProfileUrl(profileIri, value)
  if (result.ok && selectedShapeIri.value === profileIri) selectedShapeIri.value = value.trim()
  return result
}

function resetEditorUiState(): void {
  closeImportDialog()
  sidebarHoveredShapeIri.value = null
  shapePreviewOpen.value = false
  relationChoiceDialogOpen.value = false
  pendingConnection.value = null
  selectedConnection.value = null
  canvasMenu.value.open = false
  shapeHeaderMenu.value.open = false
  propertyMenu.value = null
  copyFieldSource.value = null
  clearSelection()
  cancelPendingProfilePlacement()
  resetPendingPlacement()
  requestedNodePositions.value = {}
  collapsedPropertyConnections.value = new Set()
  draftPropertyNodeId.value = null
}

const {
  schemaInputRef,
  csvInputRef,
  onCsvFile,
  triggerCsvUpload,
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

const showClassRelations = ref(localStorage.getItem('editor.showClassRelations') === 'true')
const showQualifiedValueShapes = ref((localStorage.getItem('editor.showQualifiedValueShapes')
  ?? localStorage.getItem('editor.showBlankNodeRelations')) === 'true')
const reviewItems = computed(() => {
  const visibleShapeIris = new Set(collectReachableShapeIris(
    rootNodeShapes.value,
    nodeShapes.value,
    showClassRelations.value,
    showQualifiedValueShapes.value,
  ))
  return buildEditorReviewItems(nodeShapes.value.filter(shape => visibleShapeIris.has(shape.nodeId.value)))
})
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

const { nodes, edges, nodeTypes, edgeTypes, hiddenProfileCount } = useEditorGraph({
  allShapes: nodeShapes,
  canvasShapes: rootNodeShapes,
  relayoutRequestTick: fitViewRequestTick,
  clearRequestedNodePositions: () => {
    requestedNodePositions.value = {}
  },
  readOnlyMode,
  lockedShapeIris,
  canEditProperty: (shapeIri, propertyNodeId) => !readOnlyMode.value && !profileStore.isPropertyLocked(shapeIri, propertyNodeId),
  reviewMode,
  showClassRelations,
  showQualifiedValueShapes,
  collapsedPropertyConnections,
  reviewAnnotations,
  openShapePreview,
  addField: createProperty,
  renameShape,
  renameProperty,
  commitDraftProperty,
  deleteProperty: deleteSelectedProperty,
  removeReferenceEdge: requestRemoveReferenceEdge,
  requestedNodePositions,
  selectedShapeIri,
  highlightedShapeIri: sidebarHoveredShapeIri,
  selectedPropertyKey,
  draftPropertyNodeId,
  selectShape,
  selectProperty,
  openShapeHeaderMenu,
  openPropertyMenu,
  moveProperty,
})

const hasNothing = computed(() => profiles.value.length === 0)
const gettingStartedOpen = ref(false)
const canvasSelectedShapeIris = computed(() => [...new Set((nodes.value as unknown as Array<{ id: string; selected?: boolean }>).filter(node => node.selected).map(node => parseEditorShapeNodeTarget(node.id)?.representedShapeIri).filter((iri): iri is string => !!iri))])
watch(() => canvasSelectedShapeIris.value.length, count => { if (count <= 1) nodesSelectionActive.value = false })
const hasInspectorSelection = computed(() => selectedShape.value !== null)
const addProfileMenuOpen = ref(false)
const settingsMenuOpen = ref(false)
const canvasMenu = ref<{ x: number; y: number; open: boolean }>({ x: 0, y: 0, open: false })
const shapeHeaderMenu = ref<{ x: number; y: number; open: boolean; shapeIri: string | null; label: string | null; allowDelete: boolean; connectionShapeIri?: string }>({
  x: 0,
  y: 0,
  open: false,
  shapeIri: null,
  label: null,
  allowDelete: true,
})
const propertyMenu = ref<{
  x: number
  y: number
  shapeIri: string
  propertyNodeId: string
  label: string
} | null>(null)
const propertyMenuRef = ref<HTMLElement | null>(null)
const copyFieldSource = ref<{ shapeIri: string; propertyNodeId: string; label: string } | null>(null)
const copyTargetShapeIri = ref('')
const copyTargetOptions = computed(() => nodeShapes.value.filter(shape => !profileStore.isShapeLocked(shape.nodeId.value)))
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
type EditorSettingsTab = 'defaults' | 'shacl-classes'

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
const editorSettingsTab = ref<EditorSettingsTab>('defaults')
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
  {
    type: 'exactlyOneOfProfiles',
    title: 'Exactly One Profile',
    shaclType: 'sh:xone',
    description: 'The field must satisfy exactly one target profile, with no overlapping matches.',
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
const serviceProfiles = ref<AimsProfile[]>([])
const serviceProfilesByIri = computed(() => new Map(serviceProfiles.value.map(profile => [profile.base_url, profile])))
const canvasProfileItems = computed<CanvasProfileSidebarItem[]>(() => {
  const visibleShapeIris = new Set<string>()

  for (const node of nodes.value) {
    const target = parseEditorShapeNodeTarget(node.id)
    if (target?.representedShapeIri) visibleShapeIris.add(target.representedShapeIri)
  }

  return collectSidebarProfileShapes(rootNodeShapes.value, nodeShapes.value)
    .map((shape) => {
      const shapeIri = shape.nodeId.value
      const profile = profiles.value.find(profile => profile.iri === shape.sourceProfileIri)
      return {
        shapeIri,
        isHidden: !Array.from(visibleShapeIris).some(visibleIri => canvasShapeIncludesProfile(visibleIri, shapeIri, nodeShapes.value)),
        label: shape.label?.trim() || 'Unnamed profile',
        isDraft: Boolean(profile && profile.origin !== 'fetched'),
        badges: profile?.origin === 'fetched' ? aimsProfileBadges(serviceProfilesByIri.value.get(profile.iri)) : [],
        description: shape.description?.trim().split(/\r?\n/, 1)[0]?.trim() || null,
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label))
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

function renameShape(shapeIri: string, label: string): void {
  profileStore.updateShapeField(shapeIri, 'label', label)
}

function renameProperty(shapeIri: string, propertyNodeId: string, name: string): void {
  profileStore.updatePropertyField(shapeIri, propertyNodeId, 'name', name)
}

function requestProfileDeletion(iris: string | string[]): void {
  if (readOnlyMode.value || isResolvingImports.value) return
  closeActionMenus()
  closeShapeHeaderMenu()
  closeCanvasMenu()
  profileStore.endHistoryGroup()
  deleteInheritedParents.value = false
  deleteRequestIris.value = typeof iris === 'string' ? [iris] : [...iris]
}

function confirmProfileDeletion(): void {
  if (!deleteRequestIris.value || readOnlyMode.value || isResolvingImports.value) return
  profileStore.removeProfiles(deleteRequestIris.value, deleteInheritedParents.value)
  deleteRequestIris.value = null
  clearSelection()
  for (const node of nodes.value as unknown as Array<{ selected?: boolean }>) node.selected = false
}

function handleCanvasPinch(event: WheelEvent): void {
  if (!event.ctrlKey) return
  event.preventDefault()
  event.stopImmediatePropagation()
  const rect = graphShellRef.value?.getBoundingClientRect()
  if (!rect) return
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const current = viewport.value
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1)
  const zoom = Math.max(0.05, Math.min(2, current.zoom * Math.exp(-delta * 0.002)))
  const ratio = zoom / current.zoom
  void setViewport({ x: x - (x - current.x) * ratio, y: y - (y - current.y) * ratio, zoom })
}

function handleCanvasMiddlePan(event: MouseEvent): void {
  if (event.button === 0 && selectionAbort) { event.preventDefault(); event.stopImmediatePropagation(); return }
  if (event.button !== 1) return
  event.preventDefault()
  event.stopImmediatePropagation()
  middlePanAbort?.abort()
  const controller = new AbortController()
  middlePanAbort = controller
  isCanvasPanning.value = true
  const initial = { ...viewport.value }
  const x = event.clientX
  const y = event.clientY
  window.addEventListener('mousemove', move => {
    void setViewport({ ...initial, x: initial.x + move.clientX - x, y: initial.y + move.clientY - y })
  }, { signal: controller.signal })
  const stop = () => { controller.abort(); middlePanAbort = null; isCanvasPanning.value = false }
  window.addEventListener('mouseup', stop, { once: true, signal: controller.signal })
  window.addEventListener('blur', stop, { once: true, signal: controller.signal })
}
onBeforeUnmount(() => { middlePanAbort?.abort(); selectionAbort?.abort() })

function syncCanvasSelectionInspector(): void {
  const iris = canvasSelectedShapeIris.value
  nodesSelectionActive.value = false
  const shape = iris.length === 1 ? profileStore.applicationProfile.findNodeShape(iris[0]) : null
  if (shape) selectShape(shape)
  else clearSelection()
}

function setCanvasSelection(ids: ReadonlySet<string>): void {
  for (const node of nodes.value as unknown as Array<{ id: string; selected?: boolean }>) node.selected = ids.has(node.id)
  nodesSelectionActive.value = false
}

function handleCanvasSelectionPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || event.pointerType === 'touch' || !(event.target instanceof Element)) return
  const node = event.target.closest<HTMLElement>('.vue-flow__node')
  const pane = event.target.matches('.vue-flow__pane')
  const modified = event.shiftKey || event.ctrlKey || event.metaKey
  if (node && !modified) return
  if (!pane && !(node && modified)) return
  if (node && event.target.closest('input, textarea, select, button, a, .vue-flow__handle, [contenteditable="true"]')) return
  const shell = graphShellRef.value
  if (!shell) return
  event.preventDefault()
  event.stopImmediatePropagation()
  closeActionMenus()
  closeCanvasMenu()
  closeShapeHeaderMenu()
  selectionAbort?.abort()
  const controller = new AbortController()
  selectionAbort = controller
  const initial = new Set((nodes.value as unknown as Array<{ id: string; selected?: boolean }>).filter(node => node.selected).map(node => node.id))
  const mode: CanvasSelectionMode = event.ctrlKey || event.metaKey ? 'remove' : event.shiftKey ? 'add' : 'replace'
  const start = { x: event.clientX, y: event.clientY }
  const bounds = shell.getBoundingClientRect()
  let dragging = false
  const select = (move: PointerEvent) => {
    if (move.pointerId !== event.pointerId) return
    if (Math.hypot(move.clientX - start.x, move.clientY - start.y) < 3 && !dragging) return
    dragging = true
    const left = Math.min(start.x, move.clientX), top = Math.min(start.y, move.clientY)
    const right = Math.max(start.x, move.clientX), bottom = Math.max(start.y, move.clientY)
    selectionFrame.value = { x: left - bounds.left, y: top - bounds.top, width: right - left, height: bottom - top }
    const hits = new Set(Array.from(shell.querySelectorAll<HTMLElement>('.vue-flow__node')).filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom
    }).map(element => element.getAttribute('data-id')!).filter(Boolean))
    setCanvasSelection(combineCanvasSelection(initial, hits, mode))
  }
  window.addEventListener('pointermove', select, { signal: controller.signal })
  const finish = (up: PointerEvent) => {
    if (up.pointerId !== event.pointerId) return
    if (!dragging) setCanvasSelection(combineCanvasSelection(initial, new Set(node?.getAttribute('data-id') ? [node.getAttribute('data-id')!] : []), mode))
    selectionFrame.value = null
    controller.abort()
    selectionAbort = null
    suppressSelectionClick = true
    window.setTimeout(() => { suppressSelectionClick = false }, 0)
    syncCanvasSelectionInspector()
  }
  window.addEventListener('pointerup', finish, { signal: controller.signal })
  const cancel = () => { setCanvasSelection(initial); selectionFrame.value = null; controller.abort(); selectionAbort = null }
  window.addEventListener('pointercancel', cancel, { once: true, signal: controller.signal })
  window.addEventListener('blur', cancel, { once: true, signal: controller.signal })
}

function handleCanvasSelectionClick(event: MouseEvent): void {
  if (suppressSelectionClick) { event.preventDefault(); event.stopImmediatePropagation(); return }
  if (!(event.target instanceof Element) || event.button !== 0) return
  const nodeId = event.target.closest<HTMLElement>('.vue-flow__node')?.getAttribute('data-id')
  if (nodeId && !event.target.closest('.vue-flow__handle')) setCanvasSelection(new Set([nodeId]))
}

function rememberDraggedNodePositions(): void {
  const positions = { ...requestedNodePositions.value }
  for (const node of nodes.value as unknown as CanvasNodePosition[]) positions[node.id] = { ...node.position }
  requestedNodePositions.value = positions
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
  propertyMenu.value = null
}

function closeActionOverlay(): void {
  sidebarHoveredShapeIri.value = null
  reviewDialogOpen.value = false
  closeImportDialog()
}

function updateActionOverlayMetrics(): void {
  actionOverlayWidth.value = canvasActionBarRef.value?.getBoundingClientRect().width ?? 0
}

function openImportOverlay(importerId: string): void {
  sidebarHoveredShapeIri.value = null
  reviewDialogOpen.value = false
  updateActionOverlayMetrics()
  openImportDialog(importerId)
  void nextTick(updateActionOverlayMetrics)
}

function handleGlobalPointerDown(event: PointerEvent): void {
  if (
    !canvasMenu.value.open
    && !shapeHeaderMenu.value.open
    && !propertyMenu.value
    && !addProfileMenuOpen.value
    && !settingsMenuOpen.value
    && !reviewDialogOpen.value
    && !activeImportDialogVisible.value
  ) return
  const target = event.target as Node | null
  if (!target) return
  if (canvasMenuRef.value?.contains(target)) return
  if (propertyMenuRef.value?.contains(target)) return
  if (canvasActionBarRef.value?.contains(target)) return
  if (settingsFabRef.value?.contains(target)) return
  if (settingsMenuRef.value?.contains(target)) return
  if (actionOverlayRef.value?.contains(target)) return

  if ((target as Element).closest?.('.shape-header-menu, .p-dialog')) return
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
  propertyMenu.value = null
  openCanvasMenu(event)
}

function openShapeHeaderMenu(shape: (typeof nodeShapes.value)[number], event: MouseEvent, options: { allowDelete?: boolean; connectionShapeIri?: string } = {}): void {
  event.preventDefault()
  event.stopPropagation()
  closeCanvasMenu()
  closeActionMenus()
  cancelPendingProfilePlacement()
  resetPendingPlacement()
  selectShape(shape)
  shapeHeaderMenu.value = {
    x: event.clientX,
    y: event.clientY,
    open: true,
    shapeIri: shape.nodeId.value,
    connectionShapeIri: options.connectionShapeIri ?? shape.nodeId.value,
    label: shape.label ?? shape.nodeId.value,
    allowDelete: !readOnlyMode.value && (options.allowDelete ?? true) && !profileStore.isShapeLocked(shape.nodeId.value),
  }
}

function openPropertyMenu(shape: NodeShape, property: PropertyShape, event: MouseEvent): void {
  if (readOnlyMode.value) return
  event.preventDefault()
  event.stopPropagation()
  closeCanvasMenu()
  closeShapeHeaderMenu()
  closeActionMenus()
  closeActionOverlay()
  cancelPendingProfilePlacement()
  resetPendingPlacement()
  selectProperty(shape, property)
  propertyMenu.value = {
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - 248)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - 260)),
    shapeIri: shape.nodeId.value,
    propertyNodeId: property.nodeId.value,
    label: property.name?.trim() || 'Unnamed field',
  }
  void nextTick(() => propertyMenuRef.value?.querySelector<HTMLButtonElement>('button')?.focus())
}

function propertyMenuConnectionsCollapsed(): boolean {
  const menu = propertyMenu.value
  return Boolean(menu && collapsedPropertyConnections.value.has(propertyConnectionKey(menu.shapeIri, menu.propertyNodeId)))
}

function propertyMenuHasConnections(): boolean {
  const menu = propertyMenu.value
  if (!menu) return false
  if (propertyMenuConnectionsCollapsed()) return true
  const property = profileStore.applicationProfile.findNodeShape(menu.shapeIri)?.properties
    .find(candidate => candidate.nodeId.value === menu.propertyNodeId)
  return Boolean(property && propertyGraphTargetIris(property, nodeShapes.value, showClassRelations.value, showQualifiedValueShapes.value).length)
}

function togglePropertyConnections(): void {
  const menu = propertyMenu.value
  if (!menu) return
  const key = propertyConnectionKey(menu.shapeIri, menu.propertyNodeId)
  const collapsed = new Set(collapsedPropertyConnections.value)
  if (collapsed.has(key)) collapsed.delete(key)
  else collapsed.add(key)
  collapsedPropertyConnections.value = collapsed
  propertyMenu.value = null
}

function profileMenuConnectionKeys(): string[] {
  const menu = shapeHeaderMenu.value
  const shapeIri = menu.shapeIri
  if (!shapeIri) return []
  const shape = profileStore.applicationProfile.findNodeShape(shapeIri)
  return (shape?.properties ?? [])
    .filter(property => propertyGraphTargetIris(property, nodeShapes.value, showClassRelations.value, showQualifiedValueShapes.value).length > 0)
    .map(property => propertyConnectionKey(menu.connectionShapeIri ?? shapeIri, property.nodeId.value))
}

function setProfileConnectionsHidden(hidden: boolean): void {
  const keys = profileMenuConnectionKeys()
  const collapsed = new Set(collapsedPropertyConnections.value)
  for (const key of keys) {
    if (hidden) collapsed.add(key)
    else collapsed.delete(key)
  }
  collapsedPropertyConnections.value = collapsed
  closeShapeHeaderMenu()
}

function showAllHiddenConnections(): void {
  collapsedPropertyConnections.value = new Set()
  closeCanvasMenu()
}

async function createAndConnectProfileFromField(): Promise<void> {
  const menu = propertyMenu.value
  if (!menu || readOnlyMode.value || profileStore.isPropertyLocked(menu.shapeIri, menu.propertyNodeId)) return
  profileStore.endHistoryGroup()
  const canvasNodes = nodes.value as unknown as CanvasNodePosition[]
  const sourceNode = canvasNodes.find(node => parseEditorShapeNodeTarget(node.id)?.representedShapeIri === menu.shapeIri)
  const anchor = sourceNode?.position ?? resolvePlacementPosition(menu.x, menu.y)
  const iri = profileStore.createConnectedProfileFromProperty(menu.shapeIri, menu.propertyNodeId)
  if (!iri) return
  applyProfileDefaults(iri)
  queueShapePlacementAt(iri, { x: anchor.x + IMPORT_HORIZONTAL_OFFSET, y: anchor.y })
  const collapsed = new Set(collapsedPropertyConnections.value)
  collapsed.delete(propertyConnectionKey(menu.shapeIri, menu.propertyNodeId))
  collapsedPropertyConnections.value = collapsed
  closeActionMenus()
  closeActionOverlay()
  resetPendingPlacement()
  const shape = profileStore.applicationProfile.findNodeShape(iri)
  if (shape) selectShape(shape)
  await nextTick()
  await waitForAnimationFrame()
  await centerShapeInCanvas(iri)
}

function openQuantityGenerator(): void {
  const menu = propertyMenu.value
  if (!menu || readOnlyMode.value || reviewMode.value || !profileStore.canCreateConnectedProfileFromProperty(menu.shapeIri, menu.propertyNodeId)) return
  const field = profileStore.applicationProfile.findNodeShape(menu.shapeIri)?.properties.find(property => property.nodeId.value === menu.propertyNodeId)
  if (!field) return
  quantityGenerator.value = { connection: { shapeIri: menu.shapeIri, propertyNodeId: menu.propertyNodeId }, name: field.name ?? '', path: field.path?.value && !isPlaceholderTermIri(field.path.value) ? field.path.value : 'http://purl.obolibrary.org/obo/BFO_0000051' }
  quantityGeneratorError.value = null
  closeActionMenus()
}

async function addGeneratedQuantity(definition: QuantityDefinition): Promise<void> {
  const context = quantityGenerator.value
  if (!context || quantityGeneratorBusy.value || readOnlyMode.value || reviewMode.value) return
  quantityGeneratorBusy.value = true
  quantityGeneratorError.value = null
  try {
    const dependencies = await loadQuantityBaseProfiles(profileStore.profiles)
    if (readOnlyMode.value || reviewMode.value) throw new Error('Return to Edit mode to add this quantity.')
    const iri = profileStore.addQuantityFromProperty(context.connection.shapeIri, context.connection.propertyNodeId, definition, dependencies)
    const canvasNodes = nodes.value as unknown as CanvasNodePosition[]
    const source = canvasNodes.find(node => {
      const target = parseEditorShapeNodeTarget(node.id)
      return target && canvasShapeIncludesProfile(target.representedShapeIri, context.connection.shapeIri, nodeShapes.value)
    })
    if (source) queueShapePlacementAt(iri, { x: source.position.x + IMPORT_HORIZONTAL_OFFSET, y: source.position.y })
    showQualifiedValueShapes.value = true
    const collapsed = new Set(collapsedPropertyConnections.value)
    collapsed.delete(propertyConnectionKey(context.connection.shapeIri, context.connection.propertyNodeId))
    collapsedPropertyConnections.value = collapsed
    resetPendingPlacement()
    quantityGenerator.value = null
    const shape = profileStore.applicationProfile.findNodeShape(iri)
    if (shape) selectShape(shape)
    await nextTick()
    await waitForAnimationFrame()
    await centerShapeInCanvas(iri)
  } catch (error) {
    quantityGeneratorError.value = error instanceof Error ? error.message : 'Could not add the quantity profile.'
  } finally {
    quantityGeneratorBusy.value = false
  }
}

function handleCopyProperty(): void {
  const menu = propertyMenu.value
  closeActionMenus()
  if (!menu || readOnlyMode.value) return
  if (profileStore.isShapeLocked(menu.shapeIri)) {
    copyFieldSource.value = menu
    copyTargetShapeIri.value = copyTargetOptions.value[0]?.nodeId.value ?? ''
    return
  }
  copyFieldToShape(menu, menu.shapeIri)
}

function copyFieldToShape(source: { shapeIri: string; propertyNodeId: string }, targetShapeIri: string): void {
  if (readOnlyMode.value) return
  const copyId = profileStore.copyProperty(source.shapeIri, source.propertyNodeId, targetShapeIri)
  const shape = profileStore.applicationProfile.findNodeShape(targetShapeIri)
  const copy = shape?.properties.find(property => property.nodeId.value === copyId)
  if (shape && copy) {
    selectProperty(shape, copy)
    copyFieldSource.value = null
  }
}

function copyFieldToExistingProfile(): void {
  if (copyFieldSource.value && copyTargetShapeIri.value) copyFieldToShape(copyFieldSource.value, copyTargetShapeIri.value)
}

function copyFieldToNewInheritedProfile(): void {
  const source = copyFieldSource.value
  if (!source || readOnlyMode.value) return
  const iri = createProfile()
  profileStore.setShapeInheritance(iri, source.shapeIri)
  copyFieldToShape(source, iri)
}

function handleDeleteProperty(): void {
  const menu = propertyMenu.value
  closeActionMenus()
  if (!menu || readOnlyMode.value || profileStore.isPropertyLocked(menu.shapeIri, menu.propertyNodeId)) return
  const property = profileStore.applicationProfile.findNodeShape(menu.shapeIri)?.properties
    .find(candidate => candidate.nodeId.value === menu.propertyNodeId)
  if (!property) return
  const owner = property.inheritedFromShapeLabel || property.inheritedFromShapeIri || 'the source profile'
  confirm.require({
    header: 'Delete field',
    message: property.inherited
      ? `This field belongs to ${owner}. Delete it from that profile and all profiles inheriting it?`
      : 'Delete this field from the profile?',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: () => {
      if (!readOnlyMode.value) deleteSelectedProperty(menu.shapeIri, menu.propertyNodeId)
    },
  })
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

function handleCsvUpload(): void {
  if (readOnlyMode.value) return
  cancelPendingProfilePlacement()
  resetPendingPlacement()
  closeCanvasMenu()
  closeActionMenus()
  closeActionOverlay()
  triggerCsvUpload()
}

function handleConfirmResetAll(): void {
  closeActionMenus()
  closeActionOverlay()
  confirmResetAll()
}

function handleResortCanvas(): void {
  if (!nodes.value.length || isResolvingImports.value) return
  closeCanvasMenu()
  closeActionMenus()
  resetPendingPlacement()
  fitViewRequestTick.value += 1
}

function handleHistoryAction(action: 'undo' | 'redo'): void {
  if (readOnlyMode.value || !profileStore[action]()) return
  closeCanvasMenu()
  closeShapeHeaderMenu()
  closeActionMenus()
  closeActionOverlay()
  cancelPendingProfilePlacement()
  resetPendingPlacement()
  pendingConnection.value = null
  selectedConnection.value = null
  draftPropertyNodeId.value = null
  shapePreviewOpen.value = false
  relationChoiceDialogOpen.value = false
  if (!selectedShape.value) clearSelection()
  else if (!selectedProperty.value) selectedPropertyKey.value = null
}

function handleExportProfiles(): void {
  closeActionMenus()
  closeActionOverlay()
  exportProfiles()
}

function openSettings(): void {
  closeActionMenus()
  closeActionOverlay()
  settingsOpen.value = true
}

function toggleImportedProfileLock(): void {
  profileStore.endHistoryGroup()
  lockImportedProfiles.value = !lockImportedProfiles.value
  closeCanvasMenu()
  closeShapeHeaderMenu()
  closeActionMenus()
  closeRelationChoiceDialog()
  closeSelectedConnectionDialog()
}

function toggleClassRelations(): void {
  if (reviewMode.value) return
  showClassRelations.value = !showClassRelations.value
  localStorage.setItem('editor.showClassRelations', String(showClassRelations.value))
}

function toggleQualifiedValueShapes(): void {
  if (reviewMode.value) return
  showQualifiedValueShapes.value = !showQualifiedValueShapes.value
  localStorage.setItem('editor.showQualifiedValueShapes', String(showQualifiedValueShapes.value))
}

function handleShapeHeaderDeleteProfile(): void {
  const shapeIri = shapeHeaderMenu.value.shapeIri
  if (!shapeIri) return
  requestProfileDeletion(canvasSelectedShapeIris.value.includes(shapeIri) && canvasSelectedShapeIris.value.length > 1 ? canvasSelectedShapeIris.value : shapeIri)
}

function handleShapeHeaderPreview(): void {
  const shapeIri = shapeHeaderMenu.value.shapeIri
  closeShapeHeaderMenu()
  const shape = shapeIri ? profileStore.applicationProfile.findNodeShape(shapeIri) : null
  if (shape) void openShapePreview(shape)
}

function handleShapeHeaderCreateInheritedProfile(): void {
  const inheritedShapeIri = shapeHeaderMenu.value.shapeIri
  if (!inheritedShapeIri) return

  const inheritedPosition = (nodes.value as unknown as CanvasNodePosition[])
    .find(node => parseEditorShapeNodeTarget(node.id)?.representedShapeIri === inheritedShapeIri)?.position
  const placement = resolvePlacementPosition(shapeHeaderMenu.value.x, shapeHeaderMenu.value.y)
  closeShapeHeaderMenu()
  pendingPlacementAnchor.value = placement
  const iri = createProfile()
  profileStore.setShapeInheritance(iri, inheritedShapeIri)
  const replacesParent = !rootNodeShapes.value.some(shape => shape.nodeId.value === inheritedShapeIri)
  queueShapePlacementAt(iri, replacesParent && inheritedPosition ? { ...inheritedPosition } : {
    x: placement.x + IMPORT_HORIZONTAL_OFFSET,
    y: placement.y,
  })
  const shape = profileStore.applicationProfile.findNodeShape(iri)
  if (shape) selectShape(shape)
  resetPendingPlacement()
}

function requestRemoveReferenceEdge(shapeIri: string, propertyNodeId: string, targetShapeIri: string): void {
  if (readOnlyMode.value || profileStore.isPropertyLocked(shapeIri, propertyNodeId)) return
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

async function handleBottomAddNewProfile(): Promise<void> {
  if (readOnlyMode.value) return
  const shell = graphShellRef.value
  if (!shell) return

  cancelPendingProfilePlacement()
  resetPendingPlacement()
  closeCanvasMenu()
  closeActionMenus()
  closeActionOverlay()

  const rect = shell.getBoundingClientRect()
  const center = resolvePlacementPosition(rect.left + rect.width / 2, rect.top + rect.height / 2)
  const iri = createProfileAt({ x: center.x - 170, y: center.y - 90 })
  resetPendingPlacement()

  await placeNewProfileAtCanvasCenter(iri)
}

async function handleCsvProfileAdded(iri: string): Promise<void> {
  closeImportDialog()
  const shape = profileStore.applicationProfile.findNodeShape(iri)
  if (shape) selectShape(shape)
  await placeNewProfileAtCanvasCenter(iri)
}

async function placeNewProfileAtCanvasCenter(iri: string): Promise<void> {
  const shell = graphShellRef.value
  const shape = profileStore.applicationProfile.findNodeShape(iri)
  if (!shell || !shape) return
  const rect = shell.getBoundingClientRect()
  const center = screenToFlowCoordinate({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  queueShapePlacementAt(iri, { x: center.x - 170, y: center.y - estimateEditorShapeHeight(shape, rootNodeShapes.value) / 2 })

  // Use the rendered dimensions and current viewport to center the whole
  // card rather than its corner.
  await nextTick()
  await waitForAnimationFrame()
  const canvasNodes = nodes.value as unknown as CanvasNodePosition[]
  const node = canvasNodes.find(candidate => candidate.id === buildEditorShapeNodeId(iri))
  if (!node) return
  const currentRect = shell.getBoundingClientRect()
  const currentCenter = screenToFlowCoordinate({
    x: currentRect.left + currentRect.width / 2,
    y: currentRect.top + currentRect.height / 2,
  })
  node.position = {
    x: currentCenter.x - (node.dimensions?.width || 340) / 2,
    y: currentCenter.y - (node.dimensions?.height || 180) / 2,
  }
  queueShapePlacementAt(iri, node.position)
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
  if ((target as Element).closest?.('.empty-state__actions, .empty-state__getting-started')) return

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
  return screenToFlowCoordinate({ x: clientX, y: clientY })
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
  if (connection.sourceHandle === 'add-field') {
    profileStore.endHistoryGroup()
    const propertyNodeId = profileStore.createConnectedPropertyFromProfile(source.representedShapeIri, target.representedShapeIri)
    if (!propertyNodeId) return
    const shape = profileStore.applicationProfile.findNodeShape(source.representedShapeIri)
    const property = shape?.properties.find(property => property.nodeId.value === propertyNodeId)
    if (shape && property) {
      draftPropertyNodeId.value = null
      selectProperty(shape, property)
    }
    return
  }
  const sourceHandle = connection.sourceHandle
  const propertyNodeId = propertyNodeIdFromReferenceHandle(sourceHandle)
  if (!propertyNodeId || !sourceHandle) return
  if (profileStore.isPropertyLocked(source.representedShapeIri, propertyNodeId)) return

  const sourceShape = nodeShapes.value.find(shape => shape.nodeId.value === source.representedShapeIri)
  const sourceProperty = sourceShape?.properties.find(property => property.nodeId.value === propertyNodeId)
  if (!sourceProperty) return

  if (sourceProperty?.editorType === 'oneOfProfiles' || sourceProperty?.editorType === 'exactlyOneOfProfiles') {
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
  sidebarHoveredShapeIri.value = null
  closeImportDialog()
  closeCanvasMenu()
  closeShapeHeaderMenu()
  closeActionMenus()
  updateActionOverlayMetrics()
  reviewDialogOpen.value = true
  void nextTick(updateActionOverlayMetrics)
}

async function focusCanvasProfile(item: CanvasProfileSidebarItem): Promise<void> {
  const shape = profileStore.applicationProfile.findNodeShape(item.shapeIri)
  if (!shape) return

  closeCanvasMenu()
  closeShapeHeaderMenu()
  closeActionMenus()
  closeActionOverlay()
  cancelPendingProfilePlacement()
  resetPendingPlacement()
  sidebarHoveredShapeIri.value = null
  selectShape(shape)
  await nextTick()
  await waitForAnimationFrame()
  await centerShapeInCanvas(item.shapeIri)
}

function openSidebarProfileMenu(item: CanvasProfileSidebarItem, event: MouseEvent): void {
  const shape = profileStore.applicationProfile.findNodeShape(item.shapeIri)
  if (shape) openShapeHeaderMenu(shape, event)
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

  if (!node) {
    node = canvasNodes.find(candidate => {
      const target = parseEditorShapeNodeTarget(candidate.id)
      return target && canvasShapeIncludesProfile(target.representedShapeIri, shapeIri, nodeShapes.value)
    })
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
  void loadAimsProfiles().then(profiles => { serviceProfiles.value = profiles }).catch(() => undefined)
  window.addEventListener('pointerdown', handleGlobalPointerDown)
  window.addEventListener('keydown', handleGlobalKeyDown)
  window.addEventListener('resize', updateActionOverlayMetrics)
  updateActionOverlayMetrics()
})

onBeforeUnmount(() => {
  profileStore.endHistoryGroup()
  window.removeEventListener('pointerdown', handleGlobalPointerDown)
  window.removeEventListener('keydown', handleGlobalKeyDown)
  window.removeEventListener('resize', updateActionOverlayMetrics)
  cancelPendingProfilePlacement()
  resetPendingPlacement()
})

function handleEditorFocusIn(event: FocusEvent): void {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    profileStore.beginHistoryGroup()
  }
}

function handleGlobalKeyDown(event: KeyboardEvent): void {
  const target = event.target
  const isEditingText = target instanceof HTMLElement
    && (target.isContentEditable || Boolean(target.closest('input, textarea, select, [role="textbox"]')))
  if (!event.defaultPrevented && !event.isComposing && !isEditingText && !event.ctrlKey && !event.metaKey && !event.altKey
    && (event.key === 'Delete' || event.key === 'Backspace') && !document.querySelector('.p-dialog-mask')
    && (!selectedPropertyKey.value || canvasSelectedShapeIris.value.length > 1)) {
    const iris = canvasSelectedShapeIris.value.length ? canvasSelectedShapeIris.value : selectedShapeIri.value && !selectedPropertyKey.value ? [selectedShapeIri.value] : []
    if (iris.length) { event.preventDefault(); requestProfileDeletion(iris); return }
  }
  if (!event.defaultPrevented && !event.isComposing && !isEditingText
    && (event.ctrlKey || event.metaKey) && !event.altKey) {
    const key = event.key.toLowerCase()
    const action = key === 'z' ? (event.shiftKey ? 'redo' : 'undo') : key === 'y' && !event.shiftKey ? 'redo' : null
    if (action) {
      event.preventDefault()
      handleHistoryAction(action)
      return
    }
  }
  if (event.key !== 'Escape') return
  if (pendingProfilePlacement.value) cancelPendingProfilePlacement()
  closeCanvasMenu()
  closeShapeHeaderMenu()
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
  <div class="editor-view" @focusin="handleEditorFocusIn" @focusout="profileStore.endHistoryGroup">
    <input ref="schemaInputRef" type="file" accept=".ttl,.shacl,text/turtle" multiple style="display:none" @change="onSchemaFiles" />
    <input ref="csvInputRef" type="file" accept=".csv,text/csv" style="display:none" @change="onCsvFile" />

    <Dialog
      v-if="activeImportDialogDefinition?.id === 'csv-upload'"
      v-model:visible="activeImportDialogVisible"
      modal
      :header="activeImportDialogDefinition.header"
      :style="{ width: activeImportDialogDefinition.width }"
    >
      <component
        :is="activeImportDialogDefinition.component"
        :key="activeImportDialogKey"
        v-bind="activeImportDialogProps"
        :metadata-defaults="{ creator: defaultCreator, created: defaultCreated, license: defaultLicense, subject: defaultSubject }"
        @added="handleCsvProfileAdded"
        @close="closeImportDialog"
        @replace="triggerCsvUpload"
      />
    </Dialog>

    <div class="editor-workspace">
      <EditorProfileSidebar
        :items="canvasProfileItems"
        :selected-shape-iri="selectedShapeIri"
        @select="focusCanvasProfile"
        @contextmenu="openSidebarProfileMenu"
        @highlight="sidebarHoveredShapeIri = $event"
      />
      <div class="editor-canvas-area">
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
            <h2 class="section-title">Where do you want to start today?</h2>
            <div class="empty-state__actions">
              <button type="button" class="empty-state__option" :disabled="readOnlyMode" @click="handleBottomAddNewProfile">
                <i class="pi pi-plus-circle" aria-hidden="true" />
                Start with new profile
              </button>
              <button type="button" class="empty-state__option" :disabled="readOnlyMode" @click="cancelPendingProfilePlacement(); handleCanvasExistingProfile()">
                <i class="pi pi-search" aria-hidden="true" />
                Load profiles from Metadata Profile Service
              </button>
              <button type="button" class="empty-state__option" :disabled="readOnlyMode" @click="cancelPendingProfilePlacement(); handleCanvasUploadProfiles()">
                <i class="pi pi-upload" aria-hidden="true" />
                Import your own profiles
              </button>
            </div>
            <p class="empty-state__tutorial-intro">Not sure where to start? Watch our short introduction.</p>
            <button type="button" class="empty-state__option empty-state__getting-started" @click="gettingStartedOpen = true">
              <i class="pi pi-play-circle" aria-hidden="true" />
              Getting Started with SHACL Editor
            </button>
          </div>

          <VueFlow
            class="editor-graph"
            :class="{ 'editor-graph--empty': hasNothing, 'editor-graph--panning': isCanvasPanning, 'editor-graph--multiselect': canvasSelectedShapeIris.length > 1 }"
            :aria-hidden="hasNothing"
            v-model:nodes="nodes"
            v-model:edges="edges"
            :node-types="nodeTypes"
            :edge-types="edgeTypes"
            :default-edge-options="{ animated: false, type: 'default' }"
            :min-zoom="0.05"
            :max-zoom="2"
            :selection-key-code="false"
            :multi-selection-key-code="null"
            :pan-on-drag="[1]"
            :pan-on-scroll="true"
            :pan-on-scroll-speed="1"
            :zoom-on-scroll="false"
            :zoom-on-pinch="true"
            :zoom-on-double-click="false"
            :delete-key-code="null"
            @wheel.capture="handleCanvasPinch"
            @mousedown.capture="handleCanvasMiddlePan"
            @pointerdown.capture="handleCanvasSelectionPointerDown"
            @click.capture="handleCanvasSelectionClick"
            @node-drag-stop="rememberDraggedNodePositions"
            fit-view-on-init
            @connect="handleConnect"
            @pane-click="handlePaneClick"
          >
            <Background pattern-color="var(--color-border)" :gap="20" />
            <Controls position="top-left" />
            <MiniMap pannable zoomable />
          </VueFlow>
          <div v-if="selectionFrame" class="canvas-selection-frame" :style="{ left: `${selectionFrame.x}px`, top: `${selectionFrame.y}px`, width: `${selectionFrame.width}px`, height: `${selectionFrame.height}px` }" aria-hidden="true" />
          <div v-if="canvasSelectedShapeIris.length > 1" class="canvas-selection-toolbar" role="region" aria-label="Selected profiles">
            <span>{{ canvasSelectedShapeIris.length }} profiles selected</span>
            <button type="button" :disabled="readOnlyMode || isResolvingImports" @click="requestProfileDeletion(canvasSelectedShapeIris)"><i class="pi pi-trash" aria-hidden="true" /> Delete selected profiles</button>
          </div>

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
              <i class="pi pi-search canvas-menu__icon" />
              <span class="canvas-menu__label">Load existing profiles</span>
            </button>
            <button type="button" class="canvas-menu__item" @click="handleCanvasUploadProfiles">
              <i class="pi pi-upload canvas-menu__icon" />
              <span class="canvas-menu__label">Import profiles</span>
            </button>
            <button type="button" class="canvas-menu__item" :disabled="collapsedPropertyConnections.size === 0" @click="showAllHiddenConnections">
              <i class="pi pi-eye canvas-menu__icon" aria-hidden="true" />
              <span class="canvas-menu__label">Show all hidden connections</span>
            </button>
            <button type="button" class="canvas-menu__item" :disabled="nodes.length === 0 || isResolvingImports" @click="handleResortCanvas">
              <i class="pi pi-sort-alt canvas-menu__icon" aria-hidden="true" />
              <span class="canvas-menu__label">Resort Canvas</span>
            </button>
            <button v-if="canvasSelectedShapeIris.length" type="button" class="canvas-menu__item canvas-menu__item--danger" :disabled="readOnlyMode || isResolvingImports" @click="requestProfileDeletion(canvasSelectedShapeIris)">
              <i class="pi pi-trash canvas-menu__icon" aria-hidden="true" />
              <span class="canvas-menu__label">Delete selected profiles</span>
            </button>
          </div>

          <div
            v-if="shapeHeaderMenu.open"
            class="canvas-menu shape-header-menu"
            :style="{ left: `${shapeHeaderMenu.x}px`, top: `${shapeHeaderMenu.y}px` }"
          >
            <div class="shape-header-menu__title">{{ shapeHeaderMenu.label ?? 'Profile' }}</div>
            <button type="button" class="canvas-menu__item" @click="handleShapeHeaderPreview">
              <i class="pi pi-code canvas-menu__icon" aria-hidden="true" />
              <span class="canvas-menu__label">Preview</span>
            </button>
            <button v-if="profileMenuConnectionKeys().length" type="button" class="canvas-menu__item" :disabled="reviewMode || profileMenuConnectionKeys().every(key => collapsedPropertyConnections.has(key))" :title="reviewMode ? 'All connections are shown in Review mode.' : undefined" @click="setProfileConnectionsHidden(true)">
              <i class="pi pi-eye-slash canvas-menu__icon" aria-hidden="true" />
              <span class="canvas-menu__label">Hide all connections</span>
            </button>
            <button v-if="profileMenuConnectionKeys().length" type="button" class="canvas-menu__item" :disabled="!profileMenuConnectionKeys().some(key => collapsedPropertyConnections.has(key))" @click="setProfileConnectionsHidden(false)">
              <i class="pi pi-eye canvas-menu__icon" aria-hidden="true" />
              <span class="canvas-menu__label">Show all connections</span>
            </button>
            <button v-if="!readOnlyMode" type="button" class="canvas-menu__item" @click="handleShapeHeaderCreateInheritedProfile">
              <i class="pi pi-sitemap canvas-menu__icon" />
              <span class="canvas-menu__label">Create inherited profile</span>
            </button>
            <button v-if="shapeHeaderMenu.allowDelete" type="button" class="canvas-menu__item canvas-menu__item--danger" @click="handleShapeHeaderDeleteProfile">
              <i class="pi pi-trash canvas-menu__icon" />
              <span class="canvas-menu__label">Delete profile</span>
            </button>
          </div>
          <div
            v-if="propertyMenu"
            ref="propertyMenuRef"
            class="canvas-menu property-menu"
            :style="{ left: `${propertyMenu.x}px`, top: `${propertyMenu.y}px` }"
            aria-label="Field actions"
            @contextmenu.stop.prevent
            @keydown.esc.stop.prevent="propertyMenu = null"
          >
            <div class="shape-header-menu__title">{{ propertyMenu.label }}</div>
            <button v-if="propertyMenuHasConnections()" type="button" class="canvas-menu__item" :disabled="reviewMode && !propertyMenuConnectionsCollapsed()" :title="reviewMode ? 'All connections are shown in Review mode.' : undefined" @click="togglePropertyConnections">
              <i :class="propertyMenuConnectionsCollapsed() ? 'pi pi-eye canvas-menu__icon' : 'pi pi-eye-slash canvas-menu__icon'" aria-hidden="true" />
              <span class="canvas-menu__label">{{ propertyMenuConnectionsCollapsed() ? 'Show connections' : 'Hide connections' }}</span>
            </button>
            <button type="button" class="canvas-menu__item canvas-menu__item--danger" :disabled="profileStore.isPropertyLocked(propertyMenu.shapeIri, propertyMenu.propertyNodeId)" @click="handleDeleteProperty">
              <i class="pi pi-trash canvas-menu__icon" aria-hidden="true" />
              <span class="canvas-menu__label">Delete</span>
            </button>
            <button type="button" class="canvas-menu__item" @click="handleCopyProperty">
              <i class="pi pi-copy canvas-menu__icon" aria-hidden="true" />
              <span class="canvas-menu__label">Add profile specific constraint</span>
            </button>
            <button type="button" class="canvas-menu__item" :disabled="!profileStore.canCreateConnectedProfileFromProperty(propertyMenu.shapeIri, propertyMenu.propertyNodeId)" @click="createAndConnectProfileFromField">
              <i class="pi pi-plus-circle canvas-menu__icon" aria-hidden="true" />
              <span class="canvas-menu__label">Create and connect Profile from Field</span>
            </button>
            <button type="button" class="canvas-menu__item" :disabled="reviewMode || !profileStore.canCreateConnectedProfileFromProperty(propertyMenu.shapeIri, propertyMenu.propertyNodeId)" @click="openQuantityGenerator">
              <i class="pi pi-calculator canvas-menu__icon" aria-hidden="true" />
              <span class="canvas-menu__label">Use Quantity Generator</span>
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
          <button type="button" class="settings-menu__item" @click="gettingStartedOpen = true; settingsMenuOpen = false">
            <i class="pi pi-play-circle" aria-hidden="true" />
            <span>Getting Started</span>
          </button>
          <button type="button" class="settings-menu__item" @click="openSettings">
            <i class="pi pi-sliders-h" />
            <span>Settings</span>
          </button>
          <button type="button" class="settings-menu__item" :disabled="nodes.length === 0 || isResolvingImports" @click="handleResortCanvas">
            <i class="pi pi-sort-alt" aria-hidden="true" />
            <span>Resort Canvas</span>
          </button>
          <button type="button" class="settings-menu__item" :disabled="!profiles.some(profile => profile.origin !== 'fetched')" @click="handleExportProfiles">
            <i class="pi pi-download" />
            <span>Export Profiles</span>
          </button>
          <button type="button" class="settings-menu__item" :disabled="readOnlyMode" @click="handleCanvasUploadProfiles">
            <i class="pi pi-upload" />
            <span>Import Profiles</span>
          </button>
          <button type="button" class="settings-menu__item" @click="handleConfirmResetAll">
            <i class="pi pi-refresh" />
            <span>Reset Editor</span>
          </button>
        </div>

        <div ref="canvasActionBarRef" class="canvas-action-bar">
          <p v-if="hiddenProfileCount > 0" class="canvas-action-bar__hidden-profiles" role="status">
            {{ hiddenProfileCount }} {{ hiddenProfileCount === 1 ? 'profile hidden' : 'profiles hidden' }}
          </p>
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
              <button type="button" class="add-profile-menu__item" @click="handleCsvUpload">
                <i class="pi pi-table" />
                <span>Upload CSV file</span>
              </button>
              <button type="button" class="add-profile-menu__item" @click="handleBottomAddNewProfile">
                <i class="pi pi-plus-circle" />
                <span>Add new Profile</span>
              </button>
              <button type="button" class="add-profile-menu__item" @click="handleCanvasExistingProfile">
                <i class="pi pi-search" />
                <span>Load existing profiles</span>
              </button>
              <button type="button" class="add-profile-menu__item" @click="handleCanvasUploadProfiles">
                <i class="pi pi-upload" />
                <span>Import Profiles</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            class="action-tile"
            title="Undo (Ctrl/Cmd+Z)"
            aria-label="Undo"
            aria-keyshortcuts="Control+z Meta+z"
            :disabled="readOnlyMode || !canUndo"
            @click="handleHistoryAction('undo')"
          >
            <i class="pi pi-undo action-tile__icon" aria-hidden="true" />
            <span class="action-tile__label">Undo</span>
          </button>
          <button
            type="button"
            class="action-tile"
            title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)"
            aria-label="Redo"
            aria-keyshortcuts="Control+Shift+z Meta+Shift+z Control+y"
            :disabled="readOnlyMode || !canRedo"
            @click="handleHistoryAction('redo')"
          >
            <i class="pi pi-undo action-tile__icon action-tile__icon--redo" aria-hidden="true" />
            <span class="action-tile__label">Redo</span>
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
          v-if="reviewDialogOpen || (activeImportDialogVisible && activeImportDialogDefinition?.id !== 'csv-upload')"
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

        <div v-if="hasInspectorSelection && canvasSelectedShapeIris.length <= 1" class="editor-inspector-overlay">
          <EditorInspector
            :shape="selectedShape"
            :property="selectedProperty"
            :profile="selectedProfile"
            :read-only="selectionReadOnly"
            :review-mode="reviewMode"
            :imported-locked="selectionImportedLocked"
            :draft-property-node-id="draftPropertyNodeId"
            :all-shapes="nodeShapes"
            :create-property="createProperty"
            :commit-draft-property="commitDraftProperty"
            :update-shape-field="profileStore.updateShapeField"
            :update-profile-url="updateProfileUrl"
            :update-property-field="profileStore.updatePropertyField"
            :set-shape-inheritance="profileStore.setShapeInheritance"
            :set-property-node-target="profileStore.setPropertyNodeTarget"
            :set-property-inline-node-shape="profileStore.setPropertyInlineNodeShape"
            :set-property-inline-node-shape-label="profileStore.setPropertyInlineNodeShapeLabel"
            :set-property-alternative-targets="profileStore.setPropertyAlternativeTargets"
            :set-property-exclusive-datatype-alternatives="profileStore.setPropertyExclusiveDatatypeAlternatives"
            :set-property-type="profileStore.setPropertyType"
            :request-delete-shape="requestProfileDeletion"
            :delete-property="deleteSelectedProperty"
          />
        </div>
      </div>
    </div>

    <ProfileDeletionDialog
      v-if="deleteRequestIris"
      :plan="deletionPlan"
      v-model:include-parents="deleteInheritedParents"
      :has-parents="deletionHasParents"
      :busy="isResolvingImports"
      @close="deleteRequestIris = null"
      @confirm="confirmProfileDeletion"
    />
    <QuantityGeneratorDialog
      v-if="quantityGenerator"
      :initial-name="quantityGenerator.name"
      :initial-path="quantityGenerator.path"
      :busy="quantityGeneratorBusy"
      :error="quantityGeneratorError"
      @close="quantityGenerator = null"
      @add="addGeneratedQuantity"
    />
    <EditorDialogs
      :shape-preview-open="shapePreviewOpen"
      :preview-shape="previewShape"
      :combined-canvas-shapes-turtle="combinedCanvasShapesTurtle"
      :preview-shape-turtle="previewShapeTurtle"
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
      :visible="copyFieldSource !== null"
      modal
      header="Copy field to own properties"
      :style="{ width: 'min(520px, 96vw)' }"
      @update:visible="visible => { if (!visible) copyFieldSource = null }"
    >
      <p>The source profile is locked. Choose where to copy {{ copyFieldSource?.label ?? 'this field' }}.</p>
      <label v-if="copyTargetOptions.length > 0" class="settings-field">
        <span>Editable profile</span>
        <select v-model="copyTargetShapeIri" class="settings-input">
          <option v-for="shape in copyTargetOptions" :key="shape.nodeId.value" :value="shape.nodeId.value">
            {{ shape.label || 'Unnamed profile' }}
          </option>
        </select>
      </label>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="copyFieldSource = null" />
        <Button label="Create inherited profile" severity="secondary" @click="copyFieldToNewInheritedProfile" />
        <Button v-if="copyTargetOptions.length > 0" label="Copy" icon="pi pi-copy" :disabled="!copyTargetShapeIri" @click="copyFieldToExistingProfile" />
      </template>
    </Dialog>

    <Dialog
      :visible="settingsOpen"
      modal
      header="Settings"
      :style="{ width: 'min(560px, 96vw)' }"
      @update:visible="settingsOpen = $event"
    >
      <div class="settings-tabs" role="tablist" aria-label="Editor settings sections">
        <button
          type="button"
          role="tab"
          class="settings-tab"
          :class="{ 'is-active': editorSettingsTab === 'defaults' }"
          :aria-selected="editorSettingsTab === 'defaults'"
          @click="editorSettingsTab = 'defaults'"
        >
          Defaults
        </button>
        <button
          type="button"
          role="tab"
          class="settings-tab"
          :class="{ 'is-active': editorSettingsTab === 'shacl-classes' }"
          :aria-selected="editorSettingsTab === 'shacl-classes'"
          @click="editorSettingsTab = 'shacl-classes'"
        >
          Display Settings
        </button>
      </div>

      <div v-if="editorSettingsTab === 'defaults'" class="settings-form" role="tabpanel">
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

      <div v-else class="settings-form" role="tabpanel">
        <div class="settings-toggle-row">
          <span>Lock existing profiles for editing</span>
          <button
            type="button"
            role="switch"
            class="settings-toggle"
            :class="{ 'is-on': lockImportedProfiles }"
            :aria-checked="lockImportedProfiles"
            aria-label="Lock existing profiles for editing"
            @click="toggleImportedProfileLock"
          >
            <span class="settings-toggle__thumb" />
          </button>
        </div>
        <div class="settings-toggle-row">
          <span>Display profiles linked by sh:class</span>
          <button
            type="button"
            role="switch"
            class="settings-toggle"
            :class="{ 'is-on': reviewMode || showClassRelations }"
            :aria-checked="reviewMode || showClassRelations"
            :disabled="reviewMode"
            :title="reviewMode ? 'Always shown in Review mode.' : undefined"
            aria-label="Display profiles linked by sh:class"
            @click="toggleClassRelations"
          >
            <span class="settings-toggle__thumb" />
          </button>
        </div>
        <div class="settings-toggle-row">
          <span>Display profiles linked by sh:qualifiedValueShape</span>
          <button
            type="button"
            role="switch"
            class="settings-toggle"
            :class="{ 'is-on': reviewMode || showQualifiedValueShapes }"
            :aria-checked="reviewMode || showQualifiedValueShapes"
            :disabled="reviewMode"
            :title="reviewMode ? 'Always shown in Review mode.' : undefined"
            aria-label="Display profiles linked by sh:qualifiedValueShape"
            @click="toggleQualifiedValueShapes"
          >
            <span class="settings-toggle__thumb" />
          </button>
        </div>
        <p class="helper-text">Referenced profiles are loaded regardless of these display settings. Enable a switch to show the linked profiles and connections on the canvas.</p>
        <p v-if="reviewMode" class="helper-text">Review mode always shows all linked profiles. Your display preferences will apply again when you leave Review mode.</p>
      </div>
    </Dialog>
    <GettingStartedDialog v-if="gettingStartedOpen" @close="gettingStartedOpen = false" />
  </div>
</template>

<style scoped lang="scss">
.editor-graph { cursor: default; }
:deep(.vue-flow__pane), :deep(.vue-flow__pane.selection), :deep(.vue-flow__pane.draggable), :deep(.vue-flow__nodesselection-rect) { cursor: default; }
:deep(.vue-flow__node), :deep(.vue-flow__node.draggable), :deep(.shape-node) { cursor: pointer; }
:deep(.vue-flow__pane.dragging), :deep(.vue-flow__node.draggable.dragging), :deep(.vue-flow__node.draggable.dragging .shape-node), :deep(.vue-flow__nodesselection-rect.dragging) { cursor: grabbing; }
.editor-graph--panning, .editor-graph--panning :deep(*) { cursor: grabbing !important; }
.canvas-selection-toolbar { position: absolute; top: 14px; right: 16px; z-index: 6; display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text-muted); font-size: 0.82rem; }
.canvas-selection-toolbar button { display: flex; align-items: center; gap: 6px; border: 0; padding: 3px; background: transparent; color: #b42323; font: inherit; cursor: pointer; }
.canvas-selection-toolbar button:disabled { opacity: 0.5; cursor: default; }
.editor-graph--multiselect :deep(.vue-flow__node.selected .shape-node) { outline: 2px solid var(--color-primary); outline-offset: 2px; }
:deep(.vue-flow__selection) { background: var(--color-primary-soft); border: 1px solid var(--color-primary); }
:deep(.vue-flow__nodesselection) { display: none; }
.canvas-selection-frame { position: absolute; z-index: 5; pointer-events: none; background: var(--color-primary-soft); border: 1px solid var(--color-primary); }
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}

.editor-canvas-area {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
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
  max-width: calc(100% - 24px);
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

.canvas-action-bar__hidden-profiles {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
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
  min-width: 230px;
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
  font-size: 0.86rem;
  white-space: nowrap;
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

.action-tile__icon--redo {
  transform: scaleX(-1);
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
  min-width: 230px;
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
  font-size: 0.86rem;
  white-space: nowrap;
  text-align: left;
  cursor: pointer;
}

.add-profile-menu__item:hover {
  background: var(--color-primary-soft);
}

.action-menu-divider {
  width: 1px;
  align-self: stretch;
  margin-block: -8px;
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

.editor-graph--empty {
  // Preserve layout and viewport initialization behind the welcome screen.
  visibility: hidden;
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

.settings-tabs {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.settings-tab {
  padding: 8px 2px 10px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  cursor: pointer;
}

.settings-tab.is-active {
  border-bottom-color: var(--color-primary);
  color: var(--color-text);
}

.settings-toggle-row {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.settings-toggle {
  position: relative;
  flex: 0 0 auto;
  width: 42px;
  height: 24px;
  padding: 2px;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface-2);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.settings-toggle.is-on {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.settings-toggle__thumb {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
  transition: transform 0.15s ease;
}

.settings-toggle.is-on .settings-toggle__thumb {
  transform: translateX(18px);
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

.relation-tile:hover:not(:disabled) {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.relation-tile:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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
  font-size: 0.86rem;
  white-space: nowrap;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
}

.property-menu {
  width: 240px;
  min-width: 0;
}

.property-menu .shape-header-menu__title {
  max-height: 52px;
  overflow: hidden;
}

.property-menu .canvas-menu__label {
  white-space: normal;
  line-height: 1.35;
}

.canvas-menu__item:hover:not(:disabled) {
  background: var(--color-primary-soft);
}

.canvas-menu__item--danger {
  color: #b42323;
}

.canvas-menu__item--danger:hover:not(:disabled) {
  background: #fff1f1;
}

.canvas-menu__icon {
  font-size: 1rem;
  color: var(--color-text-muted);
}

.canvas-menu__item:disabled {
  color: var(--color-text-muted);
  cursor: not-allowed;
  opacity: 0.55;
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

  .section-title {
    color: var(--color-text-muted);
    font-size: 1.35rem;
    font-weight: 400;
  }
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  width: min(100%, 900px);
  margin-top: var(--space-3);
}

.empty-state__tutorial-intro {
  margin: var(--space-4) 0 0;
  font-size: 0.86rem;
  line-height: 1.5;
}

.empty-state__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.86rem;
  font-weight: 400;
  cursor: pointer;

  &:hover:not(:disabled) { background: var(--color-surface-2); color: var(--color-text); }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
}

.empty-state__getting-started {
  padding: 12px 20px;
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: white;
  font-weight: 600;
  box-shadow: var(--shadow-sm);

  .pi { font-size: 1.1rem; }

  &:hover:not(:disabled) {
    border-color: var(--color-primary-hover);
    background: var(--color-primary-hover);
    color: white;
  }
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
