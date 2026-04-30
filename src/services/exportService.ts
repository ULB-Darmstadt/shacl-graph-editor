/**
 * exportService — bundles the current project state into an RO-Crate ZIP.
 * Extracted from the old ExportView so it can be triggered from a toolbar
 * button anywhere in the app.
 */
import JSZip from 'jszip'
import { generateRdf, serializeGraph } from '@/services/rdfGenerator'
import { buildRoCrateMetadata, type RoCrateFile } from '@/services/roCrate'
import type { ApplicationProfile, ShaclProfile } from '@/domain/NodeShape'
import type { DataSource } from '@/domain/DataSource'
import type { MappingState } from '@/domain/Mapping'

export interface ExportInput {
  projectTitle: string
  ap: ApplicationProfile
  profiles: ShaclProfile[]
  sources: DataSource[]
  mapping: MappingState
  /** Optional pre-rendered turtle from `<shacl-form>` web components. */
  metadataTurtle?: string
}

export interface ExportResult {
  filename: string
  subjectCount: number
  tripleCount: number
}

function cellToCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-_]/gi, '_') || 'export'
}

function buildReadme(title: string, profiles: number, sources: number, mappings: number): string {
  return `# ${title}

This bundle is an [**RO-Crate 1.1**](https://w3id.org/ro/crate/1.1) packaged by
**Architectural RDM-Pipeline** on ${new Date().toISOString()}.

## Contents

- \`ro-crate-metadata.json\` — RO-Crate metadata descriptor (root)
- \`shapes/\` — ${profiles} SHACL profile(s) (\`text/turtle\`)
- \`sources/\` — ${sources} source table(s) (\`text/csv\`)
- \`data/dataset.ttl\` — generated RDF graph
- \`mapping/mapping.json\` — mapping definition (${mappings} edge(s))
`
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportRoCrate(input: ExportInput): Promise<ExportResult> {
  const zip = new JSZip()
  const files: RoCrateFile[] = []

  // 1. Generated RDF
  const result = generateRdf(input.ap, input.mapping, input.sources)
  let ttl = await serializeGraph(result.store, 'text/turtle')

  // Append metadata-form turtle (from <shacl-form>) if present
  if (input.metadataTurtle && input.metadataTurtle.trim().length > 0) {
    ttl += '\n\n# ----- Dataset metadata (shacl-form) -----\n'
    ttl += input.metadataTurtle
  }

  zip.file('data/dataset.ttl', ttl)
  files.push({
    path: 'data/dataset.ttl',
    name: 'Generated RDF dataset',
    description: `Turtle serialisation produced from the mapping (${result.subjectCount} subjects, ${result.tripleCount} triples).`,
    encodingFormat: 'text/turtle',
  })

  // 2. SHACL profiles
  input.profiles.forEach((p, idx) => {
    const safeName = (p.iri.split(/[/#]/).filter(Boolean).pop() ?? `profile-${idx}`)
      .replace(/[^a-z0-9-_]/gi, '_')
    const path = `shapes/${safeName}.ttl`
    zip.file(path, p.rawTurtle)
    files.push({
      path,
      name: `SHACL profile: ${p.iri}`,
      encodingFormat: 'text/turtle',
      conformsTo: 'https://www.w3.org/TR/shacl/',
    })
  })

  // 3. Source tables
  input.sources.forEach(src => {
    const path = `sources/${sanitize(src.name)}.csv`
    const csv = [src.headers.join(','), ...src.rows.map(row => row.map(cellToCsv).join(','))].join('\n')
    zip.file(path, csv)
    files.push({
      path,
      name: src.name,
      description: `Source table (${src.kind}, ${src.rows.length} rows).`,
      encodingFormat: 'text/csv',
    })
  })

  // 4. Mapping definition
  const mappingJson = JSON.stringify({
    project: { title: input.projectTitle, createdAt: new Date().toISOString() },
    edges: input.mapping.edges,
  }, null, 2)
  zip.file('mapping/mapping.json', mappingJson)
  files.push({
    path: 'mapping/mapping.json',
    name: 'Mapping definition',
    description: `${input.mapping.edges.length} mapping edge(s) connecting source columns to SHACL property paths.`,
    encodingFormat: 'application/json',
  })

  // 5. README
  zip.file('README.md', buildReadme(
    input.projectTitle,
    input.profiles.length,
    input.sources.length,
    input.mapping.edges.length,
  ))
  files.push({ path: 'README.md', name: 'Bundle README', encodingFormat: 'text/markdown' })

  // 6. RO-Crate metadata
  const metadata = buildRoCrateMetadata({
    name: input.projectTitle,
    description: `RDF dataset bundled by Architectural RDM-Pipeline from ${input.profiles.length} SHACL profile(s) and ${input.sources.length} source table(s).`,
    datePublished: new Date().toISOString(),
    files,
  })
  zip.file('ro-crate-metadata.json', metadata)

  const blob = await zip.generateAsync({ type: 'blob' })
  // Use a UUID for the download filename — keeps the file name short and
  // free of special chars that would otherwise be stripped from the title.
  const uuid = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  const filename = `${uuid}.zip`
  triggerDownload(blob, filename)

  return {
    filename,
    subjectCount: result.subjectCount,
    tripleCount: result.tripleCount,
  }
}
