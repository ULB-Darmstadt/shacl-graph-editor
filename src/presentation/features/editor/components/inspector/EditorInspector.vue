<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import {
  buildProfileLicenseOptions,
  defaultDatatypeLabel,
  fetchSubjectHeadingOptions,
  PROPERTY_TERM_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  resolveImportedSubjectLabel,
  SHACL_DATATYPE_OPTIONS,
  SHACL_NODE_KIND_OPTIONS,
  type SelectOption,
} from '@/application/profiles/profileEditorCatalogs'
import {
  inferPropertyEditorType,
  propertyConstraintSummary,
  propertyDatatypeTargets,
  propertyNodeTargets,
  propertyRelationshipKinds,
  type NodeShape,
  type PropertyShape,
  type RdfLiteralValue,
  type ShaclProfile,
} from '@/domain/profiles'
import type { PropertyEditorType } from '@/application/profiles/profileEditorStore'
import { isPlaceholderTermIri } from '@/shared/rdf/placeholderTermIri'
import InspectorAutocompleteField from '@/presentation/features/editor/components/inspector/InspectorAutocompleteField.vue'
import InspectorEditableField from '@/presentation/features/editor/components/inspector/InspectorEditableField.vue'
import InspectorReadOnlyField from '@/presentation/features/editor/components/inspector/InspectorReadOnlyField.vue'
import InspectorFixedValuesField from '@/presentation/features/editor/components/inspector/InspectorFixedValuesField.vue'
import InspectorConstraintRangeField from '@/presentation/features/editor/components/inspector/InspectorConstraintRangeField.vue'

const TerminologySearchDialog = defineAsyncComponent(() => import('./TerminologySearchDialog.vue'))

type InspectorTab = 'basic' | 'advanced'
type AllowedValueRow = {
  label: string
  iri: string
}
type DatatypeAlternativeRow = {
  datatype: string
  label: string
}
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
  | 'hasValues'
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
  | 'allowedValueLabels'
  | 'alternativeTargets'
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
  | 'qualifiedMinCount'
  | 'qualifiedMaxCount'

const props = defineProps<{
  shape: NodeShape | null
  property: PropertyShape | null
  profile: ShaclProfile | null
  readOnly: boolean
  reviewMode?: boolean
  importedLocked?: boolean
  draftPropertyNodeId: string | null
  allShapes: NodeShape[]
  createProperty: (shapeIri: string) => void
  commitDraftProperty: (propertyNodeId: string) => void
  updateShapeField: (shapeIri: string, field: EditableShapeField, value: string | null) => void
  updateProfileUrl: (profileIri: string, value: string) => { ok: boolean; reason?: string }
  updatePropertyField: (shapeIri: string, propertyNodeId: string, field: EditablePropertyField, value: string | null) => void
  setShapeInheritance: (shapeIri: string, inheritedShapeIri: string | null) => void
  setPropertyNodeTarget: (shapeIri: string, propertyNodeId: string, targetShapeIri: string | null) => void
  setPropertyInlineNodeShape: (shapeIri: string, propertyNodeId: string, enabled: boolean) => void
  setPropertyInlineNodeShapeLabel: (shapeIri: string, propertyNodeId: string, label: string | null) => void
  setPropertyAlternativeTargets: (shapeIri: string, propertyNodeId: string, targetShapeIris: string[]) => void
  setPropertyExclusiveDatatypeAlternatives: (shapeIri: string, propertyNodeId: string, alternatives: DatatypeAlternativeRow[]) => void
  setPropertyType: (shapeIri: string, propertyNodeId: string, type: PropertyEditorType) => void
  deleteShape: (shapeIri: string) => { ok: boolean; reason?: string }
  deleteProperty: (shapeIri: string, propertyNodeId: string) => boolean
}>()

const confirm = useConfirm()
const activeTab = ref<InspectorTab>('basic')
const subjectHeadingOptions = ref<SelectOption[]>([])
const allowedValuesDialogOpen = ref(false)
const allowedValueDraftRows = ref<AllowedValueRow[]>([])
const terminologySearchOpen = ref(false)

