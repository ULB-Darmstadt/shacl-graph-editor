import type { DataSource } from '@/domain/DataSource'
import type { useDataStore } from '@/stores/dataStore'
import type { useMappingStore } from '@/stores/mappingStore'
import type { GeoNamesNodeConfig, GeoNamesUiEdge } from '@/features/mapping/extensions/modules/nodes/geonames/types'
import {
  GEONAMES_NODE_STATE_KEY,
  GEONAMES_UI_EDGE_STATE_KEY,
  syncGeoNamesShapeMappings,
} from '@/features/mapping/extensions/modules/nodes/geonames/workflow'
import type { GeoNamesOutputField } from '@/features/mapping/extensions/modules/nodes/geonames/client'

type MappingStore = ReturnType<typeof useMappingStore>
type DataStore = ReturnType<typeof useDataStore>

export function addGeoNamesNode(store: MappingStore, username = 'demo-user'): GeoNamesNodeConfig {
  return store.createExtensionNode<GeoNamesNodeConfig>(GEONAMES_NODE_STATE_KEY, 'geonames', id => ({
    id,
    username,
    selectedOutputs: ['name', 'id', 'lat', 'lng'] as GeoNamesOutputField[],
    status: 'idle',
    stats: { totalCount: 0, processedCount: 0, cachedCount: 0 },
    results: {},
  }))
}

export function geoNamesNodes(store: MappingStore): GeoNamesNodeConfig[] {
  return store.getExtensionState(GEONAMES_NODE_STATE_KEY, [] as GeoNamesNodeConfig[])
}

export function geoNamesUiEdges(store: MappingStore): GeoNamesUiEdge[] {
  return store.getExtensionState(GEONAMES_UI_EDGE_STATE_KEY, [] as GeoNamesUiEdge[])
}

export function upsertGeoNamesUiEdge(
  store: MappingStore,
  edge: GeoNamesUiEdge,
  dataStore?: DataStore,
  sources: DataSource[] = dataStore?.sources ?? [],
): void {
  store.upsertExtensionUiEdge(GEONAMES_UI_EDGE_STATE_KEY, edge)
  if (dataStore && edge.source.startsWith('geonames:') && edge.target.startsWith('shape:')) {
    syncGeoNamesShapeMappings(store, dataStore, edge.source, sources)
  }
}
