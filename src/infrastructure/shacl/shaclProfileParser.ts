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
import { applyConstraintPredicate, localName } from '@/shared/rdf/propertyConstraints'
import type { NodeShape, PropertyShape, ShaclProfile } from '@/domain/profiles'

const DEFAULT_BASE_URI = 'http://example.org/'

export function parseShaclProfile(
  rawTurtle: string,
  source: string,
  origin: ShaclProfile['origin'],
  iriHint?: string,
): ShaclProfile {
  const store: Store = graph()
  parse(rawTurtle, store, DEFAULT_BASE_URI, 'text/turtle')

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

function extractNodeShape(nodeId: NamedNode, store: Store): NodeShape {
  const shape: NodeShape = { nodeId, properties: [], inheritedShapeIris: [] }

  store.match(nodeId, null, null, null).forEach(statement => {
    const predicate = statement.predicate.value
    const object = statement.object as Literal | NamedNode | BlankNode

    if (predicate === DCT_TITLE.value) {
      if (object.termType === 'Literal' && !shape.label) shape.label = object.value
    } else if (predicate === RDFS_LABEL.value) {
      if (object.termType === 'Literal') {
        if (!shape.rdfsLabel) shape.rdfsLabel = object.value
        if (!shape.label) shape.label = object.value
      }
    } else if (predicate === DCT_DESCRIPTION.value) {
      if (object.termType === 'Literal') shape.description = object.value
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

  shape.properties.sort((left, right) => (left.order ?? 999) - (right.order ?? 999))
  return shape
}

function extractPropertyShape(nodeId: NamedNode | BlankNode, store: Store): PropertyShape {
  const propertyShape: PropertyShape = { nodeId }

  store.match(nodeId, null, null, null).forEach(statement => {
    const predicate = statement.predicate.value
    const object = statement.object as Literal | NamedNode | BlankNode
    if (predicate === SH_NAME.value && object.termType === 'Literal') propertyShape.name = object.value
    else if (predicate === SH_DESCRIPTION.value && object.termType === 'Literal') propertyShape.description = object.value
    else if (predicate === SH_PATH.value && object.termType === 'NamedNode') propertyShape.path = object
    else if (predicate === SH_ORDER.value && object.termType === 'Literal') propertyShape.order = Number(object.value)
    else applyConstraintPredicate(propertyShape, predicate, object, store)
  })

  if (propertyShape.node) propertyShape.editorType = 'profile'
  else if (propertyShape.allowedValues !== undefined) propertyShape.editorType = 'list'
  else if (propertyShape.nodeKind) propertyShape.editorType = 'nodeKind'
  else propertyShape.editorType = 'datatype'

  return propertyShape
}
