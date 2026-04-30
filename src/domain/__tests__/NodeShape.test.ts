import { describe, expect, it } from 'vitest'
import { ApplicationProfile, parseShaclProfile } from '@/domain/NodeShape'

const SAMPLE_TTL = `
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix ex:   <http://example.org/> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .

ex:PersonShape a sh:NodeShape ;
    dct:title "Person" ;
    sh:targetClass ex:Person ;
    owl:imports <http://example.org/imports/contact> ;
    sh:property [
        sh:name "Name" ;
        sh:path ex:name ;
        sh:datatype xsd:string ;
        sh:order 1 ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:name "Email" ;
        sh:path ex:email ;
        sh:datatype xsd:string ;
        sh:order 2 ;
    ] .
`

describe('parseShaclProfile', () => {
  it('parses a NodeShape with its property shapes', () => {
    const profile = parseShaclProfile(SAMPLE_TTL, 'sample.ttl', 'uploaded')
    expect(profile.nodeShapes).toHaveLength(1)
    const shape = profile.nodeShapes[0]
    expect(shape.label).toBe('Person')
    expect(shape.targetClass?.value).toBe('http://example.org/Person')
    expect(shape.properties).toHaveLength(2)
    expect(shape.properties[0].name).toBe('Name')
    expect(shape.properties[0].path?.value).toBe('http://example.org/name')
    expect(shape.properties[0].minCount).toBe(1)
    expect(shape.properties[0].maxCount).toBe(1)
  })

  it('sorts properties by sh:order', () => {
    const profile = parseShaclProfile(SAMPLE_TTL, 'sample.ttl', 'uploaded')
    const orders = profile.nodeShapes[0].properties.map(p => p.order)
    expect(orders).toEqual([1, 2])
  })

  it('collects owl:imports IRIs', () => {
    const profile = parseShaclProfile(SAMPLE_TTL, 'sample.ttl', 'uploaded')
    expect(profile.imports).toContain('http://example.org/imports/contact')
  })

  it('uses the first NodeShape IRI as the profile IRI', () => {
    const profile = parseShaclProfile(SAMPLE_TTL, 'sample.ttl', 'uploaded')
    expect(profile.iri).toBe('http://example.org/PersonShape')
  })
})

describe('ApplicationProfile', () => {
  it('deduplicates NodeShapes by IRI across profiles', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(SAMPLE_TTL, 'a.ttl', 'uploaded'))
    ap.upsert(parseShaclProfile(SAMPLE_TTL, 'b.ttl', 'uploaded'))
    expect(ap.allNodeShapes()).toHaveLength(1)
  })

  it('finds NodeShape by IRI', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(SAMPLE_TTL, 'a.ttl', 'uploaded'))
    expect(ap.findNodeShape('http://example.org/PersonShape')).toBeDefined()
    expect(ap.findNodeShape('http://example.org/Unknown')).toBeUndefined()
  })

  it('reports hasShapes correctly', () => {
    const ap = new ApplicationProfile()
    expect(ap.hasShapes).toBe(false)
    ap.upsert(parseShaclProfile(SAMPLE_TTL, 'a.ttl', 'uploaded'))
    expect(ap.hasShapes).toBe(true)
  })
})
