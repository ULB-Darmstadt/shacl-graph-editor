import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'
import { useDataStore } from './dataStore'
import { useShapesStore } from './shapesStore'
import { useMappingStore } from './mappingStore'

export const useProjectStore = defineStore('project', () => {
  const data = useDataStore()
  const shapes = useShapesStore()
  const mapping = useMappingStore()

  const project = reactive({
    title: 'Untitled dataset',
    createdAt: new Date().toISOString(),
    get hasShapes() { return shapes.hasShapes },
    get hasData() { return data.sources.length > 0 },
    get hasMapping() { return mapping.state.hasMappings },
  })

  const summary = computed(() => ({
    profiles: shapes.profiles.length,
    nodeShapes: shapes.nodeShapes.length,
    sources: data.sources.length,
    mappings: mapping.state.edges.length,
  }))

  function reset() {
    data.reset()
    shapes.reset()
    mapping.reset()
    project.title = 'Untitled dataset'
    project.createdAt = new Date().toISOString()
  }

  return { project, summary, reset }
})
