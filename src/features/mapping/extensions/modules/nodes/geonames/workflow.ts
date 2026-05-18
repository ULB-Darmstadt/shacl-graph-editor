import type { DataSource } from '@/domain/DataSource'
import type { GeoNamesNodeConfig, GeoNamesUiEdge } from '@/features/mapping/extensions/modules/nodes/geonames/types'
import type { TransformationUiEdge } from '@/features/mapping/extensions/modules/nodes/lat-lng-to-wkt/types'
import type { MappingExtensionStoreApi } from '@/features/mapping/extensions/core/types'
import {
  getExtensionInputEdge,
  getExtensionNode,
  getExtensionUiEdges,
} from '@/features/mapping/extensions/core/stateHelpers'
import type { GeoNamesOutputField } from '@/features/mapping/extensions/modules/nodes/geonames/client'
import { runGeoNamesRuntime } from '@/features/mapping/extensions/modules/nodes/geonames/runtime'
import { getDependentTransformationNodeIds } from '@/services/mapping/mappingEdgeSync'
import type { useMappingStore } from '@/stores/mappingStore'
import type { useDataStore } from '@/stores/dataStore'
import { applyGeoNamesNodePatch, syncGeoNamesNodeMappings } from '@/features/mapping/extensions/modules/nodes/geonames/mapping'
import { materializeEnrichmentOutputSource } from '@/services/mapping/enrichmentRuntime'

type MappingStore = ReturnType<typeof useMappingStore>
type DataStore = ReturnType<typeof useDataStore>
type GeoNamesReadStore = Pick<MappingExtensionStoreApi, 'findExtensionNode' | 'getExtensionState'>
type GeoNamesMutationStore = GeoNamesReadStore & Pick<MappingStore, 'updateExtensionNode' | 'setExtensionState' | 'state'>
type GeoNamesRuntimeStore = GeoNamesMutationStore & Pick<MappingStore, 'syncTransformationMappings'>

export const GEONAMES_NODE_STATE_KEY = 'node.geonames.nodes'
export const GEONAMES_UI_EDGE_STATE_KEY = 'node.geonames.uiEdges'

export function getGeoNamesNode(mappingStore: GeoNamesReadStore, nodeId: string): GeoNamesNodeConfig | undefined {
  return getExtensionNode<GeoNamesNodeConfig>(mappingStore, GEONAMES_NODE_STATE_KEY, nodeId)
}

export function getGeoNamesUiEdges(mappingStore: GeoNamesReadStore): GeoNamesUiEdge[] {
  return getExtensionUiEdges<GeoNamesUiEdge>(mappingStore, GEONAMES_UI_EDGE_STATE_KEY)
}

export function getGeoNamesInputEdge(mappingStore: GeoNamesReadStore, nodeId: string): GeoNamesUiEdge | undefined {
  return getExtensionInputEdge<GeoNamesUiEdge>(mappingStore, GEONAMES_UI_EDGE_STATE_KEY, nodeId, 'geo-input')
}

export function materializeGeoNamesOutputSource(
  mappingStore: GeoNamesReadStore,
  dataStore: DataStore,
  nodeId: string,
  sources: DataSource[],
): string | undefined {
  const node = getGeoNamesNode(mappingStore, nodeId)
  if (!node?.inputSourceId || !node.inputHeader) return node?.outputSourceId
  const source = sources.find(candidate => candidate.id === node.inputSourceId)
  if (!source) return node.outputSourceId
  const outputSourceId = materializeEnrichmentOutputSource({
    source,
    inputHeader: node.inputHeader,
    results: node.results,
    fields: node.selectedOutputs,
    readField: (feature, output) => feature?.[output as GeoNamesOutputField] ?? '',
    addResultSource: (headers, rows, recordIds) =>
      dataStore.addNodeOutputSource('geonames', nodeId, headers as GeoNamesOutputField[], rows, recordIds),
  })
  if (!outputSourceId) return node.outputSourceId

  if (node.outputSourceId !== outputSourceId) {
    updateGeoNamesNode(mappingStore as GeoNamesMutationStore, dataStore, nodeId, { outputSourceId })
  }

  return outputSourceId
}