watch([() => props.shape?.nodeId.value, () => props.property?.nodeId.value, () => props.readOnly, () => props.reviewMode], () => {
  terminologySearchOpen.value = false
})

function useTerminologyTerm(iri: string): void {
  if (!props.readOnly && !props.reviewMode && terminologySearchOpen.value) updateProperty('path', iri)
  terminologySearchOpen.value = false
}

const isPropertyInspector = computed(() => props.shape !== null && props.property !== null)
const inspectorTitle = computed(() => {
  if (props.property) return props.property.name?.trim() || 'Unnamed field'
  if (props.shape) return props.shape.label?.trim() || 'Unnamed profile'
  return 'Inspector'
})
const profileIdentifier = computed(() => props.profile?.iri ?? props.shape?.sourceProfileIri ?? props.shape?.nodeId.value ?? null)
const profileUrlDraft = ref('')
const profileUrlError = ref<string | null>(null)
watch([profileIdentifier, () => props.readOnly], () => {
  profileUrlDraft.value = profileIdentifier.value ?? ''
  profileUrlError.value = null
}, { immediate: true })

function saveProfileUrl(): void {
  if (props.readOnly || !props.profile) return
  const result = props.updateProfileUrl(props.profile.iri, profileUrlDraft.value)
  profileUrlError.value = result.ok ? null : result.reason ?? 'Could not update the Metadata Profile URL.'
  if (result.ok) profileUrlDraft.value = profileUrlDraft.value.trim()
}
const propertyDatatype = computed(() => props.property ? propertyDatatypeTargets(props.property)[0]?.value ?? null : null)
const propertyNodeTarget = computed(() => props.property ? propertyNodeTargets(props.property)[0]?.value ?? null : null)
const propertyUsesInlineNodeShape = computed(() => Boolean(props.property?.qualifiedValueShape?.inlineNodeShape))
const propertyRelations = computed(() => props.property ? propertyRelationshipKinds(props.property) : [])
const propertyConstraintText = computed(() => props.property ? propertyConstraintSummary(props.property) ?? null : null)
const propertyAllowedValueRows = computed<AllowedValueRow[]>(() => {
  if (!props.property?.allowedValues?.length) return []
  return props.property.allowedValues
    .map(value => {
      const label = preferredLiteralLabel(props.property?.allowedValueLabels?.[value])
      if (label) return { label, iri: value }
      return isResourceIdentifier(value)
        ? { label: '', iri: value }
        : { label: value, iri: '' }
    })
})
const propertyAllowedValueRowInputs = computed<AllowedValueRow[]>(() => [
  ...allowedValueDraftRows.value,
  { label: '', iri: '' },
])
const propertyAllowedValueDisplayItems = computed(() =>
  propertyAllowedValueRows.value.map(row => ({
    label: row.label || row.iri,
    iri: row.iri || null,
  })),
)
const propertyAlternativeTargets = computed(() =>
  (props.property?.editorType === 'exactlyOneOfProfiles' ? props.property.exclusiveAlternatives : props.property?.alternatives)
    ?.map(alternative => alternative.node?.value ?? '') ?? [],
)
const propertyAlternativeTargetInputs = computed(() => {
  const targets = propertyAlternativeTargets.value.filter(Boolean)
  return [...targets, '']
})
const propertyDatatypeAlternatives = computed<DatatypeAlternativeRow[]>(() =>
  props.property?.exclusiveAlternatives
    ?.filter(alternative => alternative.datatype)
    .map(alternative => ({
      datatype: alternative.datatype?.value ?? '',
      label: alternative.label ?? '',
    })) ?? [],
)
const propertyDatatypeAlternativeInputs = computed<DatatypeAlternativeRow[]>(() => [
  ...propertyDatatypeAlternatives.value,
  { datatype: '', label: '' },
])
const propertyTypeValue = computed<PropertyEditorType>(() =>
  props.property ? (props.property.editorType ?? inferPropertyEditorType(props.property)) as PropertyEditorType : 'datatype',
)
const inheritanceOptions = computed(() =>
  props.allShapes
    .filter(shape => shape.nodeId.value !== props.shape?.nodeId.value)
    .map(shape => ({ label: shape.label ?? shape.nodeId.value, value: shape.nodeId.value })),
)
const propertyNodeOptions = computed(() =>
  props.allShapes
    .filter(shape => shape.nodeId.value !== props.shape?.nodeId.value)
    .map(shape => ({ label: shape.label ?? shape.nodeId.value, value: shape.nodeId.value })),
)
const shapeLicenseOptions = computed(() => buildProfileLicenseOptions(props.shape?.license ?? null))
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
    options.unshift({
      label: resolveImportedSubjectLabel(currentSubject) ?? currentSubject,
      value: currentSubject,
    })
  }
  return options
})

