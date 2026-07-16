<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import {
  fetchSubjectHeadingOptions,
  PROFILE_LICENSE_OPTIONS,
  PROPERTY_TERM_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  SHACL_DATATYPE_OPTIONS,
  SHACL_NODE_KIND_OPTIONS,
  type SelectOption,
} from '@/application/profiles/profileEditorCatalogs'
import {
  propertyConstraintSummary,
  propertyDatatypeTargets,
  propertyNodeTargets,
  propertyRelationshipKinds,
  type NodeShape,
  type PropertyShape,
  type ShaclProfile,
} from '@/domain/profiles'
import type { PropertyEditorType } from '@/application/profiles/profileEditorStore'
import InspectorEditableField from '@/presentation/features/editor/components/inspector/InspectorEditableField.vue'
import InspectorReadOnlyField from '@/presentation/features/editor/components/inspector/InspectorReadOnlyField.vue'
import InspectorConstraintRangeField from '@/presentation/features/editor/components/inspector/InspectorConstraintRangeField.vue'

type InspectorTab = 'basic' | 'advanced'
type EditableShapeField =
  | 'label'
  | 'description'
  | 'creator'
  | 'created'
  | 'license'
  | 'subject'
  | 'closed'
  | 'targetClass'

type EditablePropertyField =
  | 'name'
  | 'description'
  | 'path'
  | 'datatype'
  | 'nodeKind'
  | 'cls'
  | 'minCount'
  | 'maxCount'
  | 'pattern'
  | 'order'
  | 'defaultValue'
  | 'allowedValues'
  | 'message'
  | 'severity'
  | 'equals'
  | 'disjoint'
  | 'lessThan'
  | 'lessThanOrEquals'
  | 'minInclusive'
  | 'minExclusive'
  | 'maxInclusive'
  | 'maxExclusive'

const props = defineProps<{
  shape: NodeShape | null
  property: PropertyShape | null
  profile: ShaclProfile | null
  allShapes: NodeShape[]
  updateShapeField: (shapeIri: string, field: EditableShapeField, value: string | null) => void
  updatePropertyField: (shapeIri: string, propertyNodeId: string, field: EditablePropertyField, value: string | null) => void
  setShapeInheritance: (shapeIri: string, inheritedShapeIri: string | null) => void
  setPropertyNodeTarget: (shapeIri: string, propertyNodeId: string, targetShapeIri: string | null) => void
  setPropertyType: (shapeIri: string, propertyNodeId: string, type: PropertyEditorType) => void
  deleteShape: (shapeIri: string) => { ok: boolean; reason?: string }
  deleteProperty: (shapeIri: string, propertyNodeId: string) => boolean
}>()

const confirm = useConfirm()
const activeTab = ref<InspectorTab>('basic')
const subjectHeadingOptions = ref<SelectOption[]>([])
const CUSTOM_IRI_OPTION_VALUE = '__custom__'

