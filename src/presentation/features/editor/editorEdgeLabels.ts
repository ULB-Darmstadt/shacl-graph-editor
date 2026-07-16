import type { PropertyShape } from '@/domain/profiles'
import { propertyRelationshipKinds } from '@/domain/profiles'
import { EDITOR_EDGE_STYLES } from '@/presentation/features/editor/editorGraphTheme'

export type EditorEdgeKind = 'structural' | 'inherited'

export function propertyRelationshipLabel(property: PropertyShape): string {
  const relationshipKinds = propertyRelationshipKinds(property)
  return relationshipKinds.length > 0 ? relationshipKinds.join(' · ') : ''
}

export function applyDefaultEditorEdgeStyle<T extends { style?: unknown }>(edge: T): T {
  return {
    ...edge,
    style: edge.style ?? EDITOR_EDGE_STYLES.structural,
  }
}
