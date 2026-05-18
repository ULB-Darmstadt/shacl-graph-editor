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
export const SH_IN = new NamedNode(PREFIX_SHACL + 'in')

// ─── Dublin Core metadata ─────────────────────────────────────────────────────
export const DCT_TITLE = new NamedNode(PREFIX_DCTERMS + 'title')
export const DCT_CREATOR = new NamedNode(PREFIX_DCTERMS + 'creator')
export const DCT_DESCRIPTION = new NamedNode(PREFIX_DCTERMS + 'description')


