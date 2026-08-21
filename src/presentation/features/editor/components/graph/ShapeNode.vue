<script lang="ts">
import { reactive } from 'vue'

interface PropertyDragPayload {
  sourceShapeIri: string
  propertyNodeId: string
  label: string
}

const PROPERTY_DRAG_MIME_TYPE = 'application/x-aims-property'
const activePropertyDrag = reactive<{
  payload: PropertyDragPayload | null
  x: number
  y: number
  hasLeftSource: boolean
}>({
  payload: null,
  x: 0,
  y: 0,
  hasLeftSource: false,
})
</script>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { propertyConstraintSummary, propertyNodeTargets, type NodeShape, type PropertyShape } from '@/domain/profiles'
import { EDITOR_NODE_COLORS } from '@/presentation/features/editor/editorGraphTheme'
import { propertyGraphTargetIris, type ShapeEditorNodeData } from '@/presentation/features/editor/inheritanceEditorGraph'
import { useProfileEditorStore } from '@/application/profiles/profileEditorStore'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{ data: ShapeEditorNodeData }>()
const profiles = useProfileEditorStore()
const dragOverAllowed = ref(false)
const dragOverBlocked = ref(false)
const dropPreviewIndex = ref<number | null>(null)
const ownPropertiesListRef = ref<HTMLElement | null>(null)
const shapeNodeRef = ref<HTMLElement | null>(null)
const editingShapeIri = ref<string | null>(null)
const editingPropertyKey = ref<string | null>(null)
const inlineNameDraft = ref('')
const inlineOriginalName = ref('')

const label = () => props.data.shape.label?.trim() || 'Unnamed profile'
const inheritedProperties = () => props.data.shape.properties.slice(0, inheritedPropertyPrefixCount())
const ownProperties = () => props.data.ownProperties ?? props.data.shape.properties.slice(inheritedPropertyPrefixCount())
const visibleOwnProperties = computed(() =>
  ownProperties().filter(property => !isSourcePropertyHidden(property)),
)
const inheritedSections = () => flattenInheritedGroups(props.data.inheritedGroups ?? [])

function propertyLabel(property: PropertyShape): string {
  return property.name?.trim() || 'Unnamed field'
}

function propertyKey(property: PropertyShape): string {
  return property.nodeId.value
}

function propertyEditKey(shapeIri: string, property: PropertyShape): string {
  return `${shapeIri}::${property.nodeId.value}`
}

function isDraftProperty(property: PropertyShape): boolean {
  return props.data.draftPropertyNodeId === property.nodeId.value
}

function isSelectedShape(): boolean {
  return props.data.selected === true
}

function isSelectedProfile(): boolean {
  return isSelectedShape() && !props.data.selectedPropertyKey
}

function isSelectedInheritedProfile(shapeIri: string): boolean {
  return props.data.selectedShapeIri === shapeIri && !props.data.selectedPropertyKey
}

function isSelectedProperty(property: PropertyShape): boolean {
  return props.data.selectedPropertyKey === propertyKey(property)
}

function reviewClass(severity: 'urgent' | 'warning' | null | undefined): string | null {
  if (!props.data.reviewMode || !severity) return null
  return severity === 'urgent' ? 'is-review-urgent' : 'is-review-warning'
}

function shapeReviewClass(): string | null {
  return reviewClass(props.data.reviewShapeSeverity)
}

function inheritedShapeReviewClass(shapeIri: string): string | null {
  return reviewClass(props.data.reviewAnnotationsByShape?.[shapeIri]?.shapeSeverity)
}

function propertyReviewClass(property: PropertyShape, shapeIri = props.data.representedShapeIri): string | null {
  const severity = props.data.reviewAnnotationsByShape?.[shapeIri]?.propertySeverities?.[property.nodeId.value]
    ?? props.data.reviewPropertySeverities?.[property.nodeId.value]
  return reviewClass(severity)
}

function isInheritedPropertyHighlighted(shapeIri: string): boolean {
  return isSelectedInheritedProfile(shapeIri)
}

function selectShape(): void {
  props.data.onSelectShape?.(props.data.shape)
}

function openShapeHeaderContextMenu(event: MouseEvent): void {
  props.data.onShapeHeaderContextMenu?.(props.data.shape, event, { allowDelete: true })
}

function focusInlineEditor(): void {
  void nextTick(() => {
    window.setTimeout(() => {
      const input = shapeNodeRef.value?.querySelector<HTMLInputElement>('[data-inline-name-editor="active"]')
      input?.focus()
      input?.select()
    }, 0)
  })
}

