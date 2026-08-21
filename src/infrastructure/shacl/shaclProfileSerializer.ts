import type { ApplicationProfile, NodeShape, PropertyShape, RdfLiteralValue, ShaclProfile } from '@/domain/profiles'
import { PREFIX_APS } from '@/shared/rdf/rdfConstants'

const PREFIXES = [
  '@prefix dash: <http://datashapes.org/dash#> .',
  '@prefix dcat: <http://www.w3.org/ns/dcat#> .',
  '@prefix dcmitype: <http://purl.org/dc/dcmitype/> .',
  '@prefix dcterms: <http://purl.org/dc/terms/> .',
  '@prefix foaf: <http://xmlns.com/foaf/0.1/> .',
  '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
  '@prefix prov: <http://www.w3.org/ns/prov#> .',
  '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
  '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
  '@prefix sh: <http://www.w3.org/ns/shacl#> .',
  '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
  '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
  '@prefix aps: <https://w3id.org/nfdi4ing/profiles/> .',
]

const PREFIX_DEFINITIONS = [
  ['dash', 'http://datashapes.org/dash#'],
  ['dcat', 'http://www.w3.org/ns/dcat#'],
  ['dcmitype', 'http://purl.org/dc/dcmitype/'],
  ['dcterms', 'http://purl.org/dc/terms/'],
  ['foaf', 'http://xmlns.com/foaf/0.1/'],
  ['owl', 'http://www.w3.org/2002/07/owl#'],
  ['prov', 'http://www.w3.org/ns/prov#'],
  ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
  ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
  ['sh', 'http://www.w3.org/ns/shacl#'],
  ['skos', 'http://www.w3.org/2004/02/skos/core#'],
  ['xsd', 'http://www.w3.org/2001/XMLSchema#'],
  ['aps', PREFIX_APS],
] as const

export function serializeProfilesAsTurtle(profiles: readonly ShaclProfile[]): string {
  const blocks = profiles
    .map(profile => serializeProfileBodyAsTurtle(profile, profiles).trim())
    .filter(Boolean)

  if (blocks.length === 0) return PREFIXES.join('\n')
  return [
    ...PREFIXES,
    '',
    blocks.join('\n\n'),
  ].join('\n')
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
  return [
    ...PREFIXES,
    '',
    serializeProfileBodyAsTurtle(profile, allProfiles),
  ].join('\n')
}

function serializeProfileBodyAsTurtle(profile: ShaclProfile, allProfiles: readonly ShaclProfile[]): string {
  const shapeToProfile = buildShapeToProfileMap(allProfiles)
  const imports = determineProfileImports(profile, shapeToProfile)
  const blocks: string[] = []

  for (const shape of profile.nodeShapes) {
    blocks.push(serializeNodeShape(shape, shape.nodeId.value === profile.iri ? imports : []))
    for (const property of shape.properties.filter(property => !property.inherited && !isInlinePropertyShapeIdentifier(property.nodeId.value))) {
      blocks.push(serializePropertyShape(property))
    }
  }

  blocks.push(serializeAllowedValueLabels(profile))

  return blocks.filter(Boolean).join('\n\n')
}

function serializeNodeShape(shape: NodeShape, imports: string[]): string {
  const statements = ['a sh:NodeShape']
  pushLiteralStatements(statements, 'dcterms:title', shape.labelLiterals, shape.label)
  pushLiteralStatements(statements, 'rdfs:label', shape.rdfsLabelLiterals, shape.rdfsLabel)
  pushLiteralStatements(statements, 'dcterms:description', shape.descriptionLiterals, shape.description)
  pushLiteralStatement(statements, 'dcterms:creator', shape.creator)
  pushLiteralStatement(statements, 'dcterms:created', shape.created, 'xsd:date')
  if (shape.license?.trim()) {
    if (isLikelyIri(shape.license)) statements.push(`dcterms:license ${term(shape.license)}`)
    else pushLiteralStatement(statements, 'dcterms:license', shape.license)
  }
  if (shape.subject?.trim()) {
    if (isLikelyIri(shape.subject)) statements.push(`dcterms:subject ${term(shape.subject)}`)
    else pushLiteralStatement(statements, 'dcterms:subject', shape.subject)
  }
  if (shape.closed !== undefined) statements.push(`sh:closed ${shape.closed ? 'true' : 'false'}`)
  if (shape.targetClass?.value) statements.push(`sh:targetClass ${term(shape.targetClass.value)}`)
  for (const importIri of imports) {
    statements.push(`owl:imports ${term(importIri)}`)
  }
  for (const iri of shape.wasDerivedFrom ?? []) {
    statements.push(`prov:wasDerivedFrom ${term(iri)}`)
  }
  for (const iri of shape.wasRevisionOf ?? []) {
    statements.push(`prov:wasRevisionOf ${term(iri)}`)
  }
  for (const inheritedIri of shape.inheritedShapeIris ?? []) {
    statements.push(`sh:node ${term(inheritedIri)}`)
  }
  for (const property of shape.properties.filter(property => !property.inherited)) {
    statements.push(
      isInlinePropertyShapeIdentifier(property.nodeId.value)
        ? `sh:property ${serializeInlinePropertyShape(property)}`
        : `sh:property ${term(property.nodeId.value)}`,
    )
  }
  return serializeSubject(shape.nodeId.value, statements)
}