const isPropertyInspector = computed(() => props.shape !== null && props.property !== null)
const inspectorTitle = computed(() => {
  if (props.property) return props.property.name?.trim() || 'Unnamed field'
  if (props.shape) return props.shape.label?.trim() || 'Unnamed profile'
  return 'Inspector'
})
const profileIdentifier = computed(() => props.profile?.iri ?? props.shape?.sourceProfileIri ?? props.shape?.nodeId.value ?? null)
const propertyDatatype = computed(() => props.property ? propertyDatatypeTargets(props.property)[0]?.value ?? null : null)
const propertyNodeTarget = computed(() => props.property ? propertyNodeTargets(props.property)[0]?.value ?? null : null)
const propertyRelations = computed(() => props.property ? propertyRelationshipKinds(props.property) : [])
const propertyConstraintText = computed(() => props.property ? propertyConstraintSummary(props.property) ?? null : null)
const propertyAllowedValuesText = computed(() => props.property?.allowedValues?.join('\n') ?? null)
const propertyTypeValue = computed<PropertyEditorType>(() => props.property?.editorType ?? 'datatype')
const propertyTermOptions = computed(() => [
  ...PROPERTY_TERM_OPTIONS,
  { label: 'Custom IRI', value: CUSTOM_IRI_OPTION_VALUE },
])
const selectedSuggestedTerm = computed(() => {
  const path = props.property?.path?.value?.trim()
  if (!path) return ''
  return PROPERTY_TERM_OPTIONS.some(option => option.value === path) ? path : CUSTOM_IRI_OPTION_VALUE
})
const inheritanceOptions = computed(() =>
  props.allShapes
    .filter(shape => shape.nodeId.value !== props.shape?.nodeId.value)
    .map(shape => ({ label: shape.label ?? shape.nodeId.value, value: shape.nodeId.value })),
)
const propertyNodeOptions = computed(() =>
  props.allShapes.map(shape => ({ label: shape.label ?? shape.nodeId.value, value: shape.nodeId.value })),
)
const closedToggle = computed({
  get: () => Boolean(props.shape?.closed),
  set: value => {
    if (!props.shape) return
    props.updateShapeField(props.shape.nodeId.value, 'closed', value ? 'closed' : 'open')
  },
})

const propertyMinMode = computed<'inclusive' | 'exclusive' | null>(() => {
  if (!props.property) return null
  if (props.property.minInclusive !== undefined) return 'inclusive'
  if (props.property.minExclusive !== undefined) return 'exclusive'
  return null
})
const propertyMaxMode = computed<'inclusive' | 'exclusive' | null>(() => {
  if (!props.property) return null
  if (props.property.maxInclusive !== undefined) return 'inclusive'
  if (props.property.maxExclusive !== undefined) return 'exclusive'
  return null
})
const propertyMinValue = computed(() => props.property?.minInclusive ?? props.property?.minExclusive ?? null)
const propertyMaxValue = computed(() => props.property?.maxInclusive ?? props.property?.maxExclusive ?? null)
const subjectOptionsForShape = computed(() => {
  const options = [...subjectHeadingOptions.value]
  const currentSubject = props.shape?.subject?.trim()
  if (currentSubject && !options.some(option => option.value === currentSubject)) {
    options.unshift({ label: currentSubject, value: currentSubject })
  }
  return options
})

const missingTitle = computed(() => !props.property && !props.shape?.label?.trim())
const missingCreator = computed(() => !props.property && !props.shape?.creator?.trim())
const missingCreated = computed(() => !props.property && !props.shape?.created?.trim())
const missingLicense = computed(() => !props.property && !props.shape?.license?.trim())
const missingPropertyTerm = computed(() => Boolean(props.property) && !props.property?.path?.value?.trim())
const missingProfileTarget = computed(() => propertyTypeValue.value === 'profile' && !propertyNodeTarget.value)

onMounted(async () => {
  try {
    subjectHeadingOptions.value = await fetchSubjectHeadingOptions()
  } catch {
    subjectHeadingOptions.value = []
  }
})

function updateShape(field: EditableShapeField, value: string): void {
  if (!props.shape) return
  props.updateShapeField(props.shape.nodeId.value, field, value)
}

function updateProperty(field: EditablePropertyField, value: string): void {
  if (!props.shape || !props.property) return
  props.updatePropertyField(props.shape.nodeId.value, props.property.nodeId.value, field, value)
}

function onInheritanceChange(value: string): void {
  if (!props.shape) return
  props.setShapeInheritance(props.shape.nodeId.value, value || null)
}

function onNodeTargetChange(value: string): void {
  if (!props.shape || !props.property) return
  props.setPropertyNodeTarget(props.shape.nodeId.value, props.property.nodeId.value, value || null)
}

function onPropertyTypeChange(value: string): void {
  if (!props.shape || !props.property) return
  props.setPropertyType(props.shape.nodeId.value, props.property.nodeId.value, value as PropertyEditorType)
}