function startShapeNameEdit(shapeIri: string, value: string | undefined, event?: Event): void {
  if (!isInteractive() || !props.data.onRenameShape) return
  event?.stopPropagation()
  const shape = profiles.applicationProfile.findNodeShape(shapeIri)
  if (shape) props.data.onSelectShape?.(shape)
  editingPropertyKey.value = null
  editingShapeIri.value = shapeIri
  inlineNameDraft.value = value ?? ''
  inlineOriginalName.value = inlineNameDraft.value
  focusInlineEditor()
}

function onShapeNameInput(shapeIri: string, event: Event): void {
  const value = (event.target as HTMLInputElement).value
  inlineNameDraft.value = value
  props.data.onRenameShape?.(shapeIri, value)
}

function commitShapeNameEdit(shapeIri: string): void {
  if (editingShapeIri.value !== shapeIri) return
  props.data.onRenameShape?.(shapeIri, inlineNameDraft.value)
  editingShapeIri.value = null
}

function cancelShapeNameEdit(shapeIri: string): void {
  if (editingShapeIri.value === shapeIri) {
    props.data.onRenameShape?.(shapeIri, inlineOriginalName.value)
  }
  editingShapeIri.value = null
}

function startPropertyNameEdit(shapeIri: string, property: PropertyShape, event?: Event): void {
  if (!isInteractive() || !props.data.onRenameProperty) return
  event?.stopPropagation()
  const shape = profiles.applicationProfile.findNodeShape(shapeIri)
  const selectedProperty = shape?.properties.find(candidate =>
    candidate.nodeId.value === property.nodeId.value
    || candidate.path?.value === property.path?.value,
  )
  if (shape && selectedProperty) props.data.onSelectProperty?.(shape, selectedProperty)
  editingShapeIri.value = null
  editingPropertyKey.value = propertyEditKey(shapeIri, property)
  inlineNameDraft.value = property.name ?? ''
  inlineOriginalName.value = inlineNameDraft.value
  focusInlineEditor()
}

function onPropertyNameInput(shapeIri: string, property: PropertyShape, event: Event): void {
  const value = (event.target as HTMLInputElement).value
  inlineNameDraft.value = value
  props.data.onRenameProperty?.(shapeIri, property.nodeId.value, value)
}

function commitPropertyNameEdit(shapeIri: string, property: PropertyShape): void {
  const editKey = propertyEditKey(shapeIri, property)
  if (editingPropertyKey.value !== editKey) return
  props.data.onRenameProperty?.(shapeIri, property.nodeId.value, inlineNameDraft.value)
  if (isDraftProperty(property)) {
    if (inlineNameDraft.value.trim()) props.data.onCommitDraftProperty?.(property.nodeId.value)
    else props.data.onDeleteProperty?.(shapeIri, property.nodeId.value)
  }
  editingPropertyKey.value = null
}

function cancelPropertyNameEdit(shapeIri: string, property: PropertyShape): void {
  if (editingPropertyKey.value === propertyEditKey(shapeIri, property)) {
    props.data.onRenameProperty?.(shapeIri, property.nodeId.value, inlineOriginalName.value)
    if (isDraftProperty(property) && !inlineOriginalName.value.trim()) {
      props.data.onDeleteProperty?.(shapeIri, property.nodeId.value)
    }
  }
  editingPropertyKey.value = null
}

function selectProperty(property: PropertyShape): void {
  props.data.onSelectProperty?.(props.data.shape, property)
}

function addField(shapeIri: string): void {
  props.data.onAddField?.(shapeIri)
}

function selectInheritedShape(shapeIri: string): void {
  const inheritedShape = flattenInheritedGroupShapes(props.data.inheritedGroups ?? []).find(shape => shape.nodeId.value === shapeIri)
  if (inheritedShape) props.data.onSelectShape?.(inheritedShape)
}

function openInheritedShapeContextMenu(shapeIri: string, event: MouseEvent): void {
  const inheritedShape = flattenInheritedGroupShapes(props.data.inheritedGroups ?? []).find(shape => shape.nodeId.value === shapeIri)
  if (inheritedShape) props.data.onShapeHeaderContextMenu?.(inheritedShape, event, { allowDelete: false })
}

function isObjectRef(property: PropertyShape): boolean {
  return propertyNodeTargets(property).length > 0
}

function hasRelationshipHandle(_property: PropertyShape): boolean {
  return true
}

function isPropertyHandleOccupied(property: PropertyShape): boolean {
  return propertyGraphTargetIris(property, profiles.applicationProfile.allNodeShapes()).length > 0
}

function isShapeTargetHandleOccupied(): boolean {
  const allShapes = profiles.applicationProfile.allNodeShapes()
  return allShapes.some(shape =>
    shape.properties.some(property =>
      propertyGraphTargetIris(property, allShapes).includes(props.data.representedShapeIri),
    ),
  )
}

