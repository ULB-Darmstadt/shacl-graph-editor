import { licenses as AIMS_LICENSES, subjects as AIMS_SUBJECTS } from '@/application/profiles/aimsShaclTypes'

export interface SelectOption {
  label: string
  value: string
  disabled?: boolean
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

const IMPORTED_LICENSE_LABELS = new Map(
  AIMS_LICENSES.map(license => [license.value, license.text] as const),
)

const IMPORTED_SUBJECT_LABELS = new Map(
  AIMS_SUBJECTS.map(subject => [subject.value, subject.text] as const),
)

const SUBJECT_HEADING_TREE: SubjectHeadingNode[] = AIMS_SUBJECTS.map(subject => ({
  value: subject.value,
  label: subject.text,
  children: [],
}))

const SUBJECT_HEADING_OPTIONS: SelectOption[] = SUBJECT_HEADING_TREE.map(subject => ({
  value: subject.value,
  label: subject.label,
}))

export function resolveImportedLicenseLabel(licenseValue: string): string | null {
  return IMPORTED_LICENSE_LABELS.get(licenseValue) ?? null
}

export function resolveImportedSubjectLabel(subjectValue: string): string | null {
  return IMPORTED_SUBJECT_LABELS.get(subjectValue) ?? null
}

export function buildProfileLicenseOptions(currentLicense: string | null | undefined): SelectOption[] {
  if (!currentLicense?.trim()) return PROFILE_LICENSE_OPTIONS
  if (PROFILE_LICENSE_OPTIONS.some(option => option.value === currentLicense)) return PROFILE_LICENSE_OPTIONS

  return [
    {
      value: currentLicense,
      label: resolveImportedLicenseLabel(currentLicense) ?? currentLicense,
    },
    ...PROFILE_LICENSE_OPTIONS,
  ]
}

export const PROPERTY_TYPE_OPTIONS: SelectOption[] = [
  { label: 'Datatype (sh:datatype)', value: 'datatype' },
  { label: 'Node Kind (sh:nodeKind)', value: 'nodeKind' },
  { label: 'Class (sh:class)', value: 'class', disabled: true },
  { label: 'Satisfies Profile (sh:node)', value: 'profile' },
  { label: 'Satisfies Profile (m-n times) (sh:qualifiedValueShape)', value: 'qualifiedProfile' },
  { label: 'Satisfies One Of Profiles (sh:or)', value: 'oneOfProfiles' },
  { label: 'List (sh:in)', value: 'list' },
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

export function fetchSubjectHeadingOptions(): Promise<SelectOption[]> {
  return Promise.resolve(SUBJECT_HEADING_OPTIONS)
}

export function fetchSubjectHeadingTree(): Promise<SubjectHeadingNode[]> {
  return Promise.resolve(SUBJECT_HEADING_TREE)
}