function onSuggestedTermChange(value: string): void {
  if (value === CUSTOM_IRI_OPTION_VALUE) return
  updateProperty('path', value)
}

function onPropertyMinModeChange(mode: 'inclusive' | 'exclusive'): void {
  if (!props.property) return
  const current = props.property.minInclusive ?? props.property.minExclusive ?? ''
  if (mode === 'inclusive') {
    updateProperty('minExclusive', '')
    updateProperty('minInclusive', current)
    return
  }
  updateProperty('minInclusive', '')
  updateProperty('minExclusive', current)
}

function onPropertyMaxModeChange(mode: 'inclusive' | 'exclusive'): void {
  if (!props.property) return
  const current = props.property.maxInclusive ?? props.property.maxExclusive ?? ''
  if (mode === 'inclusive') {
    updateProperty('maxExclusive', '')
    updateProperty('maxInclusive', current)
    return
  }
  updateProperty('maxInclusive', '')
  updateProperty('maxExclusive', current)
}

function onPropertyMinValueChange(value: string): void {
  if (propertyMinMode.value === 'exclusive') {
    updateProperty('minInclusive', '')
    updateProperty('minExclusive', value)
    return
  }
  updateProperty('minExclusive', '')
  updateProperty('minInclusive', value)
}

function onPropertyMaxValueChange(value: string): void {
  if (propertyMaxMode.value === 'exclusive') {
    updateProperty('maxInclusive', '')
    updateProperty('maxExclusive', value)
    return
  }
  updateProperty('maxExclusive', '')
  updateProperty('maxInclusive', value)
}

function requestDeleteProfile(): void {
  if (!props.shape || props.property) return
  confirm.require({
    header: 'Delete profile',
    message: 'Delete this profile from the editor?',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: () => {
      const result = props.deleteShape(props.shape!.nodeId.value)
      if (!result.ok) window.alert(result.reason ?? 'Profile cannot be deleted.')
    },
  })
}

function requestDeleteProperty(): void {
  if (!props.shape || !props.property) return
  confirm.require({
    header: 'Delete field',
    message: 'Delete this field from the profile?',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: () => {
      props.deleteProperty(props.shape!.nodeId.value, props.property!.nodeId.value)
    },
  })
}
</script>