function constraintBadgeLabel(property: PropertyShape): string | null {
  return propertyConstraintSummary(property) ?? null
}

function isInteractive(): boolean {
  return props.data.interactive !== false
}

function inheritedPropertyPrefixCount(): number {
  if (props.data.inheritedPropertyCount !== undefined) return props.data.inheritedPropertyCount
  return props.data.shape.properties.filter(property => property.inherited).length
}

function flattenInheritedGroups(groups: NonNullable<ShapeEditorNodeData['inheritedGroups']>, depth = 0): Array<{ title: string; properties: PropertyShape[]; depth: number; shapeIri: string }> {
  const sections: Array<{ title: string; properties: PropertyShape[]; depth: number; shapeIri: string }> = []

  for (const group of groups) {
    sections.push(...flattenInheritedGroups(group.children, depth + 1))
    sections.push({
      title: group.label,
      properties: group.properties,
      depth,
      shapeIri: group.shape.nodeId.value,
    })
  }

  return sections
}

function flattenInheritedGroupShapes(groups: NonNullable<ShapeEditorNodeData['inheritedGroups']>): NodeShape[] {
  const shapes: NodeShape[] = []
  for (const group of groups) {
    shapes.push(group.shape, ...flattenInheritedGroupShapes(group.children))
  }
  return shapes
}

function hasTermIri(property: PropertyShape): boolean {
  return Boolean(property.path?.value?.trim())
}

function focusDraftPropertyInNode(): void {
  const draftPropertyNodeId = props.data.draftPropertyNodeId
  if (!draftPropertyNodeId) return
  if (editingPropertyKey.value?.endsWith(`::${draftPropertyNodeId}`)) return

  const property = ownProperties().find(candidate => candidate.nodeId.value === draftPropertyNodeId)
  if (!property) return

  startPropertyNameEdit(props.data.representedShapeIri, property)
}

watch(
  () => props.data.draftPropertyNodeId,
  () => focusDraftPropertyInNode(),
  { immediate: true, flush: 'post' },
)

function propertyDragPayload(property: PropertyShape): PropertyDragPayload {
  return {
    sourceShapeIri: props.data.representedShapeIri,
    propertyNodeId: property.nodeId.value,
    label: propertyLabel(property),
  }
}

function isSourceShape(payload: PropertyDragPayload): boolean {
  return payload.sourceShapeIri === props.data.representedShapeIri
}

function canMovePropertyToThisShape(payload: PropertyDragPayload): boolean {
  if (!props.data.onMoveProperty) return false
  if (isSourceShape(payload)) return true

  const sourceShape = profiles.applicationProfile.findNodeShape(payload.sourceShapeIri)
  const property = sourceShape?.properties.find(candidate => candidate.nodeId.value === payload.propertyNodeId)
  if (!property || property.inherited) return false

  return true
}

function parsePropertyDragPayload(event: DragEvent): PropertyDragPayload | null {
  if (activePropertyDrag.payload) return activePropertyDrag.payload

  const serialized = event.dataTransfer?.getData(PROPERTY_DRAG_MIME_TYPE)
  if (!serialized) return null

  try {
    const parsed = JSON.parse(serialized) as Partial<PropertyDragPayload>
    if (!parsed.sourceShapeIri || !parsed.propertyNodeId) return null
    return {
      sourceShapeIri: parsed.sourceShapeIri,
      propertyNodeId: parsed.propertyNodeId,
      label: parsed.label ?? 'Moving field',
    }
  } catch {
    return null
  }
}

function updateDragPosition(event: DragEvent): void {
  if (event.clientX === 0 && event.clientY === 0) return
  activePropertyDrag.x = event.clientX
  activePropertyDrag.y = event.clientY
}

function resetDropPreview(): void {
  dragOverAllowed.value = false
  dragOverBlocked.value = false
  dropPreviewIndex.value = null
}

function resetPropertyDragState(): void {
  activePropertyDrag.payload = null
  activePropertyDrag.x = 0
  activePropertyDrag.y = 0
  activePropertyDrag.hasLeftSource = false
  resetDropPreview()
}

function insertionIndexForPointer(event: DragEvent): number {
  const rows = Array.from(ownPropertiesListRef.value?.querySelectorAll<HTMLElement>('.row') ?? [])
  if (rows.length === 0) return 0

  const index = rows.findIndex(row => {
    const rect = row.getBoundingClientRect()
    return event.clientY < rect.top + (rect.height / 2)
  })
  return index >= 0 ? index : rows.length
}

