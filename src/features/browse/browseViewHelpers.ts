import type { BrowsePropertyValue, BrowseSubject } from '@/services/browse/browseService'

export interface BrowseColumn {
  /** Predicate IRI, used as the row-cell key. */
  predicate: string
  /** Human label, usually from sh:name with an IRI fallback. */
  label: string
}

const XSD_ANY_URI = 'http://www.w3.org/2001/XMLSchema#anyURI'
const SCHEMA_IMAGE_IRI = 'http://schema.org/image'

export function localName(iri: string): string {
  const idx = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'))
  return idx >= 0 ? iri.slice(idx + 1) : iri
}

export function subjectMatchesSearch(subject: BrowseSubject, term: string): boolean {
  if (subject.label.toLowerCase().includes(term)) return true
  if (subject.iri.toLowerCase().includes(term)) return true
  for (const property of subject.properties) {
    if (property.value.toLowerCase().includes(term)) return true
    if (property.label.toLowerCase().includes(term)) return true
    if (property.resolvedLabel && property.resolvedLabel.toLowerCase().includes(term)) return true
  }
  return false
}

export function displayBrowseValue(property: BrowsePropertyValue): string {
  if (property.isResource) return property.resolvedLabel ?? (localName(property.value) || property.value)
  return property.value
}

export function thumbnailUrlForSubject(subject: BrowseSubject): string | undefined {
  return subject.properties.find(isThumbnailProperty)?.value
}

export function columnsForSubjects(subjects: BrowseSubject[]): BrowseColumn[] {
  const seen = new Map<string, string>()
  for (const subject of subjects) {
    for (const property of subject.properties) {
      if (isThumbnailProperty(property)) continue
      if (!seen.has(property.predicate)) seen.set(property.predicate, property.label)
    }
  }
  return Array.from(seen.entries())
    .map(([predicate, label]) => ({ predicate, label }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

export function valuesForColumn(subject: BrowseSubject, predicate: string): BrowsePropertyValue[] {
  return subject.properties.filter(property => property.predicate === predicate)
}

export function classLabelsForSubject(
  subject: BrowseSubject,
  labelsByIri: ReadonlyMap<string, string>,
): string[] {
  if (subject.classes.length === 0) return ['Untyped']
  return subject.classes.map(cls => labelsByIri.get(cls) ?? localName(cls))
}

function isThumbnailProperty(property: BrowsePropertyValue): boolean {
  if (property.predicate !== SCHEMA_IMAGE_IRI) return false
  if (property.isResource) return false
  if (!isHttpUrl(property.value)) return false
  return property.datatype === XSD_ANY_URI
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}


