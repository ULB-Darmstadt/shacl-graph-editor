import { graph, namedNode, literal, serialize, type NamedNode, type Node as RdfNode, type Store } from 'rdflib'
import { RDF_TYPE } from '@/domain/rdfConstants'
import type { ApplicationProfile, NodeShape } from '@/domain/NodeShape'
import { classifyShape } from '@/domain/NodeShape'
import type { MappingState } from '@/domain/Mapping'
import type { DataSource } from '@/domain/DataSource'

/**
 * RdfGenerator
 *
 * Walks the user's mapping and produces an in-memory RDF store.
 * Subjects are constructed from the NodeShape's targetClass (or nodeId)
 * combined with the source row's primary key (recordId or first column).
 *
 * NOTE: This is a simplified generator. It does not yet handle nested
 * sh:node references with cross-table joins; that is tracked under
 * Backlog Story 3.3 and will replace this code path with a YARRRML-based
 * generator in a follow-up iteration.
 */

export interface GeneratedGraph {
  store: Store
  /** Number of subjects created. */
  subjectCount: number
  /** Number of triples created. */
  tripleCount: number
}

export function generateRdf(
  ap: ApplicationProfile,
  mapping: MappingState,
  sources: DataSource[],
  metadataFields?: Record<string, string>,
): GeneratedGraph {
  const store = graph()
  // Register a single `ex:` prefix for instance IRIs so the serialized
  // Turtle/N-Triples output uses `ex:Type/id` consistently instead of
  // having rdflib auto-mint per-class prefixes (`Bui:rec…`, `Per:rec…`).
  ;(store as unknown as { setPrefixForURI: (p: string, u: string) => void })
    .setPrefixForURI?.('ex', 'http://example.org/')
  const sourceMap = new Map(sources.map(s => [s.id, s]))
  const subjects = new Set<string>()

  for (const shape of ap.allNodeShapes()) {
    const kind = classifyShape(shape)

    if (kind === 'form') {
      // Form shapes → single singleton subject from manually entered metadata
      if (!metadataFields) continue
      const shapeIri = shape.nodeId.value
      const relevantKeys = Object.keys(metadataFields).filter(k => k.startsWith(`${shapeIri}::`))
      if (relevantKeys.length === 0) continue

      const typeNode = shape.targetClass ?? (shape.nodeId.termType === 'NamedNode' ? shape.nodeId as NamedNode : null)
      const subject = mintInstanceIri(typeNode?.value, 'singleton', shapeIri)
      subjects.add(subject.value)
      if (typeNode) store.add(subject, RDF_TYPE, typeNode)
      for (const key of relevantKeys) {
        const propPath = key.slice(shapeIri.length + 2)
        const ps = shape.properties.find(p => p.path?.value === propPath)
        if (!ps?.path) continue
        const val = metadataFields[key]
        if (!val) continue
        store.add(subject, ps.path, ps.datatype ? literal(val, ps.datatype) : literal(val))
      }
      continue
    }

    const edges = mapping.forShape(shape.nodeId.value)
    if (edges.length === 0) continue

    const sourceId = edges[0].sourceId
    const source = sourceMap.get(sourceId)
    if (!source) continue

    for (let rowIdx = 0; rowIdx < source.rows.length; rowIdx++) {
      const row = source.rows[rowIdx]
      const subject = subjectFor(shape, source, row, rowIdx)
      subjects.add(subject.value)

      const typeNode = shape.targetClass ?? (shape.nodeId.termType === 'NamedNode' ? shape.nodeId as NamedNode : null)
      if (typeNode) store.add(subject, RDF_TYPE, typeNode)

      for (const edge of edges) {
        const ps = shape.properties.find(p => p.path?.value === edge.propertyPath)
        if (!ps?.path) continue
        const headerIdx = source.headers.indexOf(edge.sourceHeader)
        if (headerIdx < 0) continue
        const cellValue = row[headerIdx]
        if (cellValue === null || cellValue === undefined || cellValue === '') continue

        // Resolve the targetClass of the referenced shape (for correct IRI construction).
        // Without this, FK IRIs would use the NodeShape IRI instead of the targetClass IRI,
        // which would not match the subject IRIs generated for those referenced records.
        const refTargetClass = ps.node
          ? (ap.findNodeShape(ps.node.value)?.targetClass ?? ps.node)
          : undefined

        const objects = buildObjects(cellValue, edge.transform, refTargetClass, ps.datatype)
        for (const obj of objects) store.add(subject, ps.path, obj)
      }
    }
  }

  return {
    store,
    subjectCount: subjects.size,
    tripleCount: (store as any).statements?.length ?? 0,
  }
}