function sourcePropertyIndex(payload: PropertyDragPayload): number {
  return ownProperties().findIndex(property => property.nodeId.value === payload.propertyNodeId)
}

function isNoopSourceReorder(payload: PropertyDragPayload, targetIndex: number): boolean {
  const sourceIndex = sourcePropertyIndex(payload)
  return sourceIndex >= 0 && (targetIndex === sourceIndex || targetIndex === sourceIndex + 1)
}

function isSourcePropertyHidden(property: PropertyShape): boolean {
  const payload = activePropertyDrag.payload
  return Boolean(
    payload
    && activePropertyDrag.hasLeftSource
    && payload.sourceShapeIri === props.data.representedShapeIri
    && payload.propertyNodeId === property.nodeId.value,
  )
}

function isDragPreviewOwner(): boolean {
  return activePropertyDrag.payload?.sourceShapeIri === props.data.representedShapeIri
}

function dragPreviewStyle(): Record<string, string> {
  return {
    left: `${activePropertyDrag.x + 14}px`,
    top: `${activePropertyDrag.y + 14}px`,
  }
}

function onPropertyDragStart(property: PropertyShape, event: DragEvent): void {
  if (!isInteractive() || property.inherited || !event.dataTransfer) return

  updateDragPosition(event)
  event.dataTransfer.effectAllowed = 'move'
  activePropertyDrag.payload = propertyDragPayload(property)
  activePropertyDrag.hasLeftSource = false
  event.dataTransfer.setData(PROPERTY_DRAG_MIME_TYPE, JSON.stringify(activePropertyDrag.payload))
  const dragImage = document.createElement('canvas')
  dragImage.width = 1
  dragImage.height = 1
  event.dataTransfer.setDragImage(dragImage, 0, 0)
}

function onPropertyDrag(event: DragEvent): void {
  updateDragPosition(event)
}

function onPropertyDragEnd(): void {
  resetPropertyDragState()
}

function onShapeDragOver(event: DragEvent): void {
  const payload = parsePropertyDragPayload(event)
  if (!payload) return

  event.preventDefault()
  updateDragPosition(event)

  if (isSourceShape(payload)) {
    activePropertyDrag.hasLeftSource = false
    const targetIndex = insertionIndexForPointer(event)
    dragOverAllowed.value = !isNoopSourceReorder(payload, targetIndex)
    dragOverBlocked.value = false
    dropPreviewIndex.value = targetIndex
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    return
  }

  const allowed = canMovePropertyToThisShape(payload)
  dragOverAllowed.value = allowed
  dragOverBlocked.value = !allowed
  dropPreviewIndex.value = allowed ? insertionIndexForPointer(event) : null
  if (event.dataTransfer) event.dataTransfer.dropEffect = allowed ? 'move' : 'none'
}

function onShapeDragLeave(event: DragEvent): void {
  const current = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (current && related && current.contains(related)) return

  const payload = activePropertyDrag.payload
  if (payload && isSourceShape(payload)) {
    activePropertyDrag.hasLeftSource = true
  }
  resetDropPreview()
}

function onShapeDrop(event: DragEvent): void {
  const payload = parsePropertyDragPayload(event)
  if (!payload) return

  event.preventDefault()
  updateDragPosition(event)

  if (isSourceShape(payload)) {
    const targetIndex = dropPreviewIndex.value ?? insertionIndexForPointer(event)
    if (!isNoopSourceReorder(payload, targetIndex)) {
      props.data.onMoveProperty?.(payload.sourceShapeIri, payload.propertyNodeId, props.data.representedShapeIri, targetIndex)
    }
    resetPropertyDragState()
    return
  }

  const targetIndex = dropPreviewIndex.value ?? insertionIndexForPointer(event)
  resetDropPreview()
  if (!canMovePropertyToThisShape(payload)) return

  props.data.onMoveProperty?.(payload.sourceShapeIri, payload.propertyNodeId, props.data.representedShapeIri, targetIndex)
  resetPropertyDragState()
}
</script>

