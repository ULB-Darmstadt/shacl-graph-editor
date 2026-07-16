const SUBJECT_HEADINGS_URL = '/dfgfo.ttl'

export interface SelectOption {
  label: string
  value: string
}

export interface SubjectHeadingNode {
  value: string
  label: string
  parent?: string
  children: SubjectHeadingNode[]
}

export const PROFILE_LICENSE_OPTIONS: SelectOption[] = [
  { label: 'CC-BY', value: 'http://creativecommons.org/licenses/by/4.0/' },
  { label: 'CC-BY-NC', value: 'http://creativecommons.org/licenses/by-nc/4.0/' },
]

export const PROPERTY_TYPE_OPTIONS: SelectOption[] = [
  { label: 'Datatype', value: 'datatype' },
  { label: 'Node Kind', value: 'nodeKind' },
  { label: 'Satisfies Profile', value: 'profile' },
  { label: 'List', value: 'list' },
]

export const SHACL_DATATYPE_OPTIONS: SelectOption[] = [
  { label: 'xsd:string', value: 'http://www.w3.org/2001/XMLSchema#string' },
  { label: 'rdf:langString', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString' },
  { label: 'xsd:boolean', value: 'http://www.w3.org/2001/XMLSchema#boolean' },
  { label: 'xsd:date', value: 'http://www.w3.org/2001/XMLSchema#date' },
  { label: 'xsd:dateTime', value: 'http://www.w3.org/2001/XMLSchema#dateTime' },
  { label: 'xsd:decimal', value: 'http://www.w3.org/2001/XMLSchema#decimal' },
  { label: 'xsd:integer', value: 'http://www.w3.org/2001/XMLSchema#integer' },
  { label: 'xsd:anyURI', value: 'http://www.w3.org/2001/XMLSchema#anyURI' },
]

export const SHACL_NODE_KIND_OPTIONS: SelectOption[] = [
  { label: 'IRI', value: 'http://www.w3.org/ns/shacl#IRI' },
  { label: 'Literal', value: 'http://www.w3.org/ns/shacl#Literal' },
  { label: 'BlankNode', value: 'http://www.w3.org/ns/shacl#BlankNode' },
  { label: 'BlankNodeOrIRI', value: 'http://www.w3.org/ns/shacl#BlankNodeOrIRI' },
  { label: 'BlankNodeOrLiteral', value: 'http://www.w3.org/ns/shacl#BlankNodeOrLiteral' },
  { label: 'IRIOrLiteral', value: 'http://www.w3.org/ns/shacl#IRIOrLiteral' },
]

export const PROPERTY_TERM_OPTIONS: SelectOption[] = [
  'https://schema.org/name',
  'https://schema.org/identifier',
  'https://schema.org/description',
  'https://schema.org/url',
  'https://schema.org/email',
  'https://schema.org/telephone',
  'https://schema.org/address',
  'https://schema.org/creator',
  'https://schema.org/author',
  'https://schema.org/contributor',
  'https://schema.org/dateCreated',
  'https://schema.org/dateModified',
  'https://schema.org/license',
  'https://schema.org/keywords',
  'https://schema.org/about',
  'https://schema.org/sameAs',
  'https://schema.org/member',
  'https://schema.org/affiliation',
  'https://schema.org/funder',
  'https://schema.org/funding',
].map(value => ({
  value,
  label: value.replace('https://schema.org/', 'schema:'),
}))

let subjectHeadingTreePromise: Promise<SubjectHeadingNode[]> | null = null

export function fetchSubjectHeadingOptions(): Promise<SelectOption[]> {
  return fetchSubjectHeadingTree().then(tree => flattenSubjectHeadingTree(tree))
}

export function fetchSubjectHeadingTree(): Promise<SubjectHeadingNode[]> {
  if (!subjectHeadingTreePromise) {
    subjectHeadingTreePromise = loadSubjectHeadingTree().catch(error => {
      subjectHeadingTreePromise = null
      throw error
    })
  }
  return subjectHeadingTreePromise
}

async function loadSubjectHeadingTree(): Promise<SubjectHeadingNode[]> {
  const response = await fetch(SUBJECT_HEADINGS_URL)
  if (!response.ok) throw new Error(`Failed to load subject headings: ${response.status}`)

  const turtle = await response.text()
  const subjects = extractSubjectHierarchy(turtle)

  const childIdsByParent = new Map<string | undefined, string[]>()
  for (const [iri, subject] of subjects.entries()) {
    const children = childIdsByParent.get(subject.parent) ?? []
    children.push(iri)
    childIdsByParent.set(subject.parent, children)
  }

  for (const children of childIdsByParent.values()) {
    children.sort((left, right) => (subjects.get(left)?.label ?? '').localeCompare(subjects.get(right)?.label ?? ''))
  }

  const rootSubjects = [...subjects.entries()]
    .filter(([, subject]) => !subject.parent || !subjects.has(subject.parent))
    .map(([iri]) => iri)
    .sort((left, right) => (subjects.get(left)?.label ?? '').localeCompare(subjects.get(right)?.label ?? ''))

  return rootSubjects
    .map(root => buildSubjectHeadingNode(root, subjects, childIdsByParent))
    .filter((node): node is SubjectHeadingNode => node !== null)
}

function extractSubjectHierarchy(turtle: string): Map<string, { label: string; parent?: string }> {
  const subjects = new Map<string, { label: string; parent?: string }>()
  const lines = turtle.split(/\r?\n/)
  let currentIri: string | null = null
  let currentParent: string | undefined
  let currentEnglish: string | undefined
  let currentGerman: string | undefined

  function flushCurrent(): void {
    if (!currentIri) return
    const label = currentEnglish ?? currentGerman
    if (label) {
      subjects.set(currentIri, {
        label,
        parent: currentParent,
      })
    }
    currentIri = null
    currentParent = undefined
    currentEnglish = undefined
    currentGerman = undefined
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const classStart = line.match(/^dfgfo:([0-9-]+)\s+a\s+owl:Class\s*;/)
    if (classStart) {
      flushCurrent()
      currentIri = classStart[1]
      continue
    }

    if (!currentIri) continue

    const parentMatch = line.match(/^rdfs:subClassOf\s+dfgfo:([0-9-]+)\s*;/)
    if (parentMatch) {
      currentParent = parentMatch[1]
    }

    const labelMatch = line.match(/"([^"]+)"@(en|de)/)
    if (labelMatch) {
      if (labelMatch[2] === 'en') currentEnglish = labelMatch[1]
      if (labelMatch[2] === 'de') currentGerman = labelMatch[1]
    }

    if (line.endsWith('.')) {
      flushCurrent()
    }
  }

  flushCurrent()
  return subjects
}

function buildSubjectHeadingNode(
  iri: string,
  subjects: Map<string, { label: string; parent?: string }>,
  childIdsByParent: Map<string | undefined, string[]>,
): SubjectHeadingNode | null {
  const subject = subjects.get(iri)
  if (!subject) return null

  return {
    value: iri,
    label: subject.label,
    parent: subject.parent,
    children: (childIdsByParent.get(iri) ?? [])
      .map(childIri => buildSubjectHeadingNode(childIri, subjects, childIdsByParent))
      .filter((child): child is SubjectHeadingNode => child !== null),
  }
}

function flattenSubjectHeadingTree(tree: SubjectHeadingNode[]): SelectOption[] {
  const options: SelectOption[] = []

  function visit(node: SubjectHeadingNode, depth: number): void {
    options.push({
      value: node.value,
      label: `${'  '.repeat(depth)}${node.value} ${node.label}`,
    })
    for (const child of node.children) visit(child, depth + 1)
  }

  for (const root of tree) visit(root, 0)
  return options
}
