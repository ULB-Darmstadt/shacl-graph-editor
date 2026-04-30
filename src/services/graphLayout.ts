import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@vue-flow/core'

/**
 * Auto-layouts mapping graph using Dagre with left-to-right flow.
 *
 * Tables are placed on the left, NodeShapes on the right. Falls back
 * to the input positions when Dagre is unavailable (e.g. during tests
 * before the package is installed).
 */
export function layoutMappingGraph(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 200 })

  for (const node of nodes) {
    const isTable = node.type === 'tableNode'
    g.setNode(node.id, {
      width: isTable ? 280 : 320,
      height: estimateHeight(node),
    })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodes.map(node => {
    const dagreNode = g.node(node.id)
    if (!dagreNode) return node
    return {
      ...node,
      position: {
        x: dagreNode.x - dagreNode.width / 2,
        y: dagreNode.y - dagreNode.height / 2,
      },
    }
  })
}

function estimateHeight(node: Node): number {
  const headerH = 60
  const rowH = 28
  const rows = node.type === 'tableNode'
    ? (node.data?.source?.headers?.length ?? 0)
    : (node.data?.shape?.properties?.length ?? 0)
  return headerH + rowH * Math.max(rows, 1)
}
