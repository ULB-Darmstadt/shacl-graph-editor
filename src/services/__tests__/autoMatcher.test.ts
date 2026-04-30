import { describe, expect, it } from 'vitest'
import { ApplicationProfile, parseShaclProfile } from '@/domain/NodeShape'
import { CsvDataSource } from '@/domain/DataSource'
import { suggestMappings } from '@/services/autoMatcher'

const SHAPE = `
@prefix sh:  <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex:  <http://example.org/> .
@prefix dct: <http://purl.org/dc/terms/> .

ex:PersonShape a sh:NodeShape ;
  dct:title "Person" ;
  sh:targetClass ex:Person ;
  sh:property [ sh:name "Name"  ; sh:path ex:name  ; sh:datatype xsd:string ] ;
  sh:property [ sh:name "Email" ; sh:path ex:email ; sh:datatype xsd:string ] ;
  sh:property [ sh:name "City"  ; sh:path ex:city  ; sh:datatype xsd:string ] .
`

describe('autoMatcher', () => {
  it('suggests exact name matches with high confidence', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(SHAPE, 'test.ttl', 'uploaded'))

    const csv = new CsvDataSource('people', 'people.csv', ['Name', 'Email', 'City'], [])
    const suggestions = suggestMappings([csv], ap.allNodeShapes())

    const nameSug = suggestions.find(s => s.propertyPath === 'http://example.org/name')
    expect(nameSug).toBeDefined()
    expect(nameSug!.confidence).toBeGreaterThanOrEqual(0.9)
    expect(nameSug!.sourceHeader).toBe('Name')
  })

  it('suggests near matches (case-insensitive)', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(SHAPE, 'test.ttl', 'uploaded'))

    // 'eMail' and 'EMail' are very close to 'email'
    const csv = new CsvDataSource('people', 'people.csv', ['eMail', 'Stadt'], [])
    const suggestions = suggestMappings([csv], ap.allNodeShapes())

    const emailSug = suggestions.find(s => s.propertyPath === 'http://example.org/email')
    expect(emailSug).toBeDefined()
    expect(emailSug!.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('does not suggest below the confidence threshold', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(SHAPE, 'test.ttl', 'uploaded'))

    // Completely unrelated headers
    const csv = new CsvDataSource('x', 'x.csv', ['zzz_foo', 'qqqq_bar'], [])
    const suggestions = suggestMappings([csv], ap.allNodeShapes())
    // All similarities should be below 0.45 → no suggestions
    expect(suggestions.length).toBe(0)
  })
})
