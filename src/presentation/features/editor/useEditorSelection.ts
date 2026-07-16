import { computed, ref } from 'vue'
import type { NodeShape, PropertyShape, ShaclProfile } from '@/domain/profiles'

interface EditorSelectionOptions {
  profiles: () => ShaclProfile[]
  allShapes: () => NodeShape[]
}

export function useEditorSelection(options: EditorSelectionOptions) {
  const selectedShapeIri = ref<string | null>(null)
  const selectedPropertyKey = ref<string | null>(null)

  const selectedShape = computed(() => {
    if (!selectedShapeIri.value) return null
    return options.allShapes().find(shape => shape.nodeId.value === selectedShapeIri.value) ?? null
  })

  const selectedProperty = computed<PropertyShape | null>(() => {
    if (!selectedShape.value || !selectedPropertyKey.value) return null
    return selectedShape.value.properties.find(property => propertyKey(property) === selectedPropertyKey.value) ?? null
  })

  const selectedProfile = computed(() => {
    if (!selectedShape.value?.sourceProfileIri) return null
    return options.profiles().find(profile => profile.iri === selectedShape.value?.sourceProfileIri) ?? null
  })

  function selectShape(shape: NodeShape): void {
    selectedShapeIri.value = shape.nodeId.value
    selectedPropertyKey.value = null
  }

  function selectProperty(shape: NodeShape, property: PropertyShape): void {
    selectedShapeIri.value = shape.nodeId.value
    selectedPropertyKey.value = propertyKey(property)
  }

  function clearSelection(): void {
    selectedShapeIri.value = null
    selectedPropertyKey.value = null
  }

  return {
    selectedShapeIri,
    selectedPropertyKey,
    selectedShape,
    selectedProperty,
    selectedProfile,
    selectShape,
    selectProperty,
    clearSelection,
  }
}

function propertyKey(property: PropertyShape): string {
  return property.nodeId.value
}