function subjectFor(
  shape: NodeShape,
  source: DataSource,
  row: unknown[],
  rowIdx: number,
): NamedNode {
  // Prefer per-row recordIds (Airtable) over column 0 (CSV)
  const id = source.recordIds?.[rowIdx] ?? String(row[0] ?? `${source.id}-row${rowIdx}`)
  const classIri = (shape.targetClass ?? (shape.nodeId.termType === 'NamedNode' ? shape.nodeId : null))?.value
  return mintInstanceIri(classIri, String(id), shape.nodeId.value)
}

/**
 * Mints an instance IRI under the example.org base, derived from the local
 * name of the class IRI. Avoids polluting foreign vocabularies (e.g. minting
 * subjects under `http://xmlns.com/foaf/0.1/Organization/...`) while keeping
 * the local-name semantically meaningful.
 */
function mintInstanceIri(classIri: string | undefined, id: string, fallbackKey: string): NamedNode {
  const localName = classIri ? localNameOf(classIri) : ''
  const segment = localName || localNameOf(fallbackKey) || 'Resource'
  return namedNode(`http://example.org/${segment}/${encodeURIComponent(id)}`)
}

/**
 * Returns the trailing segment of an IRI (after the last `/` or `#`).
 * Falls back to an empty string if no separator is found.
 */
function localNameOf(iri: string): string {
  const idx = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'))
  return idx >= 0 ? iri.slice(idx + 1) : ''
}

/**
 * Extracts one or more string values from a cell.
 *
 * Handles:
 * - Plain strings / numbers / booleans → [String(v)]
 * - Airtable linked-record arrays      → each element treated as a separate value
 * - `split-comma` transform            → splits a plain string on commas
 */
function extractValues(cellValue: unknown, transform: string | undefined): string[] {
  // Airtable linked-record fields arrive as arrays of record IDs
  if (Array.isArray(cellValue)) {
    return cellValue
      .map(v => (v !== null && v !== undefined ? String(v).trim() : ''))
      .filter(Boolean)
  }
  const raw = String(cellValue)
  if (transform === 'split-comma') {
    return raw.split(',').map(s => s.trim()).filter(Boolean)
  }
  return raw ? [raw] : []
}

function buildObjects(
  cellValue: unknown,
  transform: string | undefined,
  /** When set, the targetClass IRI of the referenced shape — used to build object IRIs. */
  refTargetClass: NamedNode | undefined,
  datatype: NamedNode | undefined,
): RdfNode[] {
  const values = extractValues(cellValue, transform)

  return values.map(v => {
    if (refTargetClass) {
      // Object reference — build IRI using the same example.org formula as subjectFor()
      return mintInstanceIri(refTargetClass.value, v, refTargetClass.value)
    }
    return datatype ? literal(v, datatype) : literal(v)
  })
}

/**
 * Serialises a generated graph to the requested RDF format.
 */
export function serializeGraph(
  store: Store,
  format: 'text/turtle' | 'application/ld+json' | 'application/n-triples' = 'text/turtle',
): Promise<string> {
  return new Promise((resolve, reject) => {
    serialize(null, store, undefined, format, (err, str) => {
      if (err) reject(err)
      else resolve(str ?? '')
    })
  })
}
