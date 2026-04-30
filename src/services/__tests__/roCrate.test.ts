import { describe, expect, it } from 'vitest'
import { buildRoCrateMetadata } from '@/services/roCrate'

describe('buildRoCrateMetadata', () => {
  it('produces a valid RO-Crate 1.1 descriptor with metadata file + root dataset', () => {
    const json = buildRoCrateMetadata({
      name: 'My dataset',
      datePublished: '2026-04-29T10:00:00Z',
      files: [
        { path: 'data/dataset.ttl', name: 'Generated graph', encodingFormat: 'text/turtle' },
      ],
    })
    const obj = JSON.parse(json)
    expect(obj['@context']).toBe('https://w3id.org/ro/crate/1.1/context')
    const ids = (obj['@graph'] as { '@id': string }[]).map(e => e['@id'])
    expect(ids).toContain('ro-crate-metadata.json')
    expect(ids).toContain('./')
    expect(ids).toContain('data/dataset.ttl')

    const metaFile = obj['@graph'].find((e: { '@id': string }) => e['@id'] === 'ro-crate-metadata.json')
    expect(metaFile.conformsTo).toEqual({ '@id': 'https://w3id.org/ro/crate/1.1' })
    expect(metaFile.about).toEqual({ '@id': './' })

    const root = obj['@graph'].find((e: { '@id': string }) => e['@id'] === './')
    expect(root['@type']).toBe('Dataset')
    expect(root.name).toBe('My dataset')
    expect(root.hasPart).toEqual([{ '@id': 'data/dataset.ttl' }])
  })

  it('emits a Person entity when a creator is provided', () => {
    const json = buildRoCrateMetadata({
      name: 'X',
      datePublished: '2026-04-29',
      creator: 'Alice Example',
      files: [],
    })
    const obj = JSON.parse(json)
    const person = obj['@graph'].find((e: { '@type': string }) => e['@type'] === 'Person')
    expect(person).toBeDefined()
    expect(person.name).toBe('Alice Example')
    const root = obj['@graph'].find((e: { '@id': string }) => e['@id'] === './')
    expect(root.creator).toEqual({ '@id': person['@id'] })
  })
})
