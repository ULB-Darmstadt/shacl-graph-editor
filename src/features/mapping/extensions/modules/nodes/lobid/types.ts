import type { ExtensionUiEdge, NodeRunStats } from '@/features/mapping/extensions/core/types'
import type { LobidExtendedRecord } from '@/features/mapping/extensions/modules/nodes/lobid/client'

export interface LobidNodeConfig {
  id: string
  selectedProperties: string[]
  inputSourceId?: string
  inputHeader?: string
  outputSourceId?: string
  status: 'idle' | 'running' | 'success' | 'error'
  stats: NodeRunStats
  results: Record<string, LobidExtendedRecord>
}

export type LobidUiEdge = ExtensionUiEdge

