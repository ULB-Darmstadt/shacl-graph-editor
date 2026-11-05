import type { Edge, Node } from '@vue-flow/core'
import type { ShapeEditorNodeData } from './inheritanceEditorGraph'

export function propertyConnectionKey(shapeIri: string, propertyNodeId: string): string {
  return JSON.stringify([shapeIri, propertyNodeId])
}

/** Remove private branches while keeping targets reachable from other fields. */
export function collapsePropertyConnections(nodes: Node[], edges: Edge[], collapsed: Set<string>): { nodes: Node[]; edges: Edge[] } {
  const visible = new Set(nodes.map(node => node.id))
  const fadedFields = new Map<string, Set<string>>()
  let remainingEdges = edges

  for (const key of collapsed) {
    const source = nodes.find(node => {
      const data = node.data as ShapeEditorNodeData
      return data.shape.properties.some(property => propertyConnectionKey(data.representedShapeIri, property.nodeId.value) === key)
    })
    if (!source || !visible.has(source.id)) continue
    const data = source.data as ShapeEditorNodeData
    const property = data.shape.properties.find(property => propertyConnectionKey(data.representedShapeIri, property.nodeId.value) === key)
    if (!property) continue
    const outgoing = remainingEdges.filter(edge => edge.source === source.id && edge.sourceHandle === `ref:${property.nodeId.value}`)
    if (!outgoing.length) continue

    const removed = new Set(outgoing.map(edge => edge.id))
    const nextEdges = remainingEdges.filter(edge => !removed.has(edge.id))
    const adjacency = new Map<string, string[]>()
    for (const edge of remainingEdges) adjacency.set(edge.source, [...adjacency.get(edge.source) ?? [], edge.target])

    const candidates = new Set<string>()
    const queue = outgoing.map(edge => edge.target)
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index]
      if (id === source.id || candidates.has(id)) continue
      candidates.add(id)
      queue.push(...adjacency.get(id) ?? [])
    }

    // Every node outside this branch is an anchor. Follow the surviving
    // connections into the branch to preserve shared targets and descendants.
    const retained = new Set([...visible].filter(id => !candidates.has(id)))
    const retainedQueue = [...retained]
    const surviving = new Map<string, string[]>()
    for (const edge of nextEdges) surviving.set(edge.source, [...surviving.get(edge.source) ?? [], edge.target])
    for (let index = 0; index < retainedQueue.length; index += 1) {
      for (const target of surviving.get(retainedQueue[index]) ?? []) {
        if (retained.has(target)) continue
        retained.add(target)
        retainedQueue.push(target)
      }
    }
    for (const id of candidates) if (!retained.has(id)) visible.delete(id)
    remainingEdges = nextEdges.filter(edge => visible.has(edge.source) && visible.has(edge.target))
    const fields = fadedFields.get(source.id) ?? new Set<string>()
    fields.add(property.nodeId.value)
    fadedFields.set(source.id, fields)
  }

  return {
    nodes: nodes.filter(node => visible.has(node.id)).map(node => ({
      ...node,
      data: { ...node.data, collapsedPropertyKeys: [...fadedFields.get(node.id) ?? []] },
    })),
    edges: remainingEdges,
  }
}
