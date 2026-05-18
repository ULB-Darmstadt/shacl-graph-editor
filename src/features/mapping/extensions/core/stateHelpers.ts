import type {
  ExtensionUiEdge,
  MappingExtensionSnapshotContext,
  MappingExtensionSnapshotHandler,
  MappingExtensionStoreApi,
} from '@/features/mapping/extensions/core/types'
import { cloneUiEdges } from '@/services/project/projectSnapshot'

type SnapshotContext = MappingExtensionSnapshotContext
type ExtensionStoreReader = Pick<MappingExtensionStoreApi, 'findExtensionNode' | 'getExtensionState'>
type ExtensionStoreWriter = Pick<MappingExtensionStoreApi, 'setExtensionState' | 'resetExtensionState'>
type SnapshotPayload<TNode, TEdge> = {
  nodes?: TNode[]
  uiEdges?: TEdge[]
}

export function getExtensionNodes<TNode>(
  context: SnapshotContext,
  stateKey: string,
): TNode[] {
  return context.mappingStore.getExtensionState(stateKey, [] as TNode[])
}

export function getExtensionUiEdges<TEdge extends ExtensionUiEdge>(
  context: SnapshotContext | ExtensionStoreReader,
  stateKey: string,
): TEdge[] {
  const mappingStore = 'mappingStore' in context
    ? context.mappingStore
    : context
  return mappingStore.getExtensionState(stateKey, [] as TEdge[])
}

export function getExtensionNode<TNode extends { id: string }>(
  mappingStore: ExtensionStoreReader,
  stateKey: string,
  nodeId: string,
): TNode | undefined {
  return mappingStore.findExtensionNode<TNode>(stateKey, nodeId)
}

export function getExtensionInputEdge<TEdge extends ExtensionUiEdge>(
  mappingStore: ExtensionStoreReader,
  stateKey: string,
  nodeId: string,
  targetHandle: string,
): TEdge | undefined {
  return getExtensionUiEdges<TEdge>(mappingStore, stateKey)
    .find(edge => edge.target === nodeId && edge.targetHandle === targetHandle)
}

export function createNodeSnapshotHandler<TNode, TEdge extends ExtensionUiEdge>(options: {
  id: string
  nodeStateKey: string
  uiEdgeStateKey: string
  cloneNode: (node: TNode) => TNode
}): MappingExtensionSnapshotHandler {
  return {
    id: options.id,
    createState: context => ({
      nodes: getExtensionNodes<TNode>(context, options.nodeStateKey).map(options.cloneNode),
      uiEdges: cloneUiEdges(getExtensionUiEdges<TEdge>(context, options.uiEdgeStateKey)),
    }),
    restoreState: (state, context) => {
      const nextState = (state && typeof state === 'object')
        ? state as SnapshotPayload<TNode, TEdge>
        : {}
      context.mappingStore.setExtensionState(
        options.nodeStateKey,
        (nextState.nodes ?? []).map(options.cloneNode),
      )
      context.mappingStore.setExtensionState(
        options.uiEdgeStateKey,
        cloneUiEdges(nextState.uiEdges ?? []),
      )
    },
    resetState: context => {
      resetNodeSnapshotState(context.mappingStore, options.nodeStateKey, options.uiEdgeStateKey)
    },
  }
}

export function resetNodeSnapshotState(
  mappingStore: ExtensionStoreWriter,
  nodeStateKey: string,
  uiEdgeStateKey: string,
): void {
  mappingStore.resetExtensionState(nodeStateKey)
  mappingStore.resetExtensionState(uiEdgeStateKey)
}
