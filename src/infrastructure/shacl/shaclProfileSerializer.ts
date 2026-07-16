import type { ApplicationProfile, NodeShape, PropertyShape, ShaclProfile } from '@/domain/profiles'
import { PREFIX_APS } from '@/shared/rdf/rdfConstants'

const PREFIXES = [
  '@prefix sh: <http://www.w3.org/ns/shacl#> .',
  '@prefix dcterms: <http://purl.org/dc/terms/> .',
  '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
  '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
  '@prefix aps: <https://w3id.org/nfdi4ing/profiles/> .',
  '@prefix dash: <http://datashapes.org/dash#> .',
]

export function serializeProfilesAsTurtle(profiles: readonly ShaclProfile[]): string {
  return profiles
    .map(profile => serializeProfileAsTurtle(profile, profiles).trim())
    .filter(Boolean)
    .join('\n\n')
}

export function serializeApplicationProfileAsTurtle(applicationProfile: ApplicationProfile): string {
  return serializeProfilesAsTurtle(applicationProfile.list())
}

export function buildProfilesExportFilename(baseName = 'shacl-profile-set'): string {
  const safeBaseName = baseName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${safeBaseName || 'shacl-profile-set'}.ttl`
}

export function downloadProfilesAsTurtle(profiles: readonly ShaclProfile[], baseName?: string): string {
  const filename = buildProfilesExportFilename(baseName)
  const turtle = serializeProfilesAsTurtle(profiles)
  const blob = new Blob([turtle], { type: 'text/turtle' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
  return filename
}

export function serializeProfileAsTurtle(profile: ShaclProfile, allProfiles: readonly ShaclProfile[]): string {
  const shapeToProfile = buildShapeToProfileMap(allProfiles)
  const imports = determineProfileImports(profile, shapeToProfile)
  const blocks: string[] = []

  blocks.push([
    ...PREFIXES,
    '',
    serializeProfileHeader(profile, imports),
  ].join('\n'))

  for (const shape of profile.nodeShapes) {
    blocks.push(serializeNodeShape(shape))
    for (const property of shape.properties.filter(property => !property.inherited)) {
      blocks.push(serializePropertyShape(property))
    }
  }

  return blocks.filter(Boolean).join('\n\n')
}

function serializeProfileHeader(profile: ShaclProfile, imports: string[]): string {
  const statements = ['a owl:Ontology']
  for (const importIri of imports) {
    statements.push(`owl:imports ${term(importIri)}`)
  }
  return serializeSubject(profile.iri, statements)
}

function serializeNodeShape(shape: NodeShape): string {
  const statements = ['a sh:NodeShape']
  pushLiteralStatement(statements, 'dcterms:title', shape.label)
  pushLiteralStatement(statements, 'dcterms:description', shape.description)
  pushLiteralStatement(statements, 'dcterms:creator', shape.creator)
  pushLiteralStatement(statements, 'dcterms:created', shape.created, 'xsd:date')
  pushLiteralStatement(statements, 'dcterms:license', shape.license)
  pushLiteralStatement(statements, 'dcterms:subject', shape.subject)
  if (shape.closed !== undefined) statements.push(`sh:closed ${shape.closed ? 'true' : 'false'}`)
  if (shape.targetClass?.value) statements.push(`sh:targetClass ${term(shape.targetClass.value)}`)
  for (const inheritedIri of shape.inheritedShapeIris ?? []) {
    statements.push(`sh:node ${term(inheritedIri)}`)
  }
  for (const property of shape.properties.filter(property => !property.inherited)) {
    statements.push(`sh:property ${term(property.nodeId.value)}`)
  }
  return serializeSubject(shape.nodeId.value, statements)
}

function serializePropertyShape(property: PropertyShape): string {
  const statements = ['a sh:PropertyShape']
  if (property.path?.value) statements.push(`sh:path ${term(property.path.value)}`)
  pushLiteralStatement(statements, 'sh:name', property.name)
  pushLiteralStatement(statements, 'sh:description', property.description)
  pushNamedNodeStatement(statements, 'sh:datatype', property.datatype?.value)
  pushNamedNodeStatement(statements, 'sh:node', property.node?.value)
  pushNamedNodeStatement(statements, 'sh:nodeKind', property.nodeKind?.value)
  pushNamedNodeStatement(statements, 'sh:class', property.cls?.value)
  pushStringListStatement(statements, 'sh:in', property.allowedValues)
  pushNumericStatement(statements, 'sh:minCount', property.minCount)
  pushNumericStatement(statements, 'sh:maxCount', property.maxCount)
  pushLiteralStatement(statements, 'sh:pattern', property.pattern)
  pushNumericStatement(statements, 'sh:order', property.order)
  pushLiteralStatement(statements, 'sh:message', property.message)
  pushLiteralStatement(statements, 'dash:defaultValue', property.defaultValue)
  pushNamedNodeStatement(statements, 'sh:severity', property.severity?.value)
  pushNamedNodeStatement(statements, 'sh:equals', property.equals?.value)
  pushNamedNodeStatement(statements, 'sh:disjoint', property.disjoint?.value)
  pushNamedNodeStatement(statements, 'sh:lessThan', property.lessThan?.value)
  pushNamedNodeStatement(statements, 'sh:lessThanOrEquals', property.lessThanOrEquals?.value)
  pushLiteralStatement(statements, 'sh:minInclusive', property.minInclusive)
  pushLiteralStatement(statements, 'sh:minExclusive', property.minExclusive)
  pushLiteralStatement(statements, 'sh:maxInclusive', property.maxInclusive)
  pushLiteralStatement(statements, 'sh:maxExclusive', property.maxExclusive)
  return serializeSubject(property.nodeId.value, statements)
}

function determineProfileImports(profile: ShaclProfile, shapeToProfile: Map<string, string>): string[] {
  const imports = new Set(profile.imports)

  for (const shape of profile.nodeShapes) {
    for (const inheritedIri of shape.inheritedShapeIris ?? []) {
      const owner = shapeToProfile.get(inheritedIri)
      if (owner && owner !== profile.iri) imports.add(owner)
    }

    for (const property of shape.properties.filter(property => !property.inherited)) {
      const owner = property.node?.value ? shapeToProfile.get(property.node.value) : undefined
      if (owner && owner !== profile.iri) imports.add(owner)
    }
  }

  return [...imports].sort()
}

function buildShapeToProfileMap(profiles: readonly ShaclProfile[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const profile of profiles) {
    for (const shape of profile.nodeShapes) {
      map.set(shape.nodeId.value, profile.iri)
    }
  }
  return map
}

function serializeSubject(subjectIri: string, statements: string[]): string {
  if (statements.length === 0) return `${term(subjectIri)} .`
  if (statements.length === 1) return `${term(subjectIri)} ${statements[0]} .`
  return `${term(subjectIri)} ${statements[0]} ;\n  ${statements.slice(1).join(' ;\n  ')} .`
}

function pushLiteralStatement(statements: string[], predicate: string, value: string | undefined, datatype?: string): void {
  if (!value?.trim()) return
  const escaped = escapeLiteral(value.trim())
  statements.push(datatype ? `${predicate} "${escaped}"^^${datatype}` : `${predicate} "${escaped}"`)
}

function pushNamedNodeStatement(statements: string[], predicate: string, iri: string | undefined): void {
  if (!iri?.trim()) return
  statements.push(`${predicate} ${term(iri)}`)
}

function pushNumericStatement(statements: string[], predicate: string, value: number | undefined): void {
  if (value === undefined || Number.isNaN(value)) return
  statements.push(`${predicate} ${value}`)
}

function pushStringListStatement(statements: string[], predicate: string, values: string[] | undefined): void {
  if (!values?.length) return
  const serialized = values
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => isLikelyIri(value) ? term(value) : `"${escapeLiteral(value)}"`)
  if (serialized.length === 0) return
  statements.push(`${predicate} ( ${serialized.join(' ')} )`)
}

function term(iri: string): string {
  if (isBlankNodeIdentifier(iri)) return blankNodeLabel(iri)
  if (iri.startsWith(PREFIX_APS)) return `aps:${iri.slice(PREFIX_APS.length)}`
  return `<${iri}>`
}

function escapeLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
}

function isLikelyIri(value: string): boolean {
  return /^https?:\/\//.test(value)
}

function isBlankNodeIdentifier(value: string): boolean {
  return value.startsWith('_:') || value.startsWith('_g_')
}

function blankNodeLabel(value: string): string {
  return value.startsWith('_:') ? value : `_:${value}`
}