<template>
  <aside class="editor-inspector">
    <template v-if="shape">
      <header class="inspector-header">
        <div class="inspector-type ui-sidepanel-kicker">{{ isPropertyInspector ? 'Property' : 'Profile' }}</div>
        <div class="inspector-header__top">
          <h2 class="inspector-title">{{ inspectorTitle }}</h2>
          <button
            type="button"
            class="delete-icon"
            :title="property ? 'Delete field' : 'Delete profile'"
            @click="property ? requestDeleteProperty() : requestDeleteProfile()"
          >
            <i class="pi pi-trash" />
          </button>
        </div>
        <p class="inspector-subtitle ui-sidepanel-meta">
          {{ isPropertyInspector ? (shape.label ?? shape.nodeId.value) : (profile?.iri ?? shape.sourceProfileIri ?? 'Local profile') }}
        </p>
      </header>

      <div v-if="isPropertyInspector" class="inspector-tabs" role="tablist" aria-label="Inspector sections">
        <button type="button" class="inspector-tab ui-sidepanel-tab" :class="{ active: activeTab === 'basic' }" @click="activeTab = 'basic'">Basic</button>
        <button type="button" class="inspector-tab ui-sidepanel-tab" :class="{ active: activeTab === 'advanced' }" @click="activeTab = 'advanced'">Advanced</button>
      </div>

      <div v-if="isPropertyInspector ? activeTab === 'basic' : true" class="inspector-section-stack">
        <template v-if="property">
          <section class="inspector-section">
            <h3 class="inspector-section-title ui-sidepanel-section-title">Basic Information</h3>

            <InspectorEditableField
              label="Suggested Terms"
              :value="selectedSuggestedTerm"
              placeholder=""
              :options="propertyTermOptions"
              helper-text="Choose a schema.org suggestion or set your own Term IRI below."
              @update:value="onSuggestedTermChange"
            />
            <InspectorEditableField
              label="Term IRI"
              :value="property.path?.value ?? null"
              placeholder="https://..."
              :invalid="missingPropertyTerm"
              :helper-text="missingPropertyTerm ? 'A Term IRI is required for this field.' : 'Custom IRIs are supported.'"
              @update:value="updateProperty('path', $event)"
            />
            <InspectorEditableField
              label="Field Name"
              :value="property.name ?? null"
              placeholder="Unnamed field"
              :auto-focus="!property.name?.trim()"
              @update:value="updateProperty('name', $event)"
            />
            <InspectorEditableField label="Description" :value="property.description" placeholder="Description" multiline @update:value="updateProperty('description', $event)" />
            <InspectorEditableField label="Property Type" :value="propertyTypeValue" placeholder="" :options="PROPERTY_TYPE_OPTIONS" @update:value="onPropertyTypeChange" />

            <InspectorEditableField
              v-if="propertyTypeValue === 'datatype'"
              label="Datatype"
              :value="propertyDatatype"
              placeholder=""
              :options="SHACL_DATATYPE_OPTIONS"
              @update:value="updateProperty('datatype', $event)"
            />
            <InspectorEditableField
              v-else-if="propertyTypeValue === 'nodeKind'"
              label="Node Kind"
              :value="property.nodeKind?.value ?? null"
              placeholder=""
              :options="SHACL_NODE_KIND_OPTIONS"
              @update:value="updateProperty('nodeKind', $event)"
            />
            <InspectorEditableField
              v-else-if="propertyTypeValue === 'profile'"
              label="Node Target"
              :value="propertyNodeTarget"
              placeholder=""
              :options="propertyNodeOptions"
              :invalid="missingProfileTarget"
              :helper-text="missingProfileTarget ? 'Select a target profile to create the sh:node connection.' : null"
              @update:value="onNodeTargetChange"
            />
            <InspectorEditableField
              v-else-if="propertyTypeValue === 'list'"
              label="Allowed Values"
              :value="propertyAllowedValuesText"
              placeholder="One value per line"
              multiline
              helper-text="Serialized as sh:in."
              @update:value="updateProperty('allowedValues', $event)"
            />
          </section>

          <section class="inspector-section">
            <h3 class="inspector-section-title ui-sidepanel-section-title">Form Behavior</h3>
            <InspectorEditableField label="Minimum Required Entries" :value="property.minCount?.toString() ?? null" placeholder="1" type="number" @update:value="updateProperty('minCount', $event)" />
            <InspectorEditableField label="Maximum Possible Entries" :value="property.maxCount?.toString() ?? null" placeholder="*" type="number" @update:value="updateProperty('maxCount', $event)" />
            <InspectorEditableField label="Position On Metadata Form" :value="property.order?.toString() ?? null" placeholder="0" type="number" @update:value="updateProperty('order', $event)" />
          </section>
        </template>

        <template v-else>
          <section class="inspector-section">
            <InspectorReadOnlyField label="Profile Identifier" :value="profileIdentifier" link trailing-icon="pi pi-copy" />
          </section>

          <section class="inspector-section">
            <h3 class="inspector-section-title ui-sidepanel-section-title">Overview</h3>
            <InspectorEditableField
              label="Title"
              :value="shape.label ?? null"
              placeholder="Unnamed profile"
              :invalid="missingTitle"
              :helper-text="missingTitle ? 'Title is required.' : null"
              :auto-focus="!shape.label?.trim()"
              @update:value="updateShape('label', $event)"
            />
            <InspectorEditableField label="Description" :value="shape.description ?? null" placeholder="Description" multiline @update:value="updateShape('description', $event)" />
          </section>

          <section class="inspector-section">
            <h3 class="inspector-section-title ui-sidepanel-section-title">Attribution</h3>
            <InspectorEditableField
              label="Creator"
              :value="shape.creator ?? null"
              placeholder="Creator"
              :invalid="missingCreator"
              :helper-text="missingCreator ? 'Creator is required.' : null"
              @update:value="updateShape('creator', $event)"
            />
            <InspectorEditableField
              label="Creation Date"
              :value="shape.created ?? null"
              placeholder="YYYY-MM-DD"
              type="date"
              :invalid="missingCreated"
              :helper-text="missingCreated ? 'Creation date is required.' : null"
              @update:value="updateShape('created', $event)"
            />
            <InspectorEditableField
              label="License"
              :value="shape.license ?? null"
              placeholder=""
              :options="PROFILE_LICENSE_OPTIONS"
              :invalid="missingLicense"
              :helper-text="missingLicense ? 'License is required.' : null"
              @update:value="updateShape('license', $event)"
            />
            <InspectorEditableField label="Subject" :value="shape.subject ?? null" placeholder="" :options="subjectOptionsForShape" @update:value="updateShape('subject', $event)" />
          </section>

          <section class="inspector-section">
            <h3 class="inspector-section-title ui-sidepanel-section-title">Links</h3>
            <InspectorEditableField label="Inherits from" :value="shape.inheritedShapeIris?.[0] ?? null" placeholder="" :options="inheritanceOptions" @update:value="onInheritanceChange" />
            <InspectorEditableField label="Target Class" :value="shape.targetClass?.value ?? null" placeholder="https://...class" @update:value="updateShape('targetClass', $event)" />
          </section>

          <section class="inspector-section inspector-section--compact">
            <label class="toggle-field">
              <span class="editable-field__label ui-sidepanel-field-label">Closed Shape</span>
              <button type="button" class="toggle-field__button" :class="{ 'is-on': closedToggle }" @click="closedToggle = !closedToggle">
                <span class="toggle-field__thumb" />
              </button>
            </label>
          </section>
        </template>
      </div>

      <div v-if="isPropertyInspector && activeTab === 'advanced'" class="inspector-section-stack">
        <template v-if="property">
          <section class="inspector-section">
            <h3 class="inspector-section-title ui-sidepanel-section-title">Value Constraints</h3>
            <InspectorConstraintRangeField
              label="Minimum"
              :value="propertyMinValue"
              placeholder="Min"
              :mode="propertyMinMode ?? 'inclusive'"
              editable
              @update:value="onPropertyMinValueChange"
              @update:mode="onPropertyMinModeChange"
            />
            <InspectorConstraintRangeField
              label="Maximum"
              :value="propertyMaxValue"
              placeholder="Max"
              :mode="propertyMaxMode ?? 'inclusive'"
              editable
              @update:value="onPropertyMaxValueChange"
              @update:mode="onPropertyMaxModeChange"
            />
          </section>

          <section class="inspector-section">
            <h3 class="inspector-section-title ui-sidepanel-section-title">Administrative</h3>
            <InspectorEditableField label="Default Value" :value="property.defaultValue ?? null" placeholder="Default Value" @update:value="updateProperty('defaultValue', $event)" />
            <InspectorEditableField label="Error Message" :value="property.message ?? null" placeholder="Please enter a valid value." multiline @update:value="updateProperty('message', $event)" />
            <InspectorEditableField label="Severity" :value="property.severity?.value ?? null" placeholder="https://...severity" @update:value="updateProperty('severity', $event)" />
          </section>

          <section class="inspector-section">
            <h3 class="inspector-section-title ui-sidepanel-section-title">Relationship</h3>
            <InspectorEditableField label="Class" :value="property.cls?.value ?? null" placeholder="https://...class" @update:value="updateProperty('cls', $event)" />
            <InspectorEditableField label="Pattern" :value="property.pattern ?? null" placeholder="Regex pattern" @update:value="updateProperty('pattern', $event)" />
            <InspectorEditableField label="Equal To" :value="property.equals?.value ?? null" placeholder="https://...property" @update:value="updateProperty('equals', $event)" />
            <InspectorEditableField label="Disjoint To" :value="property.disjoint?.value ?? null" placeholder="https://...property" @update:value="updateProperty('disjoint', $event)" />
            <InspectorEditableField label="Less Than" :value="property.lessThan?.value ?? null" placeholder="https://...property" @update:value="updateProperty('lessThan', $event)" />
            <InspectorEditableField label="Less Than Or Equal To" :value="property.lessThanOrEquals?.value ?? null" placeholder="https://...property" @update:value="updateProperty('lessThanOrEquals', $event)" />
            <InspectorReadOnlyField label="Constraint Summary" :value="propertyConstraintText" placeholder="Not defined" multiline />
            <InspectorReadOnlyField label="Relationship Kinds" :value="propertyRelations.length > 0 ? propertyRelations.join(', ') : null" placeholder="Not defined" multiline />
            <InspectorReadOnlyField label="Inherited From" :value="property.inheritedFromShapeIri ?? null" placeholder="Not inherited" link />
          </section>
        </template>
      </div>
    </template>

    <div v-else class="inspector-empty-state">
      <div class="inspector-empty-card">
        <span class="meta-label">Inspector</span>
        <h3 class="panel-title">Select a shape or property</h3>
        <p class="helper-text">The selected shape or property appears here with profile metadata and SHACL constraints.</p>
      </div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.editor-inspector {
  position: relative;
  width: 100%;
  min-width: 0;
  max-width: none;
  height: 100%;
  border-left: 1px solid var(--color-border);
  background: linear-gradient(180deg, var(--color-surface-2) 0%, var(--color-bg) 100%);
  overflow: auto;
}

