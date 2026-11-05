import { graph, parse } from 'rdflib'
import type { ShaclProfile } from '@/domain/profiles'
import { serializeProfilesAsTurtle } from '@/infrastructure/shacl/shaclProfileSerializer'
import { OWL_IMPORTS, SH_HAS_VALUE, SH_PROPERTY } from '@/shared/rdf/rdfConstants'

/** The form already receives these profiles, so it must not fetch them again. */
export function serializeProfilesForPreview(profiles: readonly ShaclProfile[]): string {
  const store = graph()
  parse(serializeProfilesAsTurtle(profiles), store, 'https://shacl-editor.invalid/preview/', 'text/turtle')
  // shacl-form 3.8 has one hasValue slot per property template. Equivalent
  // property shapes let it render every required value without losing any.
  const fixedProperties = new Map(store.match(null, SH_HAS_VALUE, null, null)
    .map(statement => [`${statement.subject.termType}:${statement.subject.value}`, statement.subject]))
  for (const property of fixedProperties.values()) {
    const values = store.match(property, SH_HAS_VALUE, null, null)
    const owners = store.match(null, SH_PROPERTY, property, null)
    if (values.length < 2 || !owners.length) continue
    const constraints = store.match(property, null, null, null)
      .filter(statement => !statement.predicate.equals(SH_HAS_VALUE))
    for (const value of values.slice(1)) {
      store.removeStatement(value)
      const copy = store.bnode()
      for (const constraint of constraints) store.add(copy, constraint.predicate, constraint.object)
      store.add(copy, SH_HAS_VALUE, value.object)
      for (const owner of owners) store.add(owner.subject, SH_PROPERTY, copy)
    }
  }
  const includedProfiles = new Set(profiles.filter(profile => profile.nodeShapes.length > 0).map(profile => profile.iri))
  return store.statements
    .filter(statement => !(statement.predicate.equals(OWL_IMPORTS)
      && statement.object.termType === 'NamedNode' && includedProfiles.has(statement.object.value)))
    .map(statement => statement.toNT())
    .join('\n')
}
