import { ref } from 'vue'
import { refreshSourceGroup } from '@/features/mapping/mappingExtensionRegistry'
import type { useDataStore } from '@/stores/dataStore'

type DataStore = ReturnType<typeof useDataStore>

interface ToastLike {
  add(message: {
    severity: string
    summary: string
    detail?: string
    life?: number
  }): void
}

interface UseSourceGroupRefreshOptions {
  dataStore: DataStore
  toast: ToastLike
  readEdges: () => Array<{ id: string; style?: unknown }>
  writeEdges: (edges: Array<{ id: string; style?: unknown }>) => void
}

export function useSourceGroupRefresh(options: UseSourceGroupRefreshOptions) {
  const refreshingSourceGroups = ref<string[]>([])

  function sourceGroupKey(provider: string, groupId: string): string {
    return `${provider}:${groupId}`
  }

  function isRefreshingSourceGroup(provider: string, groupId: string): boolean {
    return refreshingSourceGroups.value.includes(sourceGroupKey(provider, groupId))
  }

  function setSourceGroupEdgeVisibility(provider: string, groupId: string, isVisible: boolean): void {
    const edgePrefix = `${provider}:${groupId}->`
    options.writeEdges(options.readEdges().map(edge => (
      edge.id.startsWith(edgePrefix)
        ? {
            ...edge,
            style: {
              ...(edge.style ?? {}),
              opacity: isVisible ? 1 : 0,
            },
          }
        : edge
    )))
  }

  async function refreshProviderSourceGroup(provider: string, groupId: string): Promise<void> {
    const key = sourceGroupKey(provider, groupId)
    if (isRefreshingSourceGroup(provider, groupId)) return

    refreshingSourceGroups.value = [...refreshingSourceGroups.value, key]
    try {
      const result = await refreshSourceGroup(provider, groupId, {
        dataStore: options.dataStore,
        toast: options.toast,
      })
      if (result) {
        options.toast.add({
          severity: 'success',
          summary: result.successSummary,
          detail: result.successDetail,
          life: 4000,
        })
      }
    } catch (err) {
      options.toast.add({
        severity: 'error',
        summary: 'Source refresh failed',
        detail: err instanceof Error ? err.message : String(err),
        life: 5000,
      })
    } finally {
      refreshingSourceGroups.value = refreshingSourceGroups.value.filter(item => item !== key)
    }
  }

  return {
    isRefreshingSourceGroup,
    refreshProviderSourceGroup,
    refreshingSourceGroups,
    setSourceGroupEdgeVisibility,
  }
}