const missingTitle = computed(() => !props.property && !props.shape?.label?.trim())
const missingCreator = computed(() => !props.property && !props.shape?.creator?.trim())
const missingCreated = computed(() => !props.property && !props.shape?.created?.trim())
const missingLicense = computed(() => !props.property && !props.shape?.license?.trim())
const missingPropertyTerm = computed(() => Boolean(props.property) && !props.property?.path?.value?.trim())
const placeholderPropertyTerm = computed(() => isPlaceholderTermIri(props.property?.path?.value))
const missingPropertyName = computed(() => Boolean(props.property) && !props.property?.name?.trim())
const missingPropertyOrder = computed(() => Boolean(props.property) && props.property?.order === undefined)
const missingProfileTarget = computed(() =>
  (propertyTypeValue.value === 'profile' || propertyTypeValue.value === 'qualifiedProfile') && !propertyNodeTarget.value,
)
const missingQualifiedCounts = computed(() =>
  propertyTypeValue.value === 'qualifiedProfile'
  && props.property?.qualifiedMinCount === undefined
  && props.property?.qualifiedMaxCount === undefined,
)
const missingShapeDescription = computed(() => !props.property && !props.shape?.description?.trim())
const missingPropertyDescription = computed(() => Boolean(props.property) && !props.property?.description?.trim())
const missingAllowedValues = computed(() =>
  propertyTypeValue.value === 'list' && (!props.property?.allowedValues || props.property.allowedValues.length === 0),
)
const missingAlternativeTargets = computed(() =>
  (propertyTypeValue.value === 'oneOfProfiles' || propertyTypeValue.value === 'exactlyOneOfProfiles')
  && propertyAlternativeTargets.value.filter(Boolean).length <= 1,
)
const missingDatatypeAlternatives = computed(() =>
  propertyTypeValue.value === 'exactlyOneOfDatatypes'
  && propertyDatatypeAlternatives.value.length <= 1,
)
const isDraftProperty = computed(() => Boolean(props.property && props.property.nodeId.value === props.draftPropertyNodeId))

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

function onInlineNodeShapeToggle(): void {
  if (!props.shape || !props.property) return
  props.setPropertyInlineNodeShape(
    props.shape.nodeId.value,
    props.property.nodeId.value,
    !propertyUsesInlineNodeShape.value,
  )
}

function onInlineNodeShapeLabelChange(value: string): void {
  if (!props.shape || !props.property) return
  props.setPropertyInlineNodeShapeLabel(props.shape.nodeId.value, props.property.nodeId.value, value || null)
}

function onAlternativeTargetChange(index: number, value: string): void {
  if (!props.shape || !props.property) return
  const next = [...propertyAlternativeTargetInputs.value]
  next[index] = value
  props.setPropertyAlternativeTargets(
    props.shape.nodeId.value,
    props.property.nodeId.value,
    next.filter(Boolean),
  )
}

function removeAlternativeTarget(index: number): void {
  if (!props.shape || !props.property) return
  const next = propertyAlternativeTargets.value.filter((_, currentIndex) => currentIndex !== index)
  props.setPropertyAlternativeTargets(props.shape.nodeId.value, props.property.nodeId.value, next)
}