function serializePropertyShape(property: PropertyShape): string {
  return serializeSubject(property.nodeId.value, propertyStatements(property, true))
}

function serializeInlinePropertyShape(property: PropertyShape): string {
  const statements = propertyStatements(property, false)
  if (statements.length === 0) return '[]'
  if (statements.length === 1) return `[ ${statements[0]} ]`
  return `[\n    ${statements.join(' ;\n    ')}\n  ]`
}

function propertyStatements(property: PropertyShape, includeType: boolean): string[] {
  const statements = includeType ? ['a sh:PropertyShape'] : []
  if (property.path?.value) statements.push(`sh:path ${term(property.path.value)}`)
  pushLiteralStatements(statements, 'sh:name', property.nameLiterals, property.name)
  pushLiteralStatements(statements, 'rdfs:label', property.rdfsLabelLiterals, property.rdfsLabel)
  pushLiteralStatements(statements, 'sh:description', property.descriptionLiterals, property.description)
  pushNamedNodeStatement(statements, 'sh:datatype', property.datatype?.value)
  pushNamedNodeStatement(statements, 'sh:node', property.node?.value)
  pushConstraintStatement(statements, 'sh:qualifiedValueShape', property.qualifiedValueShape)
  pushNamedNodeStatement(statements, 'sh:nodeKind', property.nodeKind?.value)
  pushNamedNodeStatement(statements, 'sh:class', property.cls?.value)
  pushStringListStatement(statements, 'sh:in', property.allowedValues)
  pushConstraintListStatement(statements, 'sh:or', property.alternatives)
  pushConstraintListStatement(statements, 'sh:and', property.conjunctions)
  pushConstraintListStatement(statements, 'sh:xone', property.exclusiveAlternatives)
  pushConstraintStatement(statements, 'sh:not', property.negatedConstraint)
  pushNumericStatement(statements, 'sh:minCount', property.minCount)
  pushNumericStatement(statements, 'sh:maxCount', property.maxCount)
  pushNumericStatement(statements, 'sh:qualifiedMinCount', property.qualifiedMinCount)
  pushNumericStatement(statements, 'sh:qualifiedMaxCount', property.qualifiedMaxCount)
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
  if (property.dashSingleLine !== undefined) statements.push(`dash:singleLine ${property.dashSingleLine ? 'true' : 'false'}`)
  return statements
}

function serializeAllowedValueLabels(profile: ShaclProfile): string {
  const labelBlocks = new Map<string, RdfLiteralValue[]>()
  for (const shape of profile.nodeShapes) {
    for (const property of shape.properties.filter(property => !property.inherited)) {
      for (const [value, labels] of Object.entries(property.allowedValueLabels ?? {})) {
        if (labels.length > 0 && isLikelyResourceIdentifier(value)) labelBlocks.set(value, labels)
      }
    }
  }

  return [...labelBlocks.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, labels]) => {
      const statements: string[] = []
      pushLiteralStatements(statements, 'rdfs:label', labels)
      return serializeSubject(value, statements)
    })
    .join('\n\n')
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

      const qualifiedOwner = property.qualifiedValueShape?.node?.value
        ? shapeToProfile.get(property.qualifiedValueShape.node.value)
        : undefined
      if (qualifiedOwner && qualifiedOwner !== profile.iri) imports.add(qualifiedOwner)

      for (const alternative of property.alternatives ?? []) {
        const alternativeOwner = alternative.node?.value ? shapeToProfile.get(alternative.node.value) : undefined
        if (alternativeOwner && alternativeOwner !== profile.iri) imports.add(alternativeOwner)
      }
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