<template>
  <div
    ref="shapeNodeRef"
    class="shape-node"
    :class="{ 'is-selected': isSelectedProfile(), 'is-drop-target': dragOverAllowed, 'is-drop-blocked': dragOverBlocked }"
    :style="{
      '--shape-header-bg': EDITOR_NODE_COLORS.shape.headerBackground,
      '--shape-header-color': EDITOR_NODE_COLORS.shape.headerColor,
      '--shape-preview-border': EDITOR_NODE_COLORS.shape.previewBorderColor,
      '--shape-ref-bg': EDITOR_NODE_COLORS.shape.accentBackground,
      '--shape-ref-hover-bg': EDITOR_NODE_COLORS.shape.accentHoverBackground,
      '--shape-badge-bg': EDITOR_NODE_COLORS.shape.badgeBackground,
      '--shape-badge-border': EDITOR_NODE_COLORS.shape.badgeBorderColor,
      '--shape-badge-color': EDITOR_NODE_COLORS.shape.badgeColor,
      '--shape-handle-color': EDITOR_NODE_COLORS.shape.handleColor,
      '--shape-wire-color': EDITOR_NODE_COLORS.shape.wireColor,
      '--shape-inherited-bg': EDITOR_NODE_COLORS.shape.inheritedBackground,
    }"
    @click="selectShape"
    @dragover="onShapeDragOver"
    @dragleave="onShapeDragLeave"
    @drop="onShapeDrop"
  >
    <header
      :class="shapeReviewClass()"
      @dblclick.stop="startShapeNameEdit(data.representedShapeIri, data.shape.label, $event)"
      @contextmenu.stop.prevent="openShapeHeaderContextMenu"
    >
      <Handle
        id="shape-header"
        type="target"
        :position="Position.Left"
        :connectable="isInteractive()"
        class="handle handle-shape-target"
        :class="{ 'handle-active': isShapeTargetHandleOccupied(), 'handle-readonly': !isInteractive() }"
      />
      <i class="pi pi-bookmark" />
      <input
        v-if="editingShapeIri === data.representedShapeIri"
        data-inline-name-editor="active"
        v-model="inlineNameDraft"
        class="inline-name-editor inline-name-editor--header"
        aria-label="Profile name"
        @click.stop
        @dblclick.stop
        @input="onShapeNameInput(data.representedShapeIri, $event)"
        @blur="commitShapeNameEdit(data.representedShapeIri)"
        @keydown.enter.prevent="commitShapeNameEdit(data.representedShapeIri)"
        @keydown.esc.prevent="cancelShapeNameEdit(data.representedShapeIri)"
      />
      <span v-else class="label">{{ label() }}</span>
      <button
        v-if="data.onPreview"
        class="preview-btn"
        type="button"
        title="Preview shape"
        aria-label="Preview shape"
        @click.stop="data.onPreview?.()"
      >
        <i class="pi pi-eye" />
      </button>
    </header>

    <template v-for="section in inheritedSections()" :key="`${section.depth}:${section.title}`">
      <div
        class="section-label inherited-section-label inherited-section-button"
        :class="[
          inheritedShapeReviewClass(section.shapeIri),
          { 'is-selected': isSelectedInheritedProfile(section.shapeIri) },
        ]"
        :style="{ paddingLeft: `${12 + (section.depth * 18)}px` }"
        @click.stop="selectInheritedShape(section.shapeIri)"
        @dblclick.stop="startShapeNameEdit(section.shapeIri, section.title, $event)"
        @contextmenu.stop.prevent="openInheritedShapeContextMenu(section.shapeIri, $event)"
      >
        <span class="inherited-section-label__content">
          <i class="pi pi-sitemap section-icon" />
          <input
            v-if="editingShapeIri === section.shapeIri"
            data-inline-name-editor="active"
            v-model="inlineNameDraft"
            class="inline-name-editor inline-name-editor--section"
            aria-label="Inherited profile name"
            @click.stop
            @dblclick.stop
            @input="onShapeNameInput(section.shapeIri, $event)"
            @blur="commitShapeNameEdit(section.shapeIri)"
            @keydown.enter.prevent="commitShapeNameEdit(section.shapeIri)"
            @keydown.esc.prevent="cancelShapeNameEdit(section.shapeIri)"
          />
          <span v-else>{{ section.title }}</span>
          <span class="inherited-suffix">(Inherited)</span>
        </span>
      </div>

      <ul class="properties">
        <li
          v-for="property in section.properties"
          :key="`inh:${section.title}:${property.path?.value ?? property.nodeId.value}`"
          class="row inherited-row nodrag"
          :class="[
            propertyReviewClass(property, section.shapeIri),
            { 'is-ref': isObjectRef(property), 'is-selected': isSelectedProperty(property) || isInheritedPropertyHighlighted(section.shapeIri) },
          ]"
          @click.stop="selectProperty(property)"
          @dblclick.stop="startPropertyNameEdit(section.shapeIri, property, $event)"
        >
          <template v-if="isObjectRef(property)">
            <i class="pi pi-book field-icon" :class="{ 'field-icon--muted': !hasTermIri(property) }" />
            <input
              v-if="editingPropertyKey === propertyEditKey(section.shapeIri, property)"
              data-inline-name-editor="active"
              v-model="inlineNameDraft"
              class="inline-name-editor prop-name"
              aria-label="Property name"
              @click.stop
              @dblclick.stop
              @input="onPropertyNameInput(section.shapeIri, property, $event)"
              @blur="commitPropertyNameEdit(section.shapeIri, property)"
              @keydown.enter.prevent="commitPropertyNameEdit(section.shapeIri, property)"
              @keydown.esc.prevent="cancelPropertyNameEdit(section.shapeIri, property)"
            />
            <span v-else class="prop-name">{{ propertyLabel(property) }}</span>
          </template>

          <template v-else>
            <i class="pi pi-book field-icon" :class="{ 'field-icon--muted': !hasTermIri(property) }" />
            <input
              v-if="editingPropertyKey === propertyEditKey(section.shapeIri, property)"
              data-inline-name-editor="active"
              v-model="inlineNameDraft"
              class="inline-name-editor prop-name"
              aria-label="Property name"
              @click.stop
              @dblclick.stop
              @input="onPropertyNameInput(section.shapeIri, property, $event)"
              @blur="commitPropertyNameEdit(section.shapeIri, property)"
              @keydown.enter.prevent="commitPropertyNameEdit(section.shapeIri, property)"
              @keydown.esc.prevent="cancelPropertyNameEdit(section.shapeIri, property)"
            />
            <span v-else class="prop-name">{{ propertyLabel(property) }}</span>
          </template>

          <Handle
            v-if="hasRelationshipHandle(property)"
            :id="`ref:${property.nodeId.value}`"
            type="source"
            :position="Position.Right"
            :connectable="isInteractive()"
            class="handle handle-ref-source"
            :class="{ 'handle-active': isPropertyHandleOccupied(property), 'handle-readonly': !isInteractive() }"
          />
        </li>
      </ul>

      <button
        v-if="data.onAddField && isSelectedInheritedProfile(section.shapeIri)"
        type="button"
        class="add-field-row add-field-row--inherited nodrag"
        :style="{ paddingLeft: `${12 + (section.depth * 18)}px` }"
        @click.stop="addField(section.shapeIri)"
      >
        <i class="pi pi-plus add-field-row__icon" />
        <span class="prop-name">Add Field</span>
      </button>
    </template>

    <div v-if="inheritedProperties().length > 0 && ownProperties().length > 0" class="section-label">
      Own Properties
    </div>

    <ul v-if="ownProperties().length > 0 || dropPreviewIndex !== null" ref="ownPropertiesListRef" class="properties properties--own">
      <template v-for="(property, index) in visibleOwnProperties" :key="`own:${property.path?.value ?? property.nodeId.value}`">
        <li v-if="dropPreviewIndex === index" :key="`drop:${index}`" class="property-drop-line" />
        <li
          class="row nodrag"
          :class="[
            propertyReviewClass(property),
            { 'is-ref': isObjectRef(property), 'is-selected': isSelectedProperty(property) },
          ]"
          @click.stop="selectProperty(property)"
          @dblclick.stop="startPropertyNameEdit(data.representedShapeIri, property, $event)"
        >
          <template v-if="isObjectRef(property)">
            <i
              v-if="isInteractive()"
              class="pi pi-bars property-drag-grip"
              draggable="true"
              title="Move field"
              @click.stop
              @dragstart.stop="onPropertyDragStart(property, $event)"
              @drag.stop="onPropertyDrag"
              @dragend="onPropertyDragEnd"
            />
            <i class="pi pi-book field-icon" :class="{ 'field-icon--muted': !hasTermIri(property) }" />
            <input
              v-if="editingPropertyKey === propertyEditKey(data.representedShapeIri, property)"
              data-inline-name-editor="active"
              v-model="inlineNameDraft"
              class="inline-name-editor prop-name"
              aria-label="Property name"
              @click.stop
              @dblclick.stop
              @input="onPropertyNameInput(data.representedShapeIri, property, $event)"
              @blur="commitPropertyNameEdit(data.representedShapeIri, property)"
              @keydown.enter.prevent="commitPropertyNameEdit(data.representedShapeIri, property)"
              @keydown.esc.prevent="cancelPropertyNameEdit(data.representedShapeIri, property)"
            />
            <span v-else class="prop-name">{{ propertyLabel(property) }}</span>
          </template>

          <template v-else>
            <i
              v-if="isInteractive()"
              class="pi pi-bars property-drag-grip"
              draggable="true"
              title="Move field"
              @click.stop
              @dragstart.stop="onPropertyDragStart(property, $event)"
              @drag.stop="onPropertyDrag"
              @dragend="onPropertyDragEnd"
            />
            <i class="pi pi-book field-icon" :class="{ 'field-icon--muted': !hasTermIri(property) }" />
            <input
              v-if="editingPropertyKey === propertyEditKey(data.representedShapeIri, property)"
              data-inline-name-editor="active"
              v-model="inlineNameDraft"
              class="inline-name-editor prop-name"
              aria-label="Property name"
              @click.stop
              @dblclick.stop
              @input="onPropertyNameInput(data.representedShapeIri, property, $event)"
              @blur="commitPropertyNameEdit(data.representedShapeIri, property)"
              @keydown.enter.prevent="commitPropertyNameEdit(data.representedShapeIri, property)"
              @keydown.esc.prevent="cancelPropertyNameEdit(data.representedShapeIri, property)"
            />
            <span v-else class="prop-name">{{ propertyLabel(property) }}</span>
            <span v-if="constraintBadgeLabel(property)" class="type-badge">{{ constraintBadgeLabel(property) }}</span>
          </template>

          <Handle
            v-if="hasRelationshipHandle(property)"
            :id="`ref:${property.nodeId.value}`"
            type="source"
            :position="Position.Right"
            :connectable="isInteractive()"
            class="handle handle-ref-source"
            :class="{ 'handle-active': isPropertyHandleOccupied(property), 'handle-readonly': !isInteractive() }"
          />
        </li>
      </template>
      <li v-if="dropPreviewIndex === visibleOwnProperties.length" class="property-drop-line" />
    </ul>

    <button
      v-if="data.onAddField"
      type="button"
      class="add-field-row nodrag"
      @click.stop="addField(data.representedShapeIri)"
    >
      <i class="pi pi-plus add-field-row__icon" />
      <span class="prop-name">Add Field</span>
    </button>

    <Teleport to="body">
      <div
        v-if="isDragPreviewOwner() && activePropertyDrag.payload"
        class="property-drag-preview"
        :style="dragPreviewStyle()"
      >
        <i class="pi pi-bars" />
        <span>{{ activePropertyDrag.payload.label }}</span>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.shape-node {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 300px;
  max-width: 380px;
  font-size: 0.85rem;
  box-shadow: var(--shadow-sm);
  overflow: visible;
}

