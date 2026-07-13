import { NamedNode as RdfNamedNode, type BlankNode, type Collection, type Literal, type NamedNode, type Store } from 'rdflib'
import {
  RDFS_LABEL,
  SH_AND,
  SH_CLASS,
  SH_DATATYPE,
  SH_DESCRIPTION,
  SH_MAX_COUNT,
  SH_MIN_COUNT,
  SH_NAME,
  SH_NODE,
  SH_NODE_KIND,
  SH_NOT,
  SH_OR,
  SH_PATTERN,
  SH_QUALIFIED_MAX_COUNT,
  SH_QUALIFIED_MIN_COUNT,
  SH_QUALIFIED_VALUE_SHAPE,
  SH_XONE,
} from './rdfConstants'

const RDF_FIRST = new RdfNamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first')
const RDF_REST = new RdfNamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest')
const RDF_NIL = new RdfNamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')

export interface PropertyConstraint {
  label?: string
  description?: string
  datatype?: NamedNode
  node?: NamedNode
  nodeKind?: NamedNode
  cls?: NamedNode
  pattern?: string
}

export interface PropertyConstraintCarrier {
  datatype?: NamedNode
  node?: NamedNode
  nodeKind?: NamedNode
  cls?: NamedNode
  minCount?: number
  maxCount?: number
  pattern?: string
  alternatives?: PropertyConstraint[]
  conjunctions?: PropertyConstraint[]
  exclusiveAlternatives?: PropertyConstraint[]
  negatedConstraint?: PropertyConstraint
  qualifiedValueShape?: PropertyConstraint
  qualifiedMinCount?: number
  qualifiedMaxCount?: number
}

export function applyConstraintPredicate(
  target: PropertyConstraintCarrier,
  predicate: string,
  obj: Literal | NamedNode | BlankNode | Collection,
  store: Store,
): boolean {
  if (predicate === SH_DATATYPE.value && obj.termType === 'NamedNode') {
    target.datatype = obj
    return true
  }
  if (predicate === SH_NODE.value && obj.termType === 'NamedNode') {
    target.node = obj
    return true
  }
  if (predicate === SH_NODE_KIND.value && obj.termType === 'NamedNode') {
    target.nodeKind = obj
    return true
  }
  if (predicate === SH_CLASS.value && obj.termType === 'NamedNode') {
    target.cls = obj
    return true
  }
  if (predicate === SH_MIN_COUNT.value && obj.termType === 'Literal') {
    target.minCount = Number(obj.value)
    return true
  }
  if (predicate === SH_MAX_COUNT.value && obj.termType === 'Literal') {
    target.maxCount = Number(obj.value)
    return true
  }
  if (predicate === SH_PATTERN.value && obj.termType === 'Literal') {
    target.pattern = obj.value
    return true
  }
  if (predicate === SH_OR.value && isConstraintContainer(obj)) {
    target.alternatives = extractConstraintList(obj, store)
    return true
  }
  if (predicate === SH_AND.value && isConstraintContainer(obj)) {
    target.conjunctions = extractConstraintList(obj, store)
    return true
  }
  if (predicate === SH_XONE.value && isConstraintContainer(obj)) {
    target.exclusiveAlternatives = extractConstraintList(obj, store)
    return true
  }
  if (predicate === SH_NOT.value && (obj.termType === 'BlankNode' || obj.termType === 'NamedNode')) {
    target.negatedConstraint = extractConstraint(obj, store)
    return true
  }
  if (predicate === SH_QUALIFIED_VALUE_SHAPE.value && (obj.termType === 'BlankNode' || obj.termType === 'NamedNode')) {
    target.qualifiedValueShape = extractConstraint(obj, store)
    return true
  }
  if (predicate === SH_QUALIFIED_MIN_COUNT.value && obj.termType === 'Literal') {
    target.qualifiedMinCount = Number(obj.value)
    return true
  }
  if (predicate === SH_QUALIFIED_MAX_COUNT.value && obj.termType === 'Literal') {
    target.qualifiedMaxCount = Number(obj.value)
    return true
  }

  return false
}

export function propertyNodeTargets(property: PropertyConstraintCarrier): NamedNode[] {
  const targets: NamedNode[] = []
  const seen = new Set<string>()

  function push(node: NamedNode | undefined): void {
    if (!node || seen.has(node.value)) return
    seen.add(node.value)
    targets.push(node)
  }

  push(property.node)
  push(property.qualifiedValueShape?.node)
  for (const constraint of property.alternatives ?? []) push(constraint.node)
  for (const constraint of property.conjunctions ?? []) push(constraint.node)
  for (const constraint of property.exclusiveAlternatives ?? []) push(constraint.node)

  return targets
}

export function propertyDatatypeTargets(property: PropertyConstraintCarrier): NamedNode[] {
  const targets: NamedNode[] = []
  const seen = new Set<string>()

  function push(node: NamedNode | undefined): void {
    if (!node || seen.has(node.value)) return
    seen.add(node.value)
    targets.push(node)
  }

  push(property.datatype)
  push(property.qualifiedValueShape?.datatype)
  for (const constraint of property.alternatives ?? []) push(constraint.datatype)
  for (const constraint of property.conjunctions ?? []) push(constraint.datatype)
  for (const constraint of property.exclusiveAlternatives ?? []) push(constraint.datatype)

  return targets
}

