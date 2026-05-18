import type { ExtensionUiEdge, NodeRunStats } from '@/features/mapping/extensions/core/types'
import type { GeoNameFeature, GeoNamesOutputField } from '@/features/mapping/extensions/modules/nodes/geonames/client'

export interface GeoNamesNodeConfig {
  id: string
  username: string
  selectedOutputs: GeoNamesOutputField[]
  inputSourceId?: string
  inputHeader?: string
  outputSourceId?: string
  status: 'idle' | 'running' | 'success' | 'error'
  stats: NodeRunStats
  results: Record<string, GeoNameFeature>
}

export type GeoNamesUiEdge = ExtensionUiEdge

