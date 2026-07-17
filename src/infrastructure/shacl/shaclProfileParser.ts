import { graph, parse, type BlankNode, type Literal, type NamedNode, type Store } from 'rdflib'
import {
  DCT_CREATED,
  DCT_CREATOR,
  DCT_DESCRIPTION,
  DCT_LICENSE,
  DCT_SUBJECT,
  DCT_TITLE,
  OWL_IMPORTS,
  RDFS_LABEL,
  SH_DESCRIPTION,
  SH_CLOSED,
  SH_NAME,
  SH_NODE,
  SH_NODE_SHAPE,
  SH_ORDER,
  SH_PATH,
  SH_PROPERTY,
  SH_TARGET_CLASS,
} from '@/shared/rdf/rdfConstants'
import { applyConstraintPredicate, inferPropertyEditorType, localName } from '@/shared/rdf/propertyConstraints'
import type { NodeShape, PropertyShape, ShaclProfile } from '@/domain/profiles'

const DEFAULT_BASE_URI = 'http://example.org/'

export function parseShaclProfile(
  rawTurtle: string,
  source: string,
  origin: ShaclProfile['origin'],
  iriHint?: string,
  mediaType?: string,
): ShaclProfile {
  const store: Store = graph()
  parse(rawTurtle, store, DEFAULT_BASE_URI, normalizeRdfMediaType(mediaType, rawTurtle))

  const nodeShapeSubjects = new Set<string>()
  store.match(null, null, SH_NODE_SHAPE, null).forEach(statement => {
    if (statement.subject.termType === 'NamedNode') nodeShapeSubjects.add(statement.subject.value)
  })
  store.match(null, SH_PROPERTY, null, null).forEach(statement => {
    if (statement.subject.termType === 'NamedNode') nodeShapeSubjects.add(statement.subject.value)
  })

  const nodeShapes: NodeShape[] = []
  for (const iri of nodeShapeSubjects) {
    const subject = store.sym(iri)
    nodeShapes.push(extractNodeShape(subject as NamedNode, store))
  }

  const profileIri = iriHint ?? nodeShapes[0]?.nodeId.value ?? source
  for (const shape of nodeShapes) shape.sourceProfileIri = profileIri

  const imports = new Set<string>()
  store.match(null, OWL_IMPORTS, null, null).forEach(statement => {
    if (statement.object.termType === 'NamedNode') imports.add(statement.object.value)
  })

  return {
    iri: profileIri,
    source,
    origin,
    rawTurtle,
    imports: Array.from(imports),
    nodeShapes,
  }
}

function normalizeRdfMediaType(mediaType: string | undefined, content: string): string {
  const normalized = mediaType?.split(';', 1)[0]?.trim().toLowerCase()
  if (normalized === 'application/rdf+xml' || normalized === 'application/xml' || normalized === 'text/xml') {
    return 'application/rdf+xml'
  }
  if (normalized === 'application/ld+json' || normalized === 'application/json') {
    return 'application/ld+json'
  }
  if (normalized === 'text/n3' || normalized === 'application/n-triples' || normalized === 'text/turtle') {
    return 'text/turtle'
  }

  const trimmed = content.trimStart()
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rdf:RDF') || trimmed.startsWith('<!DOCTYPE')) {
    return 'application/rdf+xml'
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'application/ld+json'
  }
  return 'text/turtle'
}

function extractNodeShape(nodeId: NamedNode, store: Store): NodeShape {
  const shape: NodeShape = { nodeId, properties: [], inheritedShapeIris: [] }
  const preferredLabel = createPreferredLiteralTracker()
  const preferredRdfsLabel = createPreferredLiteralTracker()
  const preferredDescription = createPreferredLiteralTracker()

  store.match(nodeId, null, null, null).forEach(statement => {
    const predicate = statement.predicate.value
    const object = statement.object as Literal | NamedNode | BlankNode

    if (predicate === DCT_TITLE.value) {
      if (object.termType === 'Literal') preferredLabel.consider(object)
    } else if (predicate === RDFS_LABEL.value) {
      if (object.termType === 'Literal') {
        preferredRdfsLabel.consider(object)
        preferredLabel.consider(object)
      }
    } else if (predicate === DCT_DESCRIPTION.value) {
      if (object.termType === 'Literal') preferredDescription.consider(object)
    } else if (predicate === DCT_CREATOR.value) {
      if (object.termType === 'Literal') shape.creator = object.value
      else if (object.termType === 'NamedNode') shape.creator = localName(object.value)
    } else if (predicate === DCT_CREATED.value) {
      if (object.termType === 'Literal') shape.created = object.value
    } else if (predicate === DCT_LICENSE.value) {
      if (object.termType === 'Literal') shape.license = object.value
      else if (object.termType === 'NamedNode') shape.license = localName(object.value)
    } else if (predicate === DCT_SUBJECT.value) {
      if (object.termType === 'Literal') shape.subject = object.value
      else if (object.termType === 'NamedNode') shape.subject = localName(object.value)
    } else if (predicate === SH_CLOSED.value) {
      if (object.termType === 'Literal') shape.closed = object.value === 'true'
    } else if (predicate === SH_TARGET_CLASS.value) {
      if (object.termType === 'NamedNode') shape.targetClass = object
    } else if (predicate === SH_NODE.value) {
      if (object.termType === 'NamedNode') shape.inheritedShapeIris?.push(object.value)
    } else if (predicate === SH_PROPERTY.value) {
      shape.properties.push(extractPropertyShape(object as NamedNode | BlankNode, store))
    }
  })

  shape.label = preferredLabel.value
  shape.rdfsLabel = preferredRdfsLabel.value
  shape.description = preferredDescription.value
  shape.properties.sort((left, right) => (left.order ?? 999) - (right.order ?? 999))
  return shape
}

function extractPropertyShape(nodeId: NamedNode | BlankNode, store: Store): PropertyShape {
  const propertyShape: PropertyShape = { nodeId }
  const preferredName = createPreferredLiteralTracker()
  const preferredDescription = createPreferredLiteralTracker()

  store.match(nodeId, null, null, null).forEach(statement => {
    const predicate = statement.predicate.value
    const object = statement.object as Literal | NamedNode | BlankNode
    if (predicate === SH_NAME.value && object.termType === 'Literal') preferredName.consider(object)
    else if (predicate === SH_DESCRIPTION.value && object.termType === 'Literal') preferredDescription.consider(object)
    else if (predicate === SH_PATH.value && object.termType === 'NamedNode') propertyShape.path = object
    else if (predicate === SH_ORDER.value && object.termType === 'Literal') propertyShape.order = Number(object.value)
    else applyConstraintPredicate(propertyShape, predicate, object, store)
  })

  propertyShape.name = preferredName.value
  propertyShape.description = preferredDescription.value
  propertyShape.editorType = inferPropertyEditorType(propertyShape)

  return propertyShape
}

function createPreferredLiteralTracker(): {
  value: string | undefined
  consider: (literal: Literal) => void
} {
  let bestScore = -1
  let bestValue: string | undefined

  return {
    get value() {
      return bestValue
    },
    consider(literal: Literal) {
      const score = languagePreferenceScore(literal)
      if (score > bestScore) {
        bestScore = score
        bestValue = literal.value
      }
    },
  }
}

function languagePreferenceScore(literal: Literal): number {
  const language = literal.lang?.toLowerCase() ?? ''
  if (language === 'en') return 3
  if (language.startsWith('en-')) return 3
  if (language === 'de') return 2
  if (language.startsWith('de-')) return 2
  if (!language) return 1
  return 0
}
