import type { MappingTransformId } from '@/domain/Mapping'
import type { ExtensionUiEdge } from '@/features/mapping/extensions/core/types'

export interface TransformationNodeConfig {
  id: string
  kind: MappingTransformId
}

export type TransformationUiEdge = ExtensionUiEdge