function onDatatypeAlternativeChange(index: number, field: keyof DatatypeAlternativeRow, value: string): void {
  if (!props.shape || !props.property) return
  const next = propertyDatatypeAlternativeInputs.value.map(row => ({ ...row }))
  const previous = next[index]
  next[index] = { ...next[index], [field]: value }
  if (field === 'datatype' && (!previous.datatype || previous.label === defaultDatatypeLabel(previous.datatype))) {
    next[index].label = defaultDatatypeLabel(value)
  }
  props.setPropertyExclusiveDatatypeAlternatives(
    props.shape.nodeId.value,
    props.property.nodeId.value,
    next.filter(row => row.datatype),
  )
}

function removeDatatypeAlternative(index: number): void {
  if (!props.shape || !props.property) return
  const next = propertyDatatypeAlternatives.value.filter((_, currentIndex) => currentIndex !== index)
  props.setPropertyExclusiveDatatypeAlternatives(props.shape.nodeId.value, props.property.nodeId.value, next)
}

function onPropertyTypeChange(value: string): void {
  if (!props.shape || !props.property) return
  props.setPropertyType(props.shape.nodeId.value, props.property.nodeId.value, value as PropertyEditorType)
}

function openAllowedValuesDialog(): void {
  allowedValueDraftRows.value = propertyAllowedValueRows.value.map(row => ({ ...row }))
  allowedValuesDialogOpen.value = true
}

function closeAllowedValuesDialog(): void {
  allowedValuesDialogOpen.value = false
  allowedValueDraftRows.value = []
}

function saveAllowedValuesDialog(): void {
  updateAllowedValueLabels(serializeAllowedValueRows(allowedValueDraftRows.value))
  closeAllowedValuesDialog()
}

function updateAllowedValueLabels(value: string): void {
  updateProperty('allowedValueLabels', value)
}

function updateAllowedValueRow(index: number, field: keyof AllowedValueRow, value: string): void {
  const rows = [...allowedValueDraftRows.value]
  while (rows.length <= index) rows.push({ label: '', iri: '' })
  rows[index] = { ...rows[index], [field]: value }
  allowedValueDraftRows.value = rows
}

function onAllowedValueRowInput(index: number, field: keyof AllowedValueRow, event: Event): void {
  updateAllowedValueRow(index, field, (event.target as HTMLInputElement).value)
}

function removeAllowedValueRow(index: number): void {
  allowedValueDraftRows.value = allowedValueDraftRows.value.filter((_, currentIndex) => currentIndex !== index)
}

function serializeAllowedValueRows(rows: AllowedValueRow[]): string {
  return rows
    .map(row => ({ label: row.label.trim(), iri: row.iri.trim() }))
    .filter(row => row.label || row.iri)
    .map(row => {
      if (row.iri && row.label) return `${row.iri} | ${row.label}`
      return row.iri || row.label
    })
    .join('\n')
}

function preferredLiteralLabel(labels: RdfLiteralValue[] | undefined): string | undefined {
  if (!labels?.length) return undefined
  return labels.find(label => label.lang === 'en')?.value
    ?? labels.find(label => label.lang?.startsWith('en-'))?.value
    ?? labels.find(label => !label.lang)?.value
    ?? labels[0]?.value
}

function isResourceIdentifier(value: string): boolean {
  return /^(https?:|urn:)/.test(value)
}

function onDraftFieldNameBlur(): void {
  if (!props.shape || !props.property || !isDraftProperty.value) return
  if (props.property.name?.trim()) {
    props.commitDraftProperty(props.property.nodeId.value)
    return
  }
  props.deleteProperty(props.shape.nodeId.value, props.property.nodeId.value)
}

