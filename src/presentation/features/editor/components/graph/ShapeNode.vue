<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { propertyConstraintSummary, propertyNodeTargets, type NodeShape, type PropertyShape } from '@/domain/profiles'
import { EDITOR_NODE_COLORS } from '@/presentation/features/editor/editorGraphTheme'
import type { ShapeEditorNodeData } from '@/presentation/features/editor/inheritanceEditorGraph'
import { useProfileEditorStore } from '@/application/profiles/profileEditorStore'

const props = defineProps<{ data: ShapeEditorNodeData }>()
const profiles = useProfileEditorStore()

const label = () => props.data.shape.label?.trim() || 'Unnamed profile'
const inheritedProperties = () => props.data.shape.properties.slice(0, inheritedPropertyPrefixCount())
const ownProperties = () => props.data.ownProperties ?? props.data.shape.properties.slice(inheritedPropertyPrefixCount())
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

function selectProperty(property: PropertyShape): void {
  props.data.onSelectProperty?.(props.data.shape, property)
}

function addField(): void {
  props.data.onAddField?.()
}

function selectInheritedShape(shapeIri: string): void {
  const inheritedShape = flattenInheritedGroupShapes(props.data.inheritedGroups ?? []).find(shape => shape.nodeId.value === shapeIri)
  if (inheritedShape) props.data.onSelectShape?.(inheritedShape)
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
</script>

<template>
  <div
    class="shape-node"
    :class="{ 'is-selected': isSelectedProfile() }"
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
  >
    <header>
      <Handle
        v-if="isInteractive()"
        id="shape-header"
        type="target"
        :position="Position.Left"
        class="handle handle-shape-target"
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
      >
        <i class="pi pi-sitemap section-icon" />
        <span>{{ section.title }} (Inherited)</span>
      </div>

      <ul class="properties">
        <li
          v-for="property in section.properties"
          :key="`inh:${section.title}:${property.path?.value ?? property.nodeId.value}`"
          class="row inherited-row"
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
            v-if="isInteractive() && hasRelationshipHandle(property)"
            :id="`ref:${property.nodeId.value}`"
            type="source"
            :position="Position.Right"
            class="handle handle-ref-source handle-active"
          />
          <span v-else class="handle-indicator handle-disabled" aria-hidden="true" />
        </li>
      </ul>
    </template>

    <div v-if="inheritedProperties().length > 0 && ownProperties().length > 0" class="section-label">
      Own Properties
    </div>

    <ul v-if="ownProperties().length > 0" class="properties">
      <li
        v-for="property in ownProperties()"
        :key="`own:${property.path?.value ?? property.nodeId.value}`"
        class="row"
        :class="{ 'is-ref': isObjectRef(property), 'is-selected': isSelectedProperty(property) }"
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
          <span v-if="constraintBadgeLabel(property)" class="type-badge">{{ constraintBadgeLabel(property) }}</span>
        </template>

        <Handle
          v-if="isInteractive() && hasRelationshipHandle(property)"
          :id="`ref:${property.nodeId.value}`"
          type="source"
          :position="Position.Right"
          class="handle handle-ref-source handle-active"
        />
        <span v-else class="handle-indicator handle-disabled" aria-hidden="true" />
      </li>
    </ul>

    <button
      v-if="data.onAddField"
      type="button"
      class="add-field-row"
      @click.stop="addField"
    >
      <i class="pi pi-plus add-field-row__icon" />
      <span class="prop-name">Add Field</span>
    </button>
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
  cursor: pointer;
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
