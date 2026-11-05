export interface TerminologyTerm {
  iri: string
  label: string
  description: string
  ontology: string
}

const propertyTypes = new Set([
  'property', 'objectProperty', 'dataProperty', 'datatypeProperty', 'annotationProperty',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property',
  'http://www.w3.org/2002/07/owl#ObjectProperty',
  'http://www.w3.org/2002/07/owl#DatatypeProperty',
  'http://www.w3.org/2002/07/owl#AnnotationProperty',
])

export function isTerminologyProperty(type: unknown): boolean {
  return typeof type === 'string' && propertyTypes.has(type)
}

export function terminologyTerm(value: unknown): TerminologyTerm | null {
  if (!value || typeof value !== 'object') return null
  const term = value as Record<string, unknown>
  if (!isTerminologyProperty(term.type) || typeof term.iri !== 'string') return null
  const iri = term.iri.trim()
  if (!/^[a-z][a-z0-9+.-]*:[^\s<>"{}|^`\\]+$/i.test(iri)) return null
  return {
    iri,
    label: typeof term.label === 'string' ? term.label : iri,
    description: Array.isArray(term.description)
      ? term.description.filter((text): text is string => typeof text === 'string').join(' ')
      : typeof term.description === 'string' ? term.description : '',
    ontology: typeof term.ontology_name === 'string' ? term.ontology_name : '',
  }
}