.shape-node.is-selected {
  border-color: var(--color-primary);
  box-shadow: inset 3px 0 0 var(--color-primary), 0 0 0 1px rgba(90, 62, 155, 0.28), var(--shadow-md);
}

.shape-node.is-drop-target {
  border-color: var(--color-primary);
  box-shadow: inset 0 0 0 2px var(--color-primary), var(--shadow-md);
}

.shape-node.is-drop-blocked {
  border-color: #dc2626;
  box-shadow: inset 0 0 0 2px rgba(220, 38, 38, 0.72), var(--shadow-md);
}

.shape-node.is-selected header {
  background: var(--color-primary-soft);
  color: var(--color-text);
}

header.is-review-urgent {
  background: #fee2e2;
  color: #7f1d1d;
  box-shadow: inset 0 -1px 0 rgba(220, 38, 38, 0.24);
}

header.is-review-warning {
  background: #fef3c7;
  color: #78350f;
  box-shadow: inset 0 -1px 0 rgba(245, 158, 11, 0.26);
}

header {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--shape-header-bg);
  border-bottom: 1px solid var(--color-border);
  border-top-left-radius: calc(var(--radius-md) - 1px);
  border-top-right-radius: calc(var(--radius-md) - 1px);
  background-clip: padding-box;
  font-weight: 600;
  color: var(--shape-header-color);
}

