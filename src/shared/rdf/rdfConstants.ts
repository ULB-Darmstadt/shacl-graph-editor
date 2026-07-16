import { NamedNode } from 'rdflib'

// ─── Namespace prefixes ────────────────────────────────────────────────────────
export const PREFIX_SHACL = 'http://www.w3.org/ns/shacl#'
export const PREFIX_RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
export const PREFIX_RDFS = 'http://www.w3.org/2000/01/rdf-schema#'
export const PREFIX_DCTERMS = 'http://purl.org/dc/terms/'
export const PREFIX_OWL = 'http://www.w3.org/2002/07/owl#'
export const PREFIX_XSD = 'http://www.w3.org/2001/XMLSchema#'
export const PREFIX_APS = 'https://w3id.org/nfdi4ing/profiles/'

// ─── RDF core ─────────────────────────────────────────────────────────────────
export const RDF_TYPE = new NamedNode(PREFIX_RDF + 'type')
export const RDFS_LABEL = new NamedNode(PREFIX_RDFS + 'label')
export const OWL_IMPORTS = new NamedNode(PREFIX_OWL + 'imports')

// ─── SHACL — NodeShape ────────────────────────────────────────────────────────
export const SH_NODE_SHAPE = new NamedNode(PREFIX_SHACL + 'NodeShape')
export const SH_PROPERTY = new NamedNode(PREFIX_SHACL + 'property')
export const SH_TARGET_CLASS = new NamedNode(PREFIX_SHACL + 'targetClass')
export const SH_NODE = new NamedNode(PREFIX_SHACL + 'node')
export const SH_CLOSED = new NamedNode(PREFIX_SHACL + 'closed')

// ─── SHACL — PropertyShape ────────────────────────────────────────────────────
export const SH_NAME = new NamedNode(PREFIX_SHACL + 'name')
export const SH_PATH = new NamedNode(PREFIX_SHACL + 'path')
export const SH_DESCRIPTION = new NamedNode(PREFIX_SHACL + 'description')
export const SH_DATATYPE = new NamedNode(PREFIX_SHACL + 'datatype')
export const SH_NODE_KIND = new NamedNode(PREFIX_SHACL + 'nodeKind')
export const SH_MIN_COUNT = new NamedNode(PREFIX_SHACL + 'minCount')
export const SH_MAX_COUNT = new NamedNode(PREFIX_SHACL + 'maxCount')
export const SH_PATTERN = new NamedNode(PREFIX_SHACL + 'pattern')
export const SH_ORDER = new NamedNode(PREFIX_SHACL + 'order')
export const SH_CLASS = new NamedNode(PREFIX_SHACL + 'class')
export const SH_MESSAGE = new NamedNode(PREFIX_SHACL + 'message')
export const SH_SEVERITY = new NamedNode(PREFIX_SHACL + 'severity')
export const SH_EQUALS = new NamedNode(PREFIX_SHACL + 'equals')
export const SH_DISJOINT = new NamedNode(PREFIX_SHACL + 'disjoint')
export const SH_LESS_THAN = new NamedNode(PREFIX_SHACL + 'lessThan')
export const SH_LESS_THAN_OR_EQUALS = new NamedNode(PREFIX_SHACL + 'lessThanOrEquals')
export const SH_MIN_INCLUSIVE = new NamedNode(PREFIX_SHACL + 'minInclusive')
export const SH_MIN_EXCLUSIVE = new NamedNode(PREFIX_SHACL + 'minExclusive')
export const SH_MAX_INCLUSIVE = new NamedNode(PREFIX_SHACL + 'maxInclusive')
export const SH_MAX_EXCLUSIVE = new NamedNode(PREFIX_SHACL + 'maxExclusive')
export const SH_IN = new NamedNode(PREFIX_SHACL + 'in')
export const SH_OR = new NamedNode(PREFIX_SHACL + 'or')
export const SH_AND = new NamedNode(PREFIX_SHACL + 'and')
export const SH_XONE = new NamedNode(PREFIX_SHACL + 'xone')
export const SH_NOT = new NamedNode(PREFIX_SHACL + 'not')
export const SH_QUALIFIED_VALUE_SHAPE = new NamedNode(PREFIX_SHACL + 'qualifiedValueShape')
export const SH_QUALIFIED_MIN_COUNT = new NamedNode(PREFIX_SHACL + 'qualifiedMinCount')
export const SH_QUALIFIED_MAX_COUNT = new NamedNode(PREFIX_SHACL + 'qualifiedMaxCount')

// ─── Dublin Core metadata ─────────────────────────────────────────────────────
export const DCT_TITLE = new NamedNode(PREFIX_DCTERMS + 'title')
export const DCT_CREATOR = new NamedNode(PREFIX_DCTERMS + 'creator')
export const DCT_DESCRIPTION = new NamedNode(PREFIX_DCTERMS + 'description')
export const DCT_CREATED = new NamedNode(PREFIX_DCTERMS + 'created')
export const DCT_LICENSE = new NamedNode(PREFIX_DCTERMS + 'license')
export const DCT_SUBJECT = new NamedNode(PREFIX_DCTERMS + 'subject')

export const PREFIX_DASH = 'http://datashapes.org/dash#'
export const DASH_DEFAULT_VALUE = new NamedNode(PREFIX_DASH + 'defaultValue')