function pushLiteralStatements(
  statements: string[],
  predicate: string,
  literals: RdfLiteralValue[] | undefined,
  fallback?: string,
): void {
  const serialized = (literals ?? [])
    .filter(literal => literal.value.trim())
    .map(literal => `${predicate} ${literalTerm(literal)}`)
  if (serialized.length > 0) {
    statements.push(...serialized)
    return
  }
  pushLiteralStatement(statements, predicate, fallback)
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

function pushConstraintListStatement(
  statements: string[],
  predicate: string,
  constraints: Array<{
    node?: { value: string }
    datatype?: { value: string }
    nodeKind?: { value: string }
    cls?: { value: string }
    label?: string
    description?: string
    pattern?: string
  }> | undefined,
): void {
  if (!constraints?.length) return
  const serialized = constraints
    .map(serializeConstraintNode)
    .filter(Boolean)
  if (serialized.length === 0) return
  statements.push(`${predicate} (\n    ${serialized.join('\n    ')}\n  )`)
}

function pushConstraintStatement(
  statements: string[],
  predicate: string,
  constraint: {
    node?: { value: string }
    datatype?: { value: string }
    nodeKind?: { value: string }
    cls?: { value: string }
    label?: string
    description?: string
    pattern?: string
  } | undefined,
): void {
  if (!constraint) return
  const serialized = serializeConstraintNode(constraint)
  if (!serialized) return
  statements.push(`${predicate} ${serialized}`)
}

function serializeConstraintNode(constraint: {
  node?: { value: string }
  datatype?: { value: string }
  nodeKind?: { value: string }
  cls?: { value: string }
  label?: string
  description?: string
  pattern?: string
}): string {
  const fragments: string[] = []
  pushNamedNodeStatement(fragments, 'sh:node', constraint.node?.value)
  pushNamedNodeStatement(fragments, 'sh:datatype', constraint.datatype?.value)
  pushNamedNodeStatement(fragments, 'sh:nodeKind', constraint.nodeKind?.value)
  pushNamedNodeStatement(fragments, 'sh:class', constraint.cls?.value)
  pushLiteralStatement(fragments, 'rdfs:label', constraint.label)
  pushLiteralStatement(fragments, 'sh:description', constraint.description)
  pushLiteralStatement(fragments, 'sh:pattern', constraint.pattern)
  if (fragments.length === 0) return ''
  if (fragments.length === 1) return `[ ${fragments[0]} ; ]`.replace(' ; ]', ' ]')
  return `[ ${fragments[0]} ; ${fragments.slice(1).join(' ; ')} ]`
}

function term(iri: string): string {
  if (isBlankNodeIdentifier(iri)) return blankNodeLabel(iri)
  for (const [prefix, namespace] of PREFIX_DEFINITIONS) {
    if (!iri.startsWith(namespace)) continue
    const suffix = iri.slice(namespace.length)
    if (canUsePrefixLocalName(suffix)) return `${prefix}:${suffix}`
  }
  return `<${iri}>`
}

function canUsePrefixLocalName(suffix: string): boolean {
  return /^[A-Za-z0-9_](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?$/.test(suffix)
}

function escapeLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
}

function literalTerm(literal: RdfLiteralValue): string {
  const escaped = `"${escapeLiteral(literal.value.trim())}"`
  if (literal.lang) return `${escaped}@${literal.lang}`
  if (literal.datatype && literal.datatype !== 'http://www.w3.org/2001/XMLSchema#string') {
    return `${escaped}^^${term(literal.datatype)}`
  }
  return escaped
}

function isLikelyIri(value: string): boolean {
  return /^https?:\/\//.test(value)
}

function isLikelyResourceIdentifier(value: string): boolean {
  return /^(https?:|urn:)/.test(value)
}

function isBlankNodeIdentifier(value: string): boolean {
  return value.startsWith('_:') || value.startsWith('_g_')
}

function isInlinePropertyShapeIdentifier(value: string): boolean {
  return isBlankNodeIdentifier(value)
    || /^urn:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    || /#property-shape-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function blankNodeLabel(value: string): string {
  return value.startsWith('_:') ? value : `_:${value}`
}
