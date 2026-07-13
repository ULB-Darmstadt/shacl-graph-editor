import { describe, expect, it } from 'vitest'
import {
  ApplicationProfile,
  classifyShape,
  parseShaclProfile,
  propertyConstraintSummary,
  propertyDatatypeTargets,
  propertyRelationshipKinds,
  propertyNodeTargets,
} from '@/domain/NodeShape'

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

const STAKEHOLDER_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix schema: <http://schema.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <http://example.org/> .

ex:StakeholderShape a sh:NodeShape ;
  dct:title "Stakeholder" ;
  sh:targetClass prov:Attribution ;
  sh:property [
    sh:name "Organization" ;
    sh:path prov:agent ;
    sh:node ex:OrganisationShape ;
    sh:class foaf:Organisation ;
  ] ;
  sh:property [
    sh:name "Role" ;
    sh:path schema:roleName ;
    sh:nodeKind sh:BlankNodeOrIRI ;
  ] .
`

const INHERITED_BASE_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:ImportedProfileShape a sh:NodeShape ;
  dct:title "Imported profile" ;
  sh:targetClass ex:ImportedResource ;
  sh:property [
    sh:name "Imported field" ;
    sh:path ex:importedField ;
    sh:datatype xsd:string ;
    sh:order 1 ;
  ] .
`

const INHERITING_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:ConcreteShape a sh:NodeShape ;
  dct:title "Concrete shape" ;
  sh:targetClass ex:Concrete ;
  sh:node ex:ImportedProfileShape ;
  sh:property [
    sh:name "Own field" ;
    sh:path ex:ownField ;
    sh:datatype xsd:string ;
    sh:order 2 ;
  ] .
`

const LOGICAL_CONSTRAINT_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:LogicalShape a sh:NodeShape ;
  dct:title "Logical shape" ;
  sh:targetClass ex:Logical ;
  sh:property [
    sh:name "Date of production" ;
    sh:path ex:dateOfProduction ;
    sh:or (
      [ sh:datatype xsd:gYear ; sh:name "Single year" ]
      [ sh:datatype xsd:string ; sh:name "Year range" ]
    ) ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:name "Stakeholder" ;
    sh:path ex:stakeholder ;
    sh:qualifiedValueShape [
      sh:node ex:StakeholderShape ;
      sh:class ex:Stakeholder ;
      sh:name "Stakeholder shape" ;
    ] ;
    sh:qualifiedMinCount 1 ;
  ] .
`

const MIXED_OR_CLASSIFICATION_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:MixedShape a sh:NodeShape ;
  dct:title "Mixed shape" ;
  sh:targetClass ex:Mixed ;
  sh:property [
    sh:name "Mixed field" ;
    sh:path ex:mixedField ;
    sh:or (
      [ sh:datatype xsd:string ; sh:name "Literal branch" ]
      [ sh:node ex:TargetShape ; sh:name "Node branch" ]
    ) ;
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

  it('classifies mixed stakeholder-style shapes as data, not reference', () => {
    const profile = parseShaclProfile(STAKEHOLDER_TTL, 'stakeholder.ttl', 'uploaded')
    expect(classifyShape(profile.nodeShapes[0])).toBe('data')
  })

  it('classifies sh:or properties with both literal and node branches as data', () => {
    const profile = parseShaclProfile(MIXED_OR_CLASSIFICATION_TTL, 'mixed.ttl', 'uploaded')
    expect(classifyShape(profile.nodeShapes[0])).toBe('data')
  })

  it('parses sh:or alternatives and qualified value shapes for canvas rendering', () => {
    const profile = parseShaclProfile(LOGICAL_CONSTRAINT_TTL, 'logical.ttl', 'uploaded')
    const shape = profile.nodeShapes[0]

    const logicalProperty = shape.properties[0]
    expect(propertyDatatypeTargets(logicalProperty).map(target => target.value)).toEqual([
      'http://www.w3.org/2001/XMLSchema#gYear',
      'http://www.w3.org/2001/XMLSchema#string',
    ])
    expect(propertyConstraintSummary(logicalProperty)).toBe('Single year | Year range')
    expect(propertyRelationshipKinds(logicalProperty)).toEqual(['sh:or'])

    const qualifiedProperty = shape.properties[1]
    expect(propertyNodeTargets(qualifiedProperty).map(target => target.value)).toEqual([
      'http://example.org/StakeholderShape',
    ])
    expect(propertyConstraintSummary(qualifiedProperty)).toBe('1..* Stakeholder shape')
    expect(propertyRelationshipKinds(qualifiedProperty)).toEqual(['sh:qualifiedValueShape'])
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

  it('merges node-level inherited properties ahead of own properties', () => {
    const ap = new ApplicationProfile()
    const imported = parseShaclProfile(INHERITED_BASE_TTL, 'imported.ttl', 'fetched', 'http://example.org/imported-profile')
    const inheriting = parseShaclProfile(INHERITING_TTL, 'concrete.ttl', 'uploaded')
    ap.upsert(imported)
    ap.upsert(inheriting)

    const shape = ap.findNodeShape('http://example.org/ConcreteShape')
    expect(shape?.properties.map(property => property.name)).toEqual(['Imported field', 'Own field'])
    expect(shape?.properties[0]?.inherited).toBe(true)
    expect(shape?.properties[0]?.inheritedFromShapeIri).toBe('http://example.org/ImportedProfileShape')
    expect(shape?.properties[1]?.inherited).not.toBe(true)
  })

  it('marks imported inherited node shapes so they can be hidden from the canvas', () => {
    const ap = new ApplicationProfile()
    const imported = parseShaclProfile(INHERITED_BASE_TTL, 'imported.ttl', 'fetched', 'http://example.org/imported-profile')
    const inheriting = parseShaclProfile(INHERITING_TTL, 'concrete.ttl', 'uploaded')
    ap.upsert(imported)
    ap.upsert(inheriting)

    expect(ap.inheritedImportedNodeShapeIds()).toEqual(new Set(['http://example.org/ImportedProfileShape']))
  })

  it('keeps usable shapes when an inherited imported shape is missing', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(INHERITING_TTL, 'concrete.ttl', 'uploaded'))

    const shape = ap.findNodeShape('http://example.org/ConcreteShape')

    expect(shape?.properties.map(property => property.name)).toEqual(['Own field'])
    expect(ap.allNodeShapes()).toHaveLength(1)
  })
})



