import { describe, expect, it } from 'vitest'
import { ApplicationProfile, parseShaclProfile } from '@/domain/NodeShape'
import { MappingState } from '@/domain/Mapping'
import { AirtableDataSource, CsvDataSource } from '@/domain/DataSource'
import { generateRdf, serializeGraph } from '@/services/rdfGenerator'

const SHAPE = `
@prefix sh:  <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex:  <http://example.org/> .

ex:PersonShape a sh:NodeShape ;
    dct:title "Person" ;
    sh:targetClass ex:Person ;
    sh:property [ sh:name "Name"  ; sh:path ex:name  ; sh:datatype xsd:string ] ;
    sh:property [ sh:name "Email" ; sh:path ex:email ; sh:datatype xsd:string ] .
`

/** Two shapes with a sh:node FK reference: Project → Person */
const FK_SHAPES = `
@prefix sh:  <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex:  <http://example.org/> .

ex:PersonShape a sh:NodeShape ;
  dct:title "Person" ;
  sh:targetClass ex:Person ;
  sh:property [ sh:name "Name" ; sh:path ex:name ; sh:datatype xsd:string ] .

ex:ProjectShape a sh:NodeShape ;
  dct:title "Project" ;
  sh:targetClass ex:Project ;
  sh:property [ sh:name "Title" ; sh:path ex:title ; sh:datatype xsd:string ] ;
  sh:property [ sh:name "Owner" ; sh:path ex:owner ; sh:node ex:PersonShape ] .
`

describe('rdfGenerator', () => {
  it('generates one subject per CSV row with a type and mapped properties', async () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(SHAPE, 'shape.ttl', 'uploaded'))

    const csv = new CsvDataSource('people', 'people.csv',
      ['id', 'Name', 'Email'],
      [
        ['p1', 'Alice', 'alice@example.org'],
        ['p2', 'Bob',   'bob@example.org'],
      ],
    )

    const mapping = new MappingState()
    mapping.addOrReplace({ sourceId: 'people', sourceHeader: 'Name',  shapeIri: 'http://example.org/PersonShape', propertyPath: 'http://example.org/name'  })
    mapping.addOrReplace({ sourceId: 'people', sourceHeader: 'Email', shapeIri: 'http://example.org/PersonShape', propertyPath: 'http://example.org/email' })

    const result = generateRdf(ap, mapping, [csv])
    expect(result.subjectCount).toBe(2)
    expect(result.tripleCount).toBeGreaterThanOrEqual(6) // 2 type + 2 name + 2 email

    const ttl = await serializeGraph(result.store, 'text/turtle')
    expect(ttl).toContain('Alice')
    expect(ttl).toContain('bob@example.org')
    expect(ttl).toContain('Person')
  })

  it('skips empty cells', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(SHAPE, 'shape.ttl', 'uploaded'))
    const csv = new CsvDataSource('people', 'people.csv',
      ['id', 'Name', 'Email'],
      [['p1', 'Alice', '']],
    )
    const mapping = new MappingState()
    mapping.addOrReplace({ sourceId: 'people', sourceHeader: 'Email', shapeIri: 'http://example.org/PersonShape', propertyPath: 'http://example.org/email' })
    const result = generateRdf(ap, mapping, [csv])
    // 1 rdf:type triple, 0 email triples (empty cell)
    expect(result.tripleCount).toBe(1)
  })

  it('builds FK object IRIs using targetClass, not nodeShape IRI', async () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(FK_SHAPES, 'fk.ttl', 'uploaded'))

    // People source (record IDs are the primary keys)
    const people = new AirtableDataSource('people', 'People', ['Name'], [['Alice']], ['recAAA'])
    // Projects source — Owner column contains Airtable record ID of linked person
    const projects = new AirtableDataSource('projects', 'Projects', ['Title', 'Owner'], [['My Project', 'recAAA']], ['recPRJ'])

    const mapping = new MappingState()
    mapping.addOrReplace({ sourceId: 'people',   sourceHeader: 'Name',  shapeIri: 'http://example.org/PersonShape',  propertyPath: 'http://example.org/name' })
    mapping.addOrReplace({ sourceId: 'projects',  sourceHeader: 'Title', shapeIri: 'http://example.org/ProjectShape', propertyPath: 'http://example.org/title' })
    mapping.addOrReplace({ sourceId: 'projects',  sourceHeader: 'Owner', shapeIri: 'http://example.org/ProjectShape', propertyPath: 'http://example.org/owner' })

    const result = generateRdf(ap, mapping, [people, projects])
    const ttl = await serializeGraph(result.store, 'text/turtle')

    // rdflib abbreviates ex:Person/recAAA as a prefixed name (e.g. Per:recAAA).
    // The critical assertion: the object IRI must NOT be the NodeShape IRI
    // (ex:PersonShape/recAAA) — it must be the targetClass IRI (ex:Person/…).
    expect(ttl).toContain('recAAA') // IRI exists in output
    expect(ttl).not.toContain('PersonShape') // NodeShape IRI must not leak into triples
    // The prefix declaration reveals the correct namespace was used
    expect(ttl).toContain('http://example.org/Person/')
  })

  it('handles Airtable array linked-record fields (multiple linked records)', async () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(FK_SHAPES, 'fk.ttl', 'uploaded'))

    const people = new AirtableDataSource('people', 'People', ['Name'], [['Alice'], ['Bob']], ['recA', 'recB'])
    // Owner field contains an array of two linked record IDs
    const projects = new AirtableDataSource('projects', 'Projects', ['Title', 'Owner'], [['Collab', ['recA', 'recB']]], ['recPRJ'])

    const mapping = new MappingState()
    mapping.addOrReplace({ sourceId: 'people',   sourceHeader: 'Name',  shapeIri: 'http://example.org/PersonShape',  propertyPath: 'http://example.org/name' })
    mapping.addOrReplace({ sourceId: 'projects',  sourceHeader: 'Title', shapeIri: 'http://example.org/ProjectShape', propertyPath: 'http://example.org/title' })
    mapping.addOrReplace({ sourceId: 'projects',  sourceHeader: 'Owner', shapeIri: 'http://example.org/ProjectShape', propertyPath: 'http://example.org/owner' })

    const result = generateRdf(ap, mapping, [people, projects])
    const ttl = await serializeGraph(result.store, 'text/turtle')

    // rdflib abbreviates IRIs; check that both record IDs appear as objects
    // (the array field was expanded into two separate triples)
    expect(ttl).toContain('Per:recA')
    expect(ttl).toContain('Per:recB')
  })
})