function onDraftFieldNameSubmit(): void {
  if (!props.shape || !props.property || !isDraftProperty.value || props.readOnly) return
  if (!props.property.name?.trim()) return
  props.commitDraftProperty(props.property.nodeId.value)
  props.createProperty(props.shape.nodeId.value)
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
  if (!props.shape || props.property || props.readOnly) return
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
  if (!props.shape || !props.property || props.readOnly) return
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
            :disabled="readOnly"
            :title="property ? 'Delete field' : 'Delete profile'"
            @click="property ? requestDeleteProperty() : requestDeleteProfile()"
          >
            <i class="pi pi-trash" />
          </button>
        </div>
        <p class="inspector-subtitle ui-sidepanel-meta">
          {{ isPropertyInspector ? (shape.label ?? shape.nodeId.value) : (profile?.iri ?? shape.sourceProfileIri ?? 'Local profile') }}
        </p>
        <p v-if="importedLocked" class="inspector-lock-notice" role="status">
          <i class="pi pi-lock" aria-hidden="true" />
          Imported profile locked. You can still inherit it or copy its fields into an editable profile.
        </p>
      </header>

      <div v-if="isPropertyInspector" class="inspector-tabs" role="tablist" aria-label="Inspector sections">
        <button type="button" class="inspector-tab ui-sidepanel-tab" :class="{ active: activeTab === 'basic' }" @click="activeTab = 'basic'">Basic</button>
        <button type="button" class="inspector-tab ui-sidepanel-tab" :class="{ active: activeTab === 'advanced' }" @click="activeTab = 'advanced'">Advanced</button>
      </div>

      <fieldset v-if="isPropertyInspector ? activeTab === 'basic' : true" class="inspector-fieldset" :disabled="readOnly">
        <div class="inspector-section-stack">
          <template v-if="property">
            <section class="inspector-section">
              <h3 class="inspector-section-title ui-sidepanel-section-title">Basic Information</h3>

              <InspectorAutocompleteField
                label="Term IRI"
                :value="property.path?.value ?? null"
                :options="PROPERTY_TERM_OPTIONS"
                placeholder="https://..."
                :disabled="readOnly"
                :invalid="missingPropertyTerm"
                :warning="placeholderPropertyTerm"
                :helper-text="missingPropertyTerm ? 'A Term IRI is required for this field.' : placeholderPropertyTerm ? 'Placeholder term IRI. Replace it with a term IRI.' : 'Type your own IRI or choose a suggested term while typing.'"
                @update:value="updateProperty('path', $event)"
              >
                <template #action>
                  <button
                    type="button"
                    class="term-search-button"
                    title="Search terminology"
                    aria-label="Search terminology for Term IRI"
                    :disabled="readOnly || reviewMode"
                    @click="terminologySearchOpen = true"
                  >
                    <i class="pi pi-search" aria-hidden="true" />
                  </button>
                </template>
              </InspectorAutocompleteField>
              <InspectorEditableField
                label="Field Name"
                :value="property.name ?? null"
                placeholder="Unnamed field"
                :disabled="readOnly"
                :invalid="missingPropertyName"
                :helper-text="missingPropertyName ? 'Field name is required.' : null"
                @update:value="updateProperty('name', $event)"
                @blur="onDraftFieldNameBlur"
                @submit="onDraftFieldNameSubmit"
              />
              <InspectorEditableField
                label="Description"
                :value="property.description"
                placeholder="Description"
                multiline
                :warning="missingPropertyDescription"
                :helper-text="missingPropertyDescription ? 'Description is recommended.' : null"
                @update:value="updateProperty('description', $event)"
              />
              <InspectorEditableField label="Property Type" :value="propertyTypeValue" placeholder="" :options="PROPERTY_TYPE_OPTIONS" @update:value="onPropertyTypeChange" />

              <InspectorFixedValuesField
                v-if="propertyTypeValue === 'value'"
                :key="property.nodeId.value"
                :values="property.hasValues"
                :disabled="readOnly"
                @update:value="updateProperty('hasValues', $event)"
              />
              <InspectorEditableField
                v-else-if="propertyTypeValue === 'datatype'"
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
                v-else-if="propertyTypeValue === 'class'"
                label="Class"
                :value="property.cls?.value ?? null"
                placeholder="https://...class"
                @update:value="updateProperty('cls', $event)"
              />
              <div v-else-if="propertyTypeValue === 'exactlyOneOfDatatypes'" class="alternative-targets" :class="{ 'is-invalid': missingDatatypeAlternatives }">
                <span class="editable-field__label ui-sidepanel-field-label">Exclusive Datatype Alternatives</span>
                <span class="alternative-targets__helper" :class="{ 'is-invalid': missingDatatypeAlternatives }">
                  {{ missingDatatypeAlternatives ? 'At least two datatype alternatives are required.' : 'Serialized as sh:xone.' }}
                </span>
                <div v-for="(alternative, index) in propertyDatatypeAlternativeInputs" :key="`${property.nodeId.value}:datatype-alt:${index}`" class="datatype-alternative-row">
                  <InspectorEditableField
                    :label="`Datatype ${index + 1}`"
                    :value="alternative.datatype || null"
                    placeholder=""
                    :options="SHACL_DATATYPE_OPTIONS"
                    @update:value="onDatatypeAlternativeChange(index, 'datatype', $event)"
                  />
                  <InspectorEditableField
                    v-if="alternative.datatype"
                    :label="`Label ${index + 1}`"
                    :value="alternative.label || null"
                    placeholder="Optional label"
                    @update:value="onDatatypeAlternativeChange(index, 'label', $event)"
                  />
                  <button v-if="alternative.datatype" type="button" class="alternative-target-remove" :disabled="readOnly" title="Remove datatype alternative" @click="removeDatatypeAlternative(index)">
                    <i class="pi pi-times" />
                  </button>
                </div>
              </div>
              <InspectorEditableField
                v-else-if="propertyTypeValue === 'profile' || propertyTypeValue === 'qualifiedProfile'"
                label="Node Target"
                :value="propertyNodeTarget"
                placeholder=""
                :options="propertyNodeOptions"
                :invalid="missingProfileTarget"
                :helper-text="missingProfileTarget
                  ? (propertyTypeValue === 'qualifiedProfile'
                    ? 'Select a target profile to create the sh:qualifiedValueShape connection.'
                    : 'Select a target profile to create the sh:node connection.')
                  : null"
                @update:value="onNodeTargetChange"
              />
              <template v-if="propertyTypeValue === 'qualifiedProfile'">
                <label class="toggle-field">
                  <span class="editable-field__label ui-sidepanel-field-label">Blank node</span>
                  <button
                    type="button"
                    role="switch"
                    class="toggle-field__button"
                    :disabled="readOnly"
                    :class="{ 'is-on': propertyUsesInlineNodeShape }"
                    :aria-checked="propertyUsesInlineNodeShape"
                    aria-label="Use blank node shape"
                    @click="onInlineNodeShapeToggle"
                  >
                    <span class="toggle-field__thumb" />
                  </button>
                </label>
                <InspectorEditableField
                  v-if="propertyUsesInlineNodeShape"
                  label="Shape Label"
                  :value="property.qualifiedValueShape?.label ?? property.name ?? null"
                  placeholder="Shape label"
                  @update:value="onInlineNodeShapeLabelChange"
                />
              </template>
              <div v-else-if="propertyTypeValue === 'list'" class="allowed-values-sidebar" :class="{ 'is-invalid': missingAllowedValues }">
                <span class="editable-field__label ui-sidepanel-field-label">Allowed Values</span>
                <div v-if="propertyAllowedValueDisplayItems.length > 0" class="allowed-values-sidebar__items">
                  <div v-for="(item, index) in propertyAllowedValueDisplayItems" :key="`${item.label}:${index}`" class="allowed-values-sidebar__item">
                    <span class="allowed-values-sidebar__label">{{ item.label }}</span>
                    <span v-if="item.iri" class="allowed-values-sidebar__iri">{{ item.iri }}</span>
                  </div>
                </div>
                <p v-else class="allowed-values-sidebar__empty" :class="{ 'is-invalid': missingAllowedValues }">
                  {{ missingAllowedValues ? 'At least one value is required.' : 'No values defined.' }}
                </p>
                <button
                  type="button"
                  class="allowed-values-label-button"
                  :disabled="readOnly"
                  @click="openAllowedValuesDialog"
                >
                  Edit Values
                </button>
              </div>
              <div v-else-if="propertyTypeValue === 'oneOfProfiles' || propertyTypeValue === 'exactlyOneOfProfiles'" class="alternative-targets" :class="{ 'is-invalid': missingAlternativeTargets }">
                <span class="editable-field__label ui-sidepanel-field-label">{{ propertyTypeValue === 'exactlyOneOfProfiles' ? 'Exactly One Profile Targets' : 'Alternative Profile Targets' }}</span>
                <span class="alternative-targets__helper" :class="{ 'is-invalid': missingAlternativeTargets }">
                  {{ missingAlternativeTargets
                    ? 'At least two profile targets are required.'
                    : propertyTypeValue === 'exactlyOneOfProfiles'
                      ? 'The value must satisfy exactly one selected profile. Matching none or more than one fails validation.'
                      : 'Serialized as sh:or with one profile dropdown per alternative.' }}
                </span>
                <div v-for="(targetValue, index) in propertyAlternativeTargetInputs" :key="`${property.nodeId.value}:alt:${index}`" class="alternative-target-row">
                  <InspectorEditableField
                    :label="`Profile Option ${index + 1}`"
                    :value="targetValue || null"
                    placeholder=""
                    :options="propertyNodeOptions"
                    @update:value="onAlternativeTargetChange(index, $event)"
                  />
                  <button v-if="targetValue" type="button" class="alternative-target-remove" :disabled="readOnly" title="Remove profile option" @click="removeAlternativeTarget(index)">
                    <i class="pi pi-times" />
                  </button>
                </div>
              </div>
            </section>

            <section class="inspector-section">
              <h3 class="inspector-section-title ui-sidepanel-section-title">Form Behavior</h3>
              <InspectorEditableField label="Minimum Required Entries" :value="property.minCount?.toString() ?? null" placeholder="1" type="number" @update:value="updateProperty('minCount', $event)" />
              <InspectorEditableField label="Maximum Possible Entries" :value="property.maxCount?.toString() ?? null" placeholder="*" type="number" @update:value="updateProperty('maxCount', $event)" />
              <InspectorEditableField
                v-if="propertyTypeValue === 'qualifiedProfile'"
                label="Minimum Matching Profiles"
                :value="property.qualifiedMinCount?.toString() ?? null"
                placeholder="1"
                type="number"
                :invalid="missingQualifiedCounts"
                :helper-text="missingQualifiedCounts ? 'Set a qualified minimum or maximum count.' : 'Serialized as sh:qualifiedMinCount.'"
                @update:value="updateProperty('qualifiedMinCount', $event)"
              />
              <InspectorEditableField
                v-if="propertyTypeValue === 'qualifiedProfile'"
                label="Maximum Matching Profiles"
                :value="property.qualifiedMaxCount?.toString() ?? null"
                placeholder="*"
                type="number"
                :invalid="missingQualifiedCounts"
                :helper-text="missingQualifiedCounts ? 'Set a qualified minimum or maximum count.' : 'Serialized as sh:qualifiedMaxCount.'"
                @update:value="updateProperty('qualifiedMaxCount', $event)"
              />
              <InspectorEditableField
                label="Position On Metadata Form"
                :value="property.order?.toString() ?? null"
                placeholder="0"
                type="number"
                :invalid="missingPropertyOrder"
                :helper-text="missingPropertyOrder ? 'Form position is required.' : null"
                @update:value="updateProperty('order', $event)"
              />
            </section>
          </template>

          <template v-else>
            <section class="inspector-section">
              <InspectorReadOnlyField v-if="readOnly" label="Metadata Profile URL" :value="profileIdentifier" link trailing-icon="pi pi-copy" />
              <InspectorEditableField
                v-else
                label="Metadata Profile URL"
                :value="profileUrlDraft"
                placeholder="https://example.org/profile"
                :invalid="Boolean(profileUrlError)"
                :helper-text="profileUrlError"
                @update:value="profileUrlDraft = $event; profileUrlError = null"
                @blur="saveProfileUrl"
                @submit="saveProfileUrl"
              />
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
              <InspectorEditableField
                label="Description"
                :value="shape.description ?? null"
                placeholder="Description"
                multiline
                :warning="missingShapeDescription"
                :helper-text="missingShapeDescription ? 'Description is recommended.' : null"
                @update:value="updateShape('description', $event)"
              />
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
                :options="shapeLicenseOptions"
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
                <button type="button" class="toggle-field__button" :disabled="readOnly" :class="{ 'is-on': closedToggle }" @click="closedToggle = !closedToggle">
                  <span class="toggle-field__thumb" />
                </button>
              </label>
            </section>
          </template>
        </div>
      </fieldset>

      <fieldset v-if="isPropertyInspector && activeTab === 'advanced'" class="inspector-fieldset" :disabled="readOnly">
        <div class="inspector-section-stack">
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
      </fieldset>

      <div v-if="property && allowedValuesDialogOpen" class="metadata-dialog" role="dialog" aria-modal="true" aria-label="Allowed value labels">
        <div class="metadata-dialog__panel">
          <div class="metadata-dialog__header">
            <h3 class="inspector-section-title ui-sidepanel-section-title">Allowed Values</h3>
            <button type="button" class="metadata-dialog__close" title="Close" @click="closeAllowedValuesDialog">
              <i class="pi pi-times" />
            </button>
          </div>
          <div class="allowed-value-dialog__rows">
            <div class="allowed-value-dialog__head" aria-hidden="true">
              <span>Label</span>
              <span>IRI (optional)</span>
              <span />
            </div>
            <div
              v-for="(row, index) in propertyAllowedValueRowInputs"
              :key="`${property.nodeId.value}:allowed:${index}`"
              class="allowed-value-dialog__row"
            >
              <input
                class="allowed-value-dialog__input ui-sidepanel-field-input"
                :value="row.label || null"
                placeholder="Display label"
                :disabled="readOnly"
                :aria-label="`Allowed value label ${index + 1}`"
                @input="onAllowedValueRowInput(index, 'label', $event)"
              />
              <input
                class="allowed-value-dialog__input ui-sidepanel-field-input"
                :value="row.iri || null"
                placeholder="https://example.org/value"
                :disabled="readOnly"
                :aria-label="`Allowed value IRI ${index + 1}`"
                @input="onAllowedValueRowInput(index, 'iri', $event)"
              />
              <button
                v-if="row.label || row.iri"
                type="button"
                class="allowed-value-dialog__remove"
                :disabled="readOnly"
                title="Remove value"
                @click="removeAllowedValueRow(index)"
              >
                <i class="pi pi-times" />
              </button>
            </div>
          </div>
          <div class="metadata-dialog__footer">
            <button type="button" class="metadata-dialog__secondary" @click="closeAllowedValuesDialog">Cancel</button>
            <button type="button" class="metadata-dialog__primary" :disabled="readOnly" @click="saveAllowedValuesDialog">Save</button>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="inspector-empty-state">
      <div class="inspector-empty-card">
        <span class="meta-label">Inspector</span>
        <h3 class="panel-title">Select a shape or property</h3>
        <p class="helper-text">The selected shape or property appears here with profile metadata and SHACL constraints.</p>
      </div>
    </div>
    <TerminologySearchDialog
      v-if="terminologySearchOpen && property && !readOnly && !reviewMode"
      :field-name="property.name ?? ''"
      @select="useTerminologyTerm"
      @close="terminologySearchOpen = false"
    />
  </aside>
</template>

<style scoped lang="scss">
@use './inspectorValueDialogs';

.term-search-button {
  flex: 0 0 42px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
}

.term-search-button:hover:not(:disabled) {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.term-search-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.inspector-lock-notice {
  margin: 12px 0 0;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

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

.toggle-field__button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.delete-icon:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.inspector-fieldset {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
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

.alternative-targets {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alternative-targets.is-invalid {
  padding: 10px;
  border: 1px solid #d84c4c;
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 1px rgba(216, 76, 76, 0.14);
}

.alternative-targets__helper {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.alternative-targets__helper.is-invalid {
  color: #b42323;
}

.alternative-target-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: end;
}

.datatype-alternative-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.alternative-target-remove,
.alternative-target-add {
  min-height: 42px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
}

.alternative-target-remove {
  width: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.alternative-target-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
  align-self: start;
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
