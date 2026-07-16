import type { NodeShape } from '@/domain/profiles/model'
import { propertyHasDirectValueSemantics, propertyNodeTargets } from '@/shared/rdf/propertyConstraints'

export type ShapeKind = 'data' | 'reference' | 'form'

const FORM_TARGET_CLASSES = new Set([
  'http://www.w3.org/ns/dcat#Dataset',
  'http://www.w3.org/ns/dcat#Catalog',
  'http://rdfs.org/ns/void#Dataset',
  'http://www.w3.org/2000/01/rdf-schema#Class',
])

export function classifyShape(shape: NodeShape): ShapeKind {
  if (shape.targetClass && FORM_TARGET_CLASSES.has(shape.targetClass.value)) return 'form'

  const hasDirectValueProp = shape.properties.some(property => property.path && propertyHasDirectValueSemantics(property))
  if (hasDirectValueProp) return 'data'

  const hasFkProp = shape.properties.some(property => propertyNodeTargets(property).length > 0)
  if (hasFkProp) return 'reference'

  return 'data'
}
