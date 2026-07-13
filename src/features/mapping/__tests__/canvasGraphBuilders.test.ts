import { describe, expect, it } from 'vitest'
import { createColumnMappingEdge } from '@/domain/Mapping'
import {
  buildCanvasInheritedShapeNodeId,
  buildCanvasMappingEdges,
  buildCanvasShapeNodeId,
  buildCanvasShapeNodes,
  buildCanvasStructuralEdges,
} from '@/features/mapping/canvasGraphBuilders'
import { getEmbeddedExampleProjectSnapshot } from '@/services/project/loadEmbeddedExampleProject'
import { ApplicationProfile, parseShaclProfile } from '@/domain/NodeShape'
import { restoreDataSourcesFromSnapshot } from '@/services/project/projectSnapshot'

const INHERITED_BASE_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:BaseShape a sh:NodeShape ;
  dct:title "Base shape" ;
  sh:targetClass ex:Base ;
  sh:property [
    sh:name "Base field" ;
    sh:path ex:baseField ;
    sh:datatype xsd:string ;
    sh:order 1 ;
  ] .
`

const INHERITED_MIDDLE_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:MiddleShape a sh:NodeShape ;
  dct:title "Middle shape" ;
  sh:targetClass ex:Middle ;
  sh:node ex:BaseShape ;
  sh:property [
    sh:name "Middle field" ;
    sh:path ex:middleField ;
    sh:datatype xsd:string ;
    sh:order 2 ;
  ] .
`

const INHERITED_ROOT_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .

ex:RootShape a sh:NodeShape ;
  dct:title "Root shape" ;
  sh:targetClass ex:Root ;
  sh:node ex:MiddleShape ;
  sh:property [
    sh:name "Own field" ;
    sh:path ex:ownField ;
    sh:datatype xsd:string ;
    sh:order 3 ;
  ] .
`

const INHERITED_REFERENCE_TARGET_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex: <http://example.org/> .

ex:TargetShape a sh:NodeShape ;
  dct:title "Target shape" ;
  sh:targetClass ex:Target ;
  sh:property [
    sh:name "Target label" ;
    sh:path ex:targetLabel ;
  ] .
`

const INHERITED_REFERENCE_MIDDLE_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex: <http://example.org/> .

ex:MiddleRefShape a sh:NodeShape ;
  dct:title "Middle ref shape" ;
  sh:targetClass ex:MiddleRef ;
  sh:node ex:BaseShape ;
  sh:property [
    sh:name "Middle relation" ;
    sh:path ex:middleRelation ;
    sh:node ex:TargetShape ;
    sh:class ex:Target ;
  ] .
`

const INHERITED_REFERENCE_ROOT_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix ex: <http://example.org/> .

ex:RootRefShape a sh:NodeShape ;
  dct:title "Root ref shape" ;
  sh:targetClass ex:RootRef ;
  sh:node ex:MiddleRefShape ;
  sh:property [
    sh:name "Own relation" ;
    sh:path ex:ownRelation ;
  ] .
`