.label { flex: 1; word-break: break-all; }

.inline-name-editor {
  min-width: 0;
  flex: 1;
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--color-primary);
  border-radius: 0;
  outline: 0;
  background: rgba(255, 255, 255, 0.82);
  color: inherit;
  font: inherit;
  line-height: 1.25;
  padding: 1px 2px 2px;
}

.inline-name-editor:focus {
  box-shadow: inset 0 -1px 0 var(--color-primary);
}

.inline-name-editor--header {
  font-weight: 600;
}

.inline-name-editor--section {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: none;
}

.preview-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--shape-preview-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: white;
    border-color: color-mix(in srgb, var(--shape-header-color) 35%, white);
  }
}

.properties {
  list-style: none;
  padding: 0;
  margin: 0;
  background: rgba(251, 251, 251, 0.9);
}

.properties--own {
  position: relative;
}

.property-drop-line {
  height: 0;
  margin: 0 12px;
  border-top: 2px solid var(--color-primary);
  list-style: none;
  position: relative;
  z-index: 3;
}

.property-drop-line::before {
  content: '';
  position: absolute;
  left: -4px;
  top: -5px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--color-primary);
}

.section-label {
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border);
  background: rgba(239, 239, 239, 0.9);
  color: var(--color-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
}

.inherited-section-label {
  background: rgba(249, 250, 251, 0.9);
  border-top: 1px solid var(--color-border);
}