export function syncGeoNamesShapeMappings(
  mappingStore: GeoNamesMutationStore,
  dataStore: DataStore,
  nodeId: string,
  sources: DataSource[] = dataStore.sources,
): void {
  const outputSourceId = materializeGeoNamesOutputSource(mappingStore, dataStore, nodeId, sources)
  const uiEdges = getGeoNamesUiEdges(mappingStore)
  mappingStore.state.edges = syncGeoNamesNodeMappings(mappingStore.state.edges, nodeId, outputSourceId, uiEdges)
}

export function updateGeoNamesNode(
  mappingStore: GeoNamesMutationStore,
  dataStore: DataStore,
  nodeId: string,
  patch: Partial<Omit<GeoNamesNodeConfig, 'id'>>,
): void {
  mappingStore.updateExtensionNode<GeoNamesNodeConfig>(GEONAMES_NODE_STATE_KEY, nodeId, node => {
    const { nextNode, nextEdges } = applyGeoNamesNodePatch(node, patch, getGeoNamesUiEdges(mappingStore))

    if (patch.selectedOutputs) {
      mappingStore.setExtensionState(GEONAMES_UI_EDGE_STATE_KEY, nextEdges)
      syncGeoNamesShapeMappings(mappingStore, dataStore, nodeId)
    }

    return nextNode
  })
}

export async function runGeoNamesNode(
  mappingStore: GeoNamesRuntimeStore,
  dataStore: DataStore,
  nodeId: string,
  sources: DataSource[],
  forceRefresh = false,
): Promise<void> {
  const node = getGeoNamesNode(mappingStore, nodeId)
  if (!node) throw new Error('GeoNames node not found.')
  const inputEdge = getGeoNamesInputEdge(mappingStore, nodeId)
  if (!inputEdge) throw new Error('Connect a source column to the GeoNames input first.')

  const sourceId = inputEdge.source.startsWith('src:') ? inputEdge.source.slice(4) : ''
  const sourceHeader = inputEdge.sourceHandle.startsWith('h:') ? inputEdge.sourceHandle.slice(2) : ''

  updateGeoNamesNode(mappingStore, dataStore, nodeId, {
    status: 'running',
    stats: { totalCount: 0, processedCount: 0, cachedCount: 0, lastError: undefined },
  })

  try {
    const batch = await runGeoNamesRuntime({
      nodeId,
      username: node.username,
      selectedOutputs: node.selectedOutputs,
      inputSourceId: sourceId,
      inputHeader: sourceHeader,
      sources,
      forceRefresh,
      onProgress: progress => {
        updateGeoNamesNode(mappingStore, dataStore, nodeId, {
          status: 'running',
          stats: {
            totalCount: progress.totalCount,
            processedCount: progress.processedCount,
            cachedCount: progress.cachedCount,
          },
        })
      },
      addResultSource: (resultNodeId, headers, rows, recordIds) =>
        dataStore.addNodeOutputSource('geonames', resultNodeId, headers as GeoNamesOutputField[], rows, recordIds),
    })

    updateGeoNamesNode(mappingStore, dataStore, nodeId, {
      inputSourceId: batch.inputSourceId,
      inputHeader: batch.inputHeader,
      outputSourceId: batch.outputSourceId,
      status: 'success',
      results: batch.results,
      stats: {
        totalCount: batch.totalCount,
        processedCount: batch.processedCount,
        cachedCount: batch.cachedCount,
        lastRunAt: new Date().toISOString(),
        lastError: undefined,
      },
    })
    syncGeoNamesShapeMappings(mappingStore, dataStore, nodeId, sources)

    const transformationUiEdges = mappingStore.getExtensionState('node.transformation.uiEdges', [] as TransformationUiEdge[])
    for (const transformId of getDependentTransformationNodeIds(nodeId, transformationUiEdges)) {
      mappingStore.syncTransformationMappings(transformId, sources)
    }
  } catch (error) {
    updateGeoNamesNode(mappingStore, dataStore, nodeId, {
      status: 'error',
      stats: {
        ...node.stats,
        lastError: error instanceof Error ? error.message : String(error),
      },
    })
    throw error
  }
}


