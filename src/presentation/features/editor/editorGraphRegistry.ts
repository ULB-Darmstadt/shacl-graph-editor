import { defineAsyncComponent, markRaw } from 'vue'
import type { Node } from '@vue-flow/core'

const ShapeNode = defineAsyncComponent(() => import('@/presentation/features/editor/components/graph/ShapeNode.vue'))
const RelationEdge = defineAsyncComponent(() => import('@/presentation/features/editor/components/graph/RelationEdge.vue'))

export const editorNodeTypes = {
  shapeNode: markRaw(ShapeNode),
}

export const editorEdgeTypes = {
  default: markRaw(RelationEdge),
}

const defaultNodePositions: Partial<Record<string, Node['position']>> = {
  shapeNode: { x: 760, y: 40 },
}

export function defaultPositionForEditorNodeType(nodeType: string | undefined, index: number): Node['position'] {
  const base = nodeType ? defaultNodePositions[nodeType] : undefined
  if (!base) return { x: 760, y: 40 + index * 220 }
  return { x: base.x, y: base.y + index * 220 }
}