export function propertyConstraintSummary(property: PropertyConstraintCarrier): string | undefined {
  if (property.alternatives?.length) return property.alternatives.map(formatConstraint).join(' | ')
  if (property.conjunctions?.length) return property.conjunctions.map(formatConstraint).join(' & ')
  if (property.exclusiveAlternatives?.length) return property.exclusiveAlternatives.map(formatConstraint).join(' xor ')
  if (property.negatedConstraint) return `not ${formatConstraint(property.negatedConstraint)}`
  if (property.qualifiedValueShape) {
    const range = formatQualifiedRange(property)
    const target = formatConstraint(property.qualifiedValueShape)
    return range ? `${range} ${target}` : target
  }
  return undefined
}

export function propertyRelationshipKinds(property: PropertyConstraintCarrier): string[] {
  const kinds: string[] = []
  const seen = new Set<string>()

  function push(kind: string, condition: boolean): void {
    if (!condition || seen.has(kind)) return
    seen.add(kind)
    kinds.push(kind)
  }

  push('sh:node', Boolean(property.node))
  push('sh:or', Boolean(property.alternatives?.length))
  push('sh:and', Boolean(property.conjunctions?.length))
  push('sh:xone', Boolean(property.exclusiveAlternatives?.length))
  push('sh:not', Boolean(property.negatedConstraint))
  push('sh:qualifiedValueShape', Boolean(property.qualifiedValueShape))

  return kinds
}

export function propertyHasDirectValueSemantics(property: PropertyConstraintCarrier): boolean {
  if (propertyNodeTargets(property).length === 0) return true
  if (propertyHasDirectConstraint(property)) return true
  if (property.alternatives?.some(constraintHasDirectValueSemantics)) return true
  if (property.conjunctions?.some(constraintHasDirectValueSemantics)) return true
  if (property.exclusiveAlternatives?.some(constraintHasDirectValueSemantics)) return true
  if (property.negatedConstraint && constraintHasDirectValueSemantics(property.negatedConstraint)) return true
  return false
}

export function localName(iri: string): string {
  return iri.split(/[/#]/).filter(Boolean).pop() ?? iri
}

function extractConstraintList(listNode: NamedNode | BlankNode | Collection, store: Store): PropertyConstraint[] {
  return readRdfList(listNode, store).map(node => extractConstraint(node, store))
}

function readRdfList(listNode: NamedNode | BlankNode | Collection, store: Store): Array<NamedNode | BlankNode> {
  if (listNode.termType === 'Collection') {
    return listNode.elements.filter(
      (term): term is NamedNode | BlankNode => term.termType === 'NamedNode' || term.termType === 'BlankNode',
    )
  }

  const out: Array<NamedNode | BlankNode> = []
  let current: NamedNode | BlankNode | null = listNode
  const visited = new Set<string>()

  while (current && current.value !== RDF_NIL.value && !visited.has(current.value)) {
    visited.add(current.value)
    const first = store.match(current, RDF_FIRST, null, null)[0]?.object as NamedNode | BlankNode | undefined
    if (first && (first.termType === 'NamedNode' || first.termType === 'BlankNode')) {
      out.push(first)
    }
    const rest = store.match(current, RDF_REST, null, null)[0]?.object as NamedNode | BlankNode | undefined
    if (!rest || (rest.termType !== 'NamedNode' && rest.termType !== 'BlankNode')) break
    current = rest
  }

  return out
}

function isConstraintContainer(term: Literal | NamedNode | BlankNode | Collection): term is NamedNode | BlankNode | Collection {
  return term.termType === 'NamedNode' || term.termType === 'BlankNode' || term.termType === 'Collection'
}

function extractConstraint(nodeId: NamedNode | BlankNode, store: Store): PropertyConstraint {
  const constraint: PropertyConstraint = {}

  store.match(nodeId, null, null, null).forEach(t => {
    const predicate = t.predicate.value
    const obj = t.object as Literal | NamedNode | BlankNode | Collection
    if (applyConstraintPredicate(constraint, predicate, obj, store)) return
    if (predicate === SH_NAME.value && obj.termType === 'Literal') constraint.label = obj.value
    else if (predicate === RDFS_LABEL.value && obj.termType === 'Literal' && !constraint.label) constraint.label = obj.value
    else if (predicate === SH_DESCRIPTION.value && obj.termType === 'Literal') constraint.description = obj.value
  })

  if (!constraint.label && nodeId.termType === 'NamedNode') {
    constraint.label = localName(nodeId.value)
  }

  return constraint
}

function propertyHasDirectConstraint(property: PropertyConstraintCarrier): boolean {
  return Boolean(property.datatype || property.pattern || (property.nodeKind && !property.node) || (property.cls && !property.node))
}

function constraintHasDirectValueSemantics(constraint: PropertyConstraint): boolean {
  return Boolean(constraint.datatype || constraint.pattern || (constraint.nodeKind && !constraint.node) || (constraint.cls && !constraint.node))
}

function formatQualifiedRange(property: PropertyConstraintCarrier): string | undefined {
  if (property.qualifiedMinCount !== undefined && property.qualifiedMaxCount !== undefined) {
    return `${property.qualifiedMinCount}..${property.qualifiedMaxCount}`
  }
  if (property.qualifiedMinCount !== undefined) return `${property.qualifiedMinCount}..*`
  if (property.qualifiedMaxCount !== undefined) return `0..${property.qualifiedMaxCount}`
  return undefined
}

function formatConstraint(constraint: PropertyConstraint): string {
  if (constraint.label) return constraint.label
  if (constraint.datatype) return localName(constraint.datatype.value)
  if (constraint.node) return localName(constraint.node.value)
  if (constraint.cls) return localName(constraint.cls.value)
  if (constraint.nodeKind) return localName(constraint.nodeKind.value)
  if (constraint.pattern) return 'pattern'
  return 'constraint'
}