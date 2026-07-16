import type { BlankNode, NamedNode } from 'rdflib'
import type { PropertyConstraintCarrier } from '@/shared/rdf/propertyConstraints'

export interface PropertyShape extends PropertyConstraintCarrier {
  nodeId: NamedNode | BlankNode
  name?: string
  description?: string
  path?: NamedNode
  order?: number
  editorType?: 'datatype' | 'nodeKind' | 'profile' | 'list'
  allowedValues?: string[]
  inherited?: boolean
  inheritedFromShapeIri?: string
  inheritedFromShapeLabel?: string
}

export interface NodeShape {
  nodeId: NamedNode | BlankNode
  label?: string
  rdfsLabel?: string
  description?: string
  creator?: string
  created?: string
  license?: string
  subject?: string
  closed?: boolean
  targetClass?: NamedNode
  properties: PropertyShape[]
  inheritedShapeIris?: string[]
  sourceProfileIri?: string
}

export interface ShaclProfile {
  iri: string
  source: string
  origin: 'uploaded' | 'fetched' | 'created'
  rawTurtle: string
  imports: string[]
  nodeShapes: NodeShape[]
}

export class ApplicationProfile {
  readonly profiles = new Map<string, ShaclProfile>()

  upsert(profile: ShaclProfile): void {
    this.profiles.set(profile.iri, profile)
  }

  list(): ShaclProfile[] {
    return Array.from(this.profiles.values())
  }

  rawNodeShapes(): NodeShape[] {
    const seen = new Set<string>()
    const result: NodeShape[] = []
    for (const profile of this.profiles.values()) {
      for (const shape of profile.nodeShapes) {
        const key = shape.nodeId.value
        if (!seen.has(key)) {
          seen.add(key)
          result.push(shape)
        }
      }
    }
    return result
  }

  allNodeShapes(): NodeShape[] {
    return this.rawNodeShapes().map(shape => this.resolveNodeShape(shape.nodeId.value))
  }

  findNodeShape(iri: string): NodeShape | undefined {
    const found = this.rawNodeShapes().find(shape => shape.nodeId.value === iri)
    return found ? this.resolveNodeShape(found.nodeId.value) : undefined
  }

  inheritedImportedNodeShapeIds(): Set<string> {
    const hidden = new Set<string>()
    const rawShapes = this.rawNodeShapes()
    const rawByIri = new Map(rawShapes.map(shape => [shape.nodeId.value, shape]))

    for (const shape of rawShapes) {
      for (const inheritedIri of shape.inheritedShapeIris ?? []) {
        const inheritedShape = rawByIri.get(inheritedIri)
        if (!inheritedShape) continue
        if (inheritedShape.sourceProfileIri && inheritedShape.sourceProfileIri !== shape.sourceProfileIri) {
          hidden.add(inheritedIri)
        }
      }
    }

    return hidden
  }

  resolveNodeShape(iri: string, visited = new Set<string>()): NodeShape {
    const rawShape = this.rawNodeShapes().find(shape => shape.nodeId.value === iri)
    if (!rawShape) throw new Error(`Unknown NodeShape: ${iri}`)
    if (visited.has(iri)) return rawShape

    const nextVisited = new Set(visited)
    nextVisited.add(iri)

    const ownProperties = rawShape.properties.map(property => ({ ...property }))
    const ownKeys = new Set(ownProperties.map(propertyKeyFor))
    const inheritedProperties: PropertyShape[] = []

    for (const inheritedIri of rawShape.inheritedShapeIris ?? []) {
      const hasInheritedShape = this.rawNodeShapes().some(shape => shape.nodeId.value === inheritedIri)
      if (!hasInheritedShape) continue

      const inheritedShape = this.resolveNodeShape(inheritedIri, nextVisited)
      for (const property of inheritedShape.properties) {
        const key = propertyKeyFor(property)
        if (ownKeys.has(key)) continue
        inheritedProperties.push({
          ...property,
          inherited: true,
          inheritedFromShapeIri: property.inheritedFromShapeIri ?? inheritedShape.nodeId.value,
          inheritedFromShapeLabel: property.inheritedFromShapeLabel ?? inheritedShape.label,
        })
      }
    }

    return {
      ...rawShape,
      properties: [...inheritedProperties, ...ownProperties],
    }
  }

  get hasShapes(): boolean {
    return this.allNodeShapes().length > 0
  }
}

function propertyKeyFor(property: PropertyShape): string {
  return property.path?.value ?? property.nodeId.value
}
