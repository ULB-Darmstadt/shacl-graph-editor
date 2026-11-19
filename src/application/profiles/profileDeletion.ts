import type { PropertyShape, ShaclProfile } from '@/domain/profiles'
import type { PropertyConstraint, PropertyConstraintCarrier } from '@/shared/rdf/propertyConstraints'
import { NamedNode } from 'rdflib'

export interface ProfileDeletionPlan {
  requested: string[]
  shapeIris: string[]
  profileIris: string[]
  deleted: Array<{ iri: string; label: string }>
  skipped: Array<{ iri: string; label: string; reason: string }>
  connections: number
}
function referenceTargets(property: PropertyShape): string[] {
  return [property.node?.value, property.qualifiedValueShape?.node?.value, property.negatedConstraint?.node?.value,
    ...[...property.alternatives ?? [], ...property.conjunctions ?? [], ...property.exclusiveAlternatives ?? []].map(constraint => constraint.node?.value)].filter((value): value is string => !!value)
}
export function planProfileDeletion(profiles: readonly ShaclProfile[], selected: string[], lockImports: boolean, includeParents = false): ProfileDeletionPlan {
  const shapes = new Map(profiles.flatMap(profile => profile.nodeShapes.map(shape => [shape.nodeId.value, { shape, profile }] as const)))
  const requested = [...new Set(selected)]
  const queue = [...requested]
  const targets = new Set<string>()
  for (let index = 0; index < queue.length; index++) {
    const iri = queue[index]
    if (targets.has(iri)) continue
    const entry = shapes.get(iri)
    if (!entry) continue
    targets.add(iri)
    // A primary card represents the complete profile, including inline shapes.
    if (entry.profile.iri === iri || entry.profile.nodeShapes[0]?.nodeId.value === iri) queue.push(...entry.profile.nodeShapes.map(shape => shape.nodeId.value))
    if (includeParents) queue.push(...entry.shape.inheritedShapeIris ?? [])
  }
  const skipped: ProfileDeletionPlan['skipped'] = []
  let changed = true
  while (changed) {
    changed = false
    for (const iri of targets) {
      const entry = shapes.get(iri)!
      const lockedSource = profiles.find(profile => lockImports && profile.origin === 'fetched' && profile.nodeShapes.some(shape => !targets.has(shape.nodeId.value) && (profile.imports.includes(iri) || profile.imports.includes(entry.profile.iri) || (shape.inheritedShapeIris ?? []).includes(iri) || shape.properties.some(property => referenceTargets(property).includes(iri)))))
      const reason = lockImports && entry.profile.origin === 'fetched' ? 'Imported profile is locked.' : lockedSource ? `Referenced by locked profile ${lockedSource.nodeShapes[0]?.label || lockedSource.iri}.` : null
      if (!reason) continue
      // Keep the complete document when one of its shapes cannot be removed.
      const family = entry.profile.nodeShapes.filter(shape => targets.has(shape.nodeId.value))
      for (const shape of family) {
        targets.delete(shape.nodeId.value)
        skipped.push({ iri: shape.nodeId.value, label: shape.label || 'Unnamed profile', reason })
      }
      changed = true
    }
  }
  const profileIris = profiles.filter(profile => profile.nodeShapes.length && profile.nodeShapes.every(shape => targets.has(shape.nodeId.value))).map(profile => profile.iri)
  let connections = 0
  for (const profile of profiles) for (const shape of profile.nodeShapes) {
    connections += (shape.inheritedShapeIris ?? []).filter(iri => targets.has(iri) || targets.has(shape.nodeId.value)).length
    for (const property of shape.properties) connections += referenceTargets(property).filter(iri => targets.has(iri) || targets.has(shape.nodeId.value)).length
  }
  return { requested, shapeIris: [...targets], profileIris, deleted: [...targets].map(iri => ({ iri, label: shapes.get(iri)!.shape.label || 'Unnamed profile' })), skipped, connections }
}

export function detachDeletedProfileReferences(profiles: readonly ShaclProfile[], plan: ProfileDeletionPlan): void {
  const deleted = new Set(plan.shapeIris)
  const deletedProfiles = new Set(plan.profileIris)
  const constraint = (value: PropertyConstraint | undefined): PropertyConstraint | undefined => value?.node && deleted.has(value.node.value) ? undefined : value
  for (const profile of profiles) {
    profile.imports = profile.imports.filter(iri => !deletedProfiles.has(iri) && !deleted.has(iri))
    profile.nodeShapes = profile.nodeShapes.filter(shape => !deleted.has(shape.nodeId.value))
    for (const shape of profile.nodeShapes) {
      shape.inheritedShapeIris = shape.inheritedShapeIris?.filter(iri => !deleted.has(iri))
      for (const property of shape.properties) {
        const hadReference = referenceTargets(property).some(iri => deleted.has(iri))
        if (property.node && deleted.has(property.node.value)) property.node = undefined
        if (property.qualifiedValueShape?.node && deleted.has(property.qualifiedValueShape.node.value)) {
          property.qualifiedValueShape = undefined
          property.qualifiedMinCount = undefined
          property.qualifiedMaxCount = undefined
        }
        property.negatedConstraint = constraint(property.negatedConstraint)
        for (const key of ['alternatives', 'conjunctions', 'exclusiveAlternatives'] as const) {
          const values = property[key]?.map(constraint).filter((value): value is PropertyConstraint => !!value)
          property[key] = values?.length ? values : undefined
        }
        if (hadReference && !referenceTargets(property).length && !hasValueConstraint(property)) {
          property.editorType = 'nodeKind'
          property.nodeKind = new NamedNode('http://www.w3.org/ns/shacl#IRI')
        }
      }
    }
  }
}
function hasValueConstraint(property: PropertyConstraintCarrier): boolean {
  return !!(property.datatype || property.cls || property.allowedValues?.length || property.hasValues?.length || property.alternatives?.length || property.exclusiveAlternatives?.length)
}