.inherited-section-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.inherited-section-label__content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.inherited-suffix {
  flex-shrink: 0;
}

.add-field-row--inherited {
  width: 100%;
  border-top: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.inherited-section-button:hover {
  background: rgba(243, 244, 246, 0.9);
}

.inherited-section-button.is-selected {
  background: rgba(90, 62, 155, 0.1);
  box-shadow: inset 3px 0 0 var(--color-primary);
  color: var(--color-text);
}

.inherited-section-button.is-review-urgent {
  background: rgba(254, 226, 226, 0.9);
  color: #7f1d1d;
  box-shadow: inset 4px 0 0 #dc2626;
}

.inherited-section-button.is-review-warning {
  background: rgba(254, 243, 199, 0.9);
  color: #78350f;
  box-shadow: inset 4px 0 0 #f59e0b;
}

.inherited-section-button.is-selected.is-review-urgent,
.inherited-section-button.is-selected.is-review-warning {
  box-shadow: inset 4px 0 0 var(--color-primary);
}

.section-icon {
  font-size: 0.72rem;
  color: #9ca3af;
  flex-shrink: 0;
}

.row {
  position: relative;
  padding: 5px 28px 5px 12px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: default;

  &:last-child { border-bottom: none; }

  &.is-ref {
    background: color-mix(in srgb, var(--shape-ref-bg) 90%, transparent);

    &:hover { background: color-mix(in srgb, var(--shape-ref-hover-bg) 90%, transparent); }
  }

  &.is-selected {
    background: rgba(90, 62, 155, 0.1);
    box-shadow: inset 3px 0 0 var(--color-primary);
  }
}

.row.is-review-urgent {
  box-shadow: inset 4px 0 0 #dc2626;
}

.row.is-review-warning {
  box-shadow: inset 4px 0 0 #f59e0b;
}

.prop-name {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}

.property-drag-grip {
  flex-shrink: 0;
  font-size: 0.78rem;
  color: #9ca3af;
  cursor: grab;
}

.property-drag-grip:active {
  cursor: grabbing;
}

.property-drag-preview {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 320px;
  padding: 8px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.96);
  color: var(--color-text);
  box-shadow: var(--shadow-md);
  font: 0.85rem/1.3 var(--font-sans);
  overflow-wrap: anywhere;
}

.property-drag-preview .pi {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.field-icon {
  flex-shrink: 0;
  font-size: 0.8rem;
  color: var(--color-text);
}

.field-icon--muted {
  color: #c7c9cf;
}

.type-badge {
  flex-shrink: 0;
  border: 1px solid var(--shape-badge-border);
  background: var(--shape-badge-bg);
  color: var(--shape-badge-color);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.7rem;
}

.handle {
  width: 10px;
  height: 10px;
  border-width: 2px;
  border-color: rgba(107, 114, 128, 0.28);
  background: rgba(255, 255, 255, 0.72);
}

.handle-ref-source {
  border-color: color-mix(in srgb, var(--shape-handle-color) 28%, white);
}

.handle-ref-target {
  border-color: color-mix(in srgb, var(--shape-wire-color) 28%, white);
  background: rgba(255, 255, 255, 0.72);
}

.handle-shape-target {
  border-color: color-mix(in srgb, var(--shape-wire-color) 28%, white);
  background: rgba(255, 255, 255, 0.72);
}

.handle-active {
  border-color: var(--shape-wire-color);
  background: var(--shape-wire-color);
  right: 0;
}

.handle-indicator {
  position: absolute;
  top: 50%;
  right: -5px;
  width: 10px;
  height: 10px;
  margin-top: -5px;
  border-radius: 999px;
  border: 2px solid var(--color-border-strong);
  background: var(--color-surface-1);
  z-index: 2;
}

.handle-disabled {
  opacity: 0.9;
}

.handle-readonly {
  cursor: default;
  opacity: 0.75;
}

.add-field-row {
  width: 100%;
  position: relative;
  padding: 8px 12px;
  border: 0;
  border-top: 1px solid var(--color-border);
  border-bottom-left-radius: calc(var(--radius-md) - 1px);
  border-bottom-right-radius: calc(var(--radius-md) - 1px);
  background: var(--color-primary-soft);
  background-clip: padding-box;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: background-color 0.15s ease;
}

.add-field-row:hover {
  background: rgba(90, 62, 155, 0.18);
}

.add-field-row__icon {
  font-size: 0.8rem;
}
</style>
