import type { NodeShape } from '@/domain/profiles'
import { propertyGraphTargetIris } from '@/presentation/features/editor/inheritanceEditorGraph'

export function collectSidebarProfileShapes(rootShapes: NodeShape[], allShapes: NodeShape[]): NodeShape[] {
  const byIri = new Map(allShapes.map(shape => [shape.nodeId.value, shape]))
  const queue = rootShapes.map(shape => shape.nodeId.value)
  const visited = new Set<string>()
  const result: NodeShape[] = []
  for (let index = 0; index < queue.length; index += 1) {
    const iri = queue[index]
    if (visited.has(iri)) continue
    visited.add(iri)
    const shape = byIri.get(iri)
    if (!shape) continue
    result.push(shape)
    queue.push(...shape.inheritedShapeIris ?? [])
    for (const property of shape.properties) {
      queue.push(...propertyGraphTargetIris(property, allShapes, true, true))
    }
  }
  return result
}

export function canvasShapeIncludesProfile(canvasShapeIri: string, profileShapeIri: string, allShapes: NodeShape[]): boolean {
  const byIri = new Map(allShapes.map(shape => [shape.nodeId.value, shape]))
  const queue = [canvasShapeIri]
  const visited = new Set<string>()
  for (let index = 0; index < queue.length; index += 1) {
    const iri = queue[index]
    if (iri === profileShapeIri) return true
    if (visited.has(iri)) continue
    visited.add(iri)
    queue.push(...byIri.get(iri)?.inheritedShapeIris ?? [])
  }
  return false
}
