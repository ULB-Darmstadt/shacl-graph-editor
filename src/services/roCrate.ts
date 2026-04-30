/**
 * RO-Crate 1.1 metadata builder.
 *
 * Produces a minimal, valid `ro-crate-metadata.json` describing the export
 * bundle as a Dataset with files for SHACL profiles, source tables, the
 * generated RDF graph and the mapping definition.
 *
 * Spec: https://www.researchobject.org/ro-crate/1.1/
 */

export interface RoCrateInput {
  /** Human-readable project title (becomes the Dataset's `name`). */
  name: string
  /** Optional description. */
  description?: string
  /** ISO timestamp when the bundle was created. */
  datePublished: string
  /** Files to include in the crate. */
  files: RoCrateFile[]
  /** Optional creator (string name or array thereof). */
  creator?: string
}

export interface RoCrateFile {
  /** Path inside the crate (e.g. "data/dataset.ttl"). */
  path: string
  /** Display name. */
  name: string
  /** Optional description. */
  description?: string
  /** IANA media type, e.g. "text/turtle". */
  encodingFormat?: string
  /** Optional URL identifying the conformsTo profile. */
  conformsTo?: string
}

interface JsonLdEntity {
  '@id': string
  '@type': string | string[]
  [key: string]: unknown
}

const RO_CRATE_CONTEXT = 'https://w3id.org/ro/crate/1.1/context'
const RO_CRATE_PROFILE = 'https://w3id.org/ro/crate/1.1'

export function buildRoCrateMetadata(input: RoCrateInput): string {
  const graph: JsonLdEntity[] = []

  // 1. Metadata file descriptor (always first).
  graph.push({
    '@id': 'ro-crate-metadata.json',
    '@type': 'CreativeWork',
    conformsTo: { '@id': RO_CRATE_PROFILE },
    about: { '@id': './' },
  })

  // 2. Root Dataset.
  const rootDataset: JsonLdEntity = {
    '@id': './',
    '@type': 'Dataset',
    name: input.name,
    datePublished: input.datePublished,
    hasPart: input.files.map(f => ({ '@id': f.path })),
  }
  if (input.description) rootDataset.description = input.description
  if (input.creator) rootDataset.creator = { '@id': `#creator-${slug(input.creator)}` }
  graph.push(rootDataset)

  // 3. File entries.
  for (const file of input.files) {
    const entity: JsonLdEntity = {
      '@id': file.path,
      '@type': 'File',
      name: file.name,
    }
    if (file.description) entity.description = file.description
    if (file.encodingFormat) entity.encodingFormat = file.encodingFormat
    if (file.conformsTo) entity.conformsTo = { '@id': file.conformsTo }
    graph.push(entity)
  }

  // 4. Optional Person entity for the creator.
  if (input.creator) {
    graph.push({
      '@id': `#creator-${slug(input.creator)}`,
      '@type': 'Person',
      name: input.creator,
    })
  }

  return JSON.stringify({ '@context': RO_CRATE_CONTEXT, '@graph': graph }, null, 2)
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
