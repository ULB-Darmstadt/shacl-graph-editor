import type { MappingExtensionStoreApi } from '@/features/mapping/extensions/core/types'
import type { ExtensionCanvasBuildContext, MappingExtensionSnapshotContext } from '@/features/mapping/extensions/core/types'
import { getExtensionNodes, getExtensionUiEdges } from '@/features/mapping/extensions/core/stateHelpers'
import type { TransformationNodeConfig, TransformationUiEdge } from '@/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/types'

export const LAT_LNG_TO_WKT_TRANSFORM_ID = 'lat-lng-to-wkt'
export const TRANSFORMATION_NODE_STATE_KEY = 'node.transformation.nodes'
export const TRANSFORMATION_UI_EDGE_STATE_KEY = 'node.transformation.uiEdges'

export function getTransformationNodes(
  context: ExtensionCanvasBuildContext | MappingExtensionSnapshotContext,
): TransformationNodeConfig[] {
  return getExtensionNodes<TransformationNodeConfig>(context, TRANSFORMATION_NODE_STATE_KEY)
}

export function getTransformationUiEdges(
  context: ExtensionCanvasBuildContext | MappingExtensionSnapshotContext,
): TransformationUiEdge[] {
  return getExtensionUiEdges<TransformationUiEdge>(context, TRANSFORMATION_UI_EDGE_STATE_KEY)
}

export function createTransformationNode(mappingStore: MappingExtensionStoreApi): TransformationNodeConfig {
  return mappingStore.createExtensionNode(TRANSFORMATION_NODE_STATE_KEY, 'transform', id => ({
    id,
    kind: LAT_LNG_TO_WKT_TRANSFORM_ID,
  }))
}
