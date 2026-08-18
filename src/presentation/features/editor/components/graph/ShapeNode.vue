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
import type { ShapeEditorNodeData } from '@/presentation/features/editor/inheritanceEditorGraph'
import { useProfileEditorStore } from '@/application/profiles/profileEditorStore'
import { computed, ref } from 'vue'

const props = defineProps<{ data: ShapeEditorNodeData }>()
const profiles = useProfileEditorStore()
const dragOverAllowed = ref(false)
const dragOverBlocked = ref(false)
const dropPreviewIndex = ref<number | null>(null)
const ownPropertiesListRef = ref<HTMLElement | null>(null)

const label = () => props.data.shape.label?.trim() || 'Unnamed profile'
const inheritedProperties = () => props.data.shape.properties.slice(0, inheritedPropertyPrefixCount())
const ownProperties = () => props.data.ownProperties ?? props.data.shape.properties.slice(inheritedPropertyPrefixCount())
const visibleOwnProperties = computed(() =>
  ownProperties().filter(property => !isSourcePropertyHidden(property)),
)
const inheritedSections = () => flattenInheritedGroups(props.data.inheritedGroups ?? [])

function localName(iri: string): string {
  return iri.split(/[/#]/).filter(Boolean).pop() ?? iri
}

function propertyLabel(property: PropertyShape): string {
  return property.name?.trim() || 'Unnamed field'
}

function propertyKey(property: PropertyShape): string {
  return property.nodeId.value
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

function isInheritedPropertyHighlighted(shapeIri: string): boolean {
  return isSelectedInheritedProfile(shapeIri)
}

function selectShape(): void {
  props.data.onSelectShape?.(props.data.shape)
}

function openShapeHeaderContextMenu(event: MouseEvent): void {
  props.data.onShapeHeaderContextMenu?.(props.data.shape, event, { allowDelete: true })
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

function refShapeLabel(property: PropertyShape): string {
  return propertyNodeTargets(property)
    .map(node => {
      const linked = profiles.applicationProfile.findNodeShape(node.value)
      return linked?.label ?? localName(node.value)
    })
    .join(' | ')
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

function isShapeMissingRequiredFields(): boolean {
  return !props.data.shape.label?.trim()
    || !props.data.shape.creator?.trim()
    || !props.data.shape.created?.trim()
    || !props.data.shape.license?.trim()
}

function hasTermIri(property: PropertyShape): boolean {
  return Boolean(property.path?.value?.trim())
}

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

  return !propertyNodeTargets(property).some(target => target.value === props.data.representedShapeIri)
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
    <header @contextmenu.stop.prevent="openShapeHeaderContextMenu">
      <Handle
        id="shape-header"
        type="target"
        :position="Position.Left"
        :connectable="isInteractive()"
        class="handle handle-shape-target"
        :class="{ 'handle-readonly': !isInteractive() }"
      />
      <i class="pi pi-bookmark" />
      <span class="label">{{ label() }}</span>
      <i v-if="isShapeMissingRequiredFields()" class="pi pi-exclamation-triangle warning-icon" title="Required profile fields are missing" />
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
        :class="{ 'is-selected': isSelectedInheritedProfile(section.shapeIri) }"
        :style="{ paddingLeft: `${12 + (section.depth * 18)}px` }"
        @click.stop="selectInheritedShape(section.shapeIri)"
        @contextmenu.stop.prevent="openInheritedShapeContextMenu(section.shapeIri, $event)"
      >
        <span class="inherited-section-label__content">
          <i class="pi pi-sitemap section-icon" />
          <span>{{ section.title }} (Inherited)</span>
        </span>
      </div>

      <ul class="properties">
        <li
          v-for="property in section.properties"
          :key="`inh:${section.title}:${property.path?.value ?? property.nodeId.value}`"
          class="row inherited-row nodrag"
          :class="{ 'is-ref': isObjectRef(property), 'is-selected': isSelectedProperty(property) || isInheritedPropertyHighlighted(section.shapeIri) }"
          @click.stop="selectProperty(property)"
        >
          <template v-if="isObjectRef(property)">
            <i class="pi pi-book field-icon" :class="{ 'field-icon--muted': !hasTermIri(property) }" />
            <span class="prop-name">{{ propertyLabel(property) }}</span>
            <i class="pi pi-link fk-icon" :title="refShapeLabel(property)" />
          </template>

          <template v-else>
            <i class="pi pi-book field-icon" :class="{ 'field-icon--muted': !hasTermIri(property) }" />
            <span class="prop-name">{{ propertyLabel(property) }}</span>
          </template>

          <Handle
            v-if="hasRelationshipHandle(property)"
            :id="`ref:${property.nodeId.value}`"
            type="source"
            :position="Position.Right"
            :connectable="isInteractive()"
            class="handle handle-ref-source handle-active"
            :class="{ 'handle-readonly': !isInteractive() }"
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
          :class="{ 'is-ref': isObjectRef(property), 'is-selected': isSelectedProperty(property) }"
          @click.stop="selectProperty(property)"
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
            <span class="prop-name">{{ propertyLabel(property) }}</span>
            <i class="pi pi-link fk-icon" :title="refShapeLabel(property)" />
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
            <span class="prop-name">{{ propertyLabel(property) }}</span>
            <span v-if="constraintBadgeLabel(property)" class="type-badge">{{ constraintBadgeLabel(property) }}</span>
          </template>

          <Handle
            v-if="hasRelationshipHandle(property)"
            :id="`ref:${property.nodeId.value}`"
            type="source"
            :position="Position.Right"
            :connectable="isInteractive()"
            class="handle handle-ref-source handle-active"
            :class="{ 'handle-readonly': !isInteractive() }"
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
  background: var(--color-surface-1);
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

.warning-icon {
  color: var(--color-warning);
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

.properties { list-style: none; padding: 0; margin: 0; }

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
  background: var(--color-surface-2);
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
  background: #f9fafb;
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
}

.add-field-row--inherited {
  width: 100%;
  border-top: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.inherited-section-button:hover {
  background: #f3f4f6;
}

.inherited-section-button.is-selected {
  background: var(--color-primary-soft);
  box-shadow: inset 3px 0 0 var(--color-primary);
  color: var(--color-text);
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
    background: var(--shape-ref-bg);

    &:hover { background: var(--shape-ref-hover-bg); }
  }

  &.is-selected {
    background: var(--color-primary-soft);
    box-shadow: inset 3px 0 0 var(--color-primary);
  }
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

.fk-icon {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.handle {
  width: 10px;
  height: 10px;
  border-width: 2px;
  background: white;
}

.handle-ref-source {
  border-color: var(--shape-handle-color);
}

.handle-ref-target {
  border-color: var(--shape-wire-color);
  background: var(--shape-wire-color);
}

.handle-shape-target {
  border-color: var(--shape-wire-color);
  background: var(--shape-wire-color);
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
