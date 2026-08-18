import {
  inferPropertyEditorType,
  propertyNodeTargets,
  type NodeShape,
  type PropertyShape,
} from '@/domain/profiles'
import { PREFIX_APS } from '@/shared/rdf/rdfConstants'

export type EditorReviewSeverity = 'urgent' | 'warning'
export type EditorReviewSubject = 'profile' | 'property'

export interface EditorReviewItem {
  id: string
  severity: EditorReviewSeverity
  subject: EditorReviewSubject
  shapeIri: string
  propertyNodeId?: string
  field: string
  title: string
  message: string
  profileLabel: string
  propertyLabel?: string
  sortKey: string
}

export function buildEditorReviewItems(shapes: NodeShape[]): EditorReviewItem[] {
  const items: EditorReviewItem[] = []

  shapes.forEach((shape, shapeIndex) => {
    if (!isReviewableProfileShape(shape)) return

    const shapeLabel = shape.label?.trim() || 'Unnamed profile'
    const shapeSortPrefix = `${String(shapeIndex).padStart(5, '0')}:${shapeLabel.toLowerCase()}`

    addProfileIssue(items, shape, shapeSortPrefix, 'urgent', 'label', !shape.label?.trim(), 'Profile has no name', 'Add a profile name.', shapeLabel)
    addProfileIssue(items, shape, shapeSortPrefix, 'urgent', 'creator', !shape.creator?.trim(), 'Profile has no creator', 'Add a creator.', shapeLabel)
    addProfileIssue(items, shape, shapeSortPrefix, 'urgent', 'created', !shape.created?.trim(), 'Profile has no creation date', 'Add a creation date.', shapeLabel)
    addProfileIssue(items, shape, shapeSortPrefix, 'urgent', 'license', !shape.license?.trim(), 'Profile has no license', 'Choose a license.', shapeLabel)
    addProfileIssue(items, shape, shapeSortPrefix, 'warning', 'description', !shape.description?.trim(), 'Profile has no description', 'Add a profile description.', shapeLabel)

    shape.properties.forEach((property, propertyIndex) => {
      if (property.inherited) return
      const propertyLabel = property.name?.trim() || property.path?.value || 'Unnamed field'
      const propertySortPrefix = `${shapeSortPrefix}:property:${String(property.order ?? propertyIndex).padStart(5, '0')}:${propertyLabel.toLowerCase()}`
      const propertyType = (property.editorType ?? inferPropertyEditorType(property))
      const nodeTargetCount = propertyNodeTargets(property).length
      const alternativeTargetCount = property.alternatives
        ?.map(alternative => alternative.node?.value)
        .filter(Boolean)
        .length ?? 0
      const missingQualifiedCounts = propertyType === 'qualifiedProfile'
        && property.qualifiedMinCount === undefined
        && property.qualifiedMaxCount === undefined

      addPropertyIssue(items, shape, property, propertySortPrefix, 'urgent', 'path', !property.path?.value?.trim(), 'Property has no IRI', 'Add a Term IRI.', shapeLabel, propertyLabel)
      addPropertyIssue(items, shape, property, propertySortPrefix, 'urgent', 'name', !property.name?.trim(), 'Property has no name', 'Add a field name.', shapeLabel, propertyLabel)
      addPropertyIssue(items, shape, property, propertySortPrefix, 'urgent', 'order', property.order === undefined, 'Property has no form position', 'Add a Position On Metadata Form value.', shapeLabel, propertyLabel)
      addPropertyIssue(items, shape, property, propertySortPrefix, 'urgent', 'alternativeTargets', propertyType === 'oneOfProfiles' && alternativeTargetCount <= 1, 'sh:or property needs more targets', 'Add at least two profile targets.', shapeLabel, propertyLabel)
      addPropertyIssue(items, shape, property, propertySortPrefix, 'urgent', 'nodeTarget', (propertyType === 'profile' || propertyType === 'qualifiedProfile') && nodeTargetCount === 0, 'Profile connection has no target', 'Select a node target.', shapeLabel, propertyLabel)
      addPropertyIssue(items, shape, property, propertySortPrefix, 'warning', 'qualifiedCount', missingQualifiedCounts, 'Qualified profile has no count', 'Add a qualified min or max count.', shapeLabel, propertyLabel)
      addPropertyIssue(items, shape, property, propertySortPrefix, 'urgent', 'allowedValues', propertyType === 'list' && (!property.allowedValues || property.allowedValues.length === 0), 'sh:in property has no values', 'Add values to choose from.', shapeLabel, propertyLabel)
      addPropertyIssue(items, shape, property, propertySortPrefix, 'warning', 'description', !property.description?.trim(), 'Property has no description', 'Add a property description.', shapeLabel, propertyLabel)
    })
  })

  return items.sort((left, right) => left.sortKey.localeCompare(right.sortKey))
}

function isReviewableProfileShape(shape: NodeShape): boolean {
  return shape.nodeId.termType === 'NamedNode' && shape.nodeId.value.startsWith(PREFIX_APS)
}

function addProfileIssue(
  items: EditorReviewItem[],
  shape: NodeShape,
  shapeSortPrefix: string,
  severity: EditorReviewSeverity,
  field: string,
  condition: boolean,
  title: string,
  message: string,
  profileLabel: string,
): void {
  if (!condition) return
  items.push({
    id: `profile:${shape.nodeId.value}:${field}`,
    severity,
    subject: 'profile',
    shapeIri: shape.nodeId.value,
    field,
    title,
    message,
    profileLabel,
    sortKey: `${shapeSortPrefix}:0-profile:${severity}:${field}`,
  })
}

function addPropertyIssue(
  items: EditorReviewItem[],
  shape: NodeShape,
  property: PropertyShape,
  propertySortPrefix: string,
  severity: EditorReviewSeverity,
  field: string,
  condition: boolean,
  title: string,
  message: string,
  profileLabel: string,
  propertyLabel: string,
): void {
  if (!condition) return
  items.push({
    id: `property:${shape.nodeId.value}:${property.nodeId.value}:${field}`,
    severity,
    subject: 'property',
    shapeIri: shape.nodeId.value,
    propertyNodeId: property.nodeId.value,
    field,
    title,
    message,
    profileLabel,
    propertyLabel,
    sortKey: `${propertySortPrefix}:${severity}:${field}`,
  })
}