describe('canvasGraphBuilders', () => {
  it('creates a structural edge between linked CSV example tables', () => {
    const snapshot = getEmbeddedExampleProjectSnapshot()
    const ap = new ApplicationProfile()
    for (const profile of snapshot.shapeProfiles) {
      ap.upsert(parseShaclProfile(profile.rawTurtle, profile.source, 'embedded', profile.iri))
    }

    const edges = buildCanvasStructuralEdges(restoreDataSourcesFromSnapshot(snapshot.sources), ap.allNodeShapes())

    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'src:buildings.csv',
        target: 'src:locations.csv',
        sourceHandle: 'h:Location',
      }),
    ]))
  })

  it('adds inherited proxy nodes recursively as branches are expanded', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(INHERITED_BASE_TTL, 'base.ttl', 'fetched', 'http://example.org/base-profile'))
    ap.upsert(parseShaclProfile(INHERITED_MIDDLE_TTL, 'middle.ttl', 'fetched', 'http://example.org/middle-profile'))
    ap.upsert(parseShaclProfile(INHERITED_ROOT_TTL, 'root.ttl', 'uploaded', 'http://example.org/root-profile'))

    const allShapes = ap.allNodeShapes()
    const rootShape = ap.findNodeShape('http://example.org/RootShape')
    expect(rootShape).toBeDefined()

    const rootNodeId = buildCanvasShapeNodeId('http://example.org/RootShape')
    const middleNodeId = buildCanvasInheritedShapeNodeId('http://example.org/RootShape', ['http://example.org/MiddleShape'])

    const parentExpandedNodes = buildCanvasShapeNodes(
      [rootShape!],
      allShapes,
      new Set([rootNodeId]),
      () => undefined,
      () => undefined,
    )
    expect(parentExpandedNodes.map(node => node.id)).toEqual([
      rootNodeId,
      middleNodeId,
    ])

    const fullyExpandedNodes = buildCanvasShapeNodes(
      [rootShape!],
      allShapes,
      new Set([rootNodeId, middleNodeId]),
      () => undefined,
      () => undefined,
    )
    expect(fullyExpandedNodes.map(node => node.id)).toEqual([
      rootNodeId,
      middleNodeId,
      buildCanvasInheritedShapeNodeId('http://example.org/RootShape', ['http://example.org/MiddleShape', 'http://example.org/BaseShape']),
    ])
  })

  it('keeps mapping edges on the parent node when inherited origins are visible', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(INHERITED_BASE_TTL, 'base.ttl', 'fetched', 'http://example.org/base-profile'))
    ap.upsert(parseShaclProfile(INHERITED_MIDDLE_TTL, 'middle.ttl', 'fetched', 'http://example.org/middle-profile'))
    ap.upsert(parseShaclProfile(INHERITED_ROOT_TTL, 'root.ttl', 'uploaded', 'http://example.org/root-profile'))

    const allShapes = ap.allNodeShapes()
    const rootShape = ap.findNodeShape('http://example.org/RootShape')
    expect(rootShape).toBeDefined()

    const rootNodeId = buildCanvasShapeNodeId('http://example.org/RootShape')
    const middleNodeId = buildCanvasInheritedShapeNodeId('http://example.org/RootShape', ['http://example.org/MiddleShape'])

    const shapeNodes = buildCanvasShapeNodes(
      [rootShape!],
      allShapes,
      new Set([rootNodeId]),
      () => undefined,
      () => undefined,
    )
    const visibleNodeIds = new Set(['src:people', ...shapeNodes.map(node => node.id)])

    const edges = buildCanvasMappingEdges(
      [createColumnMappingEdge({
        sourceId: 'people',
        sourceHeader: 'Base column',
        shapeIri: 'http://example.org/RootShape',
        propertyPath: 'http://example.org/baseField',
      })],
      allShapes,
      visibleNodeIds,
    )

    expect(edges).toEqual([
      expect.objectContaining({
        id: 'e:http://example.org/RootShape::http://example.org/baseField',
        label: '',
        target: rootNodeId,
        targetHandle: 'p:http://example.org/baseField',
      }),
    ])
  })

  it('creates a structural link from the parent shape to visible inherited origin nodes', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(INHERITED_BASE_TTL, 'base.ttl', 'fetched', 'http://example.org/base-profile'))
    ap.upsert(parseShaclProfile(INHERITED_MIDDLE_TTL, 'middle.ttl', 'fetched', 'http://example.org/middle-profile'))
    ap.upsert(parseShaclProfile(INHERITED_ROOT_TTL, 'root.ttl', 'uploaded', 'http://example.org/root-profile'))

    const allShapes = ap.allNodeShapes()
    const rootShape = ap.findNodeShape('http://example.org/RootShape')
    expect(rootShape).toBeDefined()

    const rootNodeId = buildCanvasShapeNodeId('http://example.org/RootShape')
    const middleNodeId = buildCanvasInheritedShapeNodeId('http://example.org/RootShape', ['http://example.org/MiddleShape'])
    const baseNodeId = buildCanvasInheritedShapeNodeId('http://example.org/RootShape', ['http://example.org/MiddleShape', 'http://example.org/BaseShape'])
    const visibleNodeIds = new Set([rootNodeId, middleNodeId, baseNodeId])

    const edges = buildCanvasStructuralEdges(
      [],
      [rootShape!],
      allShapes,
      new Set([rootNodeId, middleNodeId]),
      visibleNodeIds,
    )

    expect(edges).toEqual([
      expect.objectContaining({
        id: `inh:${rootNodeId}->${middleNodeId}`,
        label: 'sh:node',
        source: rootNodeId,
        sourceHandle: 'inheritance-source',
        target: middleNodeId,
        targetHandle: 'inheritance-target',
      }),
      expect.objectContaining({
        id: `inh:${middleNodeId}->${baseNodeId}`,
        label: 'sh:node',
        source: middleNodeId,
        sourceHandle: 'inheritance-source',
        target: baseNodeId,
        targetHandle: 'inheritance-target',
      }),
    ])
  })

  it('keeps inherited reference edges anchored on the root shape node', () => {
    const ap = new ApplicationProfile()
    ap.upsert(parseShaclProfile(INHERITED_BASE_TTL, 'base.ttl', 'uploaded'))
    ap.upsert(parseShaclProfile(INHERITED_REFERENCE_TARGET_TTL, 'target.ttl', 'uploaded'))
    ap.upsert(parseShaclProfile(INHERITED_REFERENCE_MIDDLE_TTL, 'middle-ref.ttl', 'uploaded'))
    ap.upsert(parseShaclProfile(INHERITED_REFERENCE_ROOT_TTL, 'root-ref.ttl', 'uploaded'))

    const allShapes = ap.allNodeShapes()
    const rootShape = ap.findNodeShape('http://example.org/RootRefShape')
    expect(rootShape).toBeDefined()

    const rootNodeId = buildCanvasShapeNodeId('http://example.org/RootRefShape')
    const middleNodeId = buildCanvasInheritedShapeNodeId('http://example.org/RootRefShape', ['http://example.org/MiddleRefShape'])
    const targetNodeId = buildCanvasShapeNodeId('http://example.org/TargetShape')
    const visibleNodeIds = new Set([rootNodeId, middleNodeId, targetNodeId])

    const edges = buildCanvasStructuralEdges(
      [],
      [rootShape!],
      allShapes,
      new Set([rootNodeId]),
      visibleNodeIds,
    )

    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'ref:http://example.org/RootRefShape::http://example.org/middleRelation->http://example.org/TargetShape',
        source: rootNodeId,
        target: targetNodeId,
        label: 'sh:node',
      }),
    ]))
  })
})