.inspector-header {
  padding: var(--space-5) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-1) 100%);
}

.inspector-header__top {
  display: flex;
  align-items: start;
  gap: var(--space-2);
}

.inspector-type {
  margin-bottom: 6px;
}

.inspector-title {
  margin: 0;
  flex: 1;
  font-family: var(--font-sans);
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.35;
}

.delete-icon {
  width: 32px;
  height: 32px;
  border: 1px solid #e3b1b1;
  border-radius: 999px;
  background: #fff1f1;
  color: #b42323;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.inspector-subtitle {
  margin: 8px 0 0;
  overflow-wrap: anywhere;
}

.inspector-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 0;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.inspector-tab {
  position: relative;
  padding: 12px 16px;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.inspector-tab + .inspector-tab {
  border-left: 1px solid var(--color-border);
}

.inspector-tab.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: var(--color-primary);
}

.inspector-section-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
}

.inspector-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px;
}

.inspector-section--compact {
  padding-top: 0;
}

.inspector-section-title {
  margin: 0;
}

.toggle-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.toggle-field__button {
  width: 52px;
  height: 30px;
  padding: 3px;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface-2);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.toggle-field__button.is-on {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.toggle-field__thumb {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: white;
  box-shadow: var(--shadow-sm);
  transition: transform 0.15s ease;
}

.toggle-field__button.is-on .toggle-field__thumb {
  transform: translateX(20px);
}

.inspector-empty-state {
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  min-height: 100%;
  padding: var(--space-4);
  background: var(--color-surface-1);
}

.inspector-empty-card {
  width: 100%;
  align-self: center;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-1) 100%);
  box-shadow: var(--shadow-sm);
}

@media (max-width: 1100px) {
  .editor-inspector {
    width: 100%;
    max-width: none;
    min-width: 0;
    border-left: 0;
    border-top: 1px solid var(--color-border);
    height: auto;
  }
}
</style>
