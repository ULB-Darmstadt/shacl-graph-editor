import { graph, parse } from 'rdflib'
import type { ShaclProfile } from '@/domain/profiles'
import { serializeProfilesAsTurtle } from '@/infrastructure/shacl/shaclProfileSerializer'
import { OWL_IMPORTS } from '@/shared/rdf/rdfConstants'

/** The form already receives these profiles, so it must not fetch them again. */
export function serializeProfilesForPreview(profiles: readonly ShaclProfile[]): string {
  const store = graph()
  parse(serializeProfilesAsTurtle(profiles), store, 'https://shacl-editor.invalid/preview/', 'text/turtle')
  const includedProfiles = new Set(profiles.filter(profile => profile.nodeShapes.length > 0).map(profile => profile.iri))
  return store.statements
    .filter(statement => !(statement.predicate.equals(OWL_IMPORTS)
      && statement.object.termType === 'NamedNode' && includedProfiles.has(statement.object.value)))
    .map(statement => statement.toNT())
    .join('\n')
}
