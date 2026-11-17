import type { PropertyShape, ShaclProfile } from '@/domain/profiles'
import { Literal, NamedNode } from 'rdflib'

export const NUMERICAL_VARIABLE_PROFILE = 'https://w3id.org/nfdi4ing/profiles/70d2267e-369f-4aed-876d-82de8e9192db/'
export interface QuantityResource { iri: string; label: string }
export interface QuantityDefinition {
  name: string
  description: string
  path: string
  quantityKind: QuantityResource
  units: QuantityResource[]
  datatype: 'integer' | 'double'
  minimum: string
  maximum: string
  minCount: number
  maxCount: number | null
}
export function isQuantityIri(value: string): boolean {
  return /^https?:\/\/[^\s<>"{}|^`\\]+$/.test(value)
}
export function quantityDefinitionError(value: QuantityDefinition): string | null {
  if (!value.name.trim()) return 'Enter a parameter name.'
  if (!isQuantityIri(value.path)) return 'Enter a valid field IRI.'
  if (!isQuantityIri(value.quantityKind.iri)) return 'Select a quantity kind.'
  if (!value.units.length || value.units.some(unit => !isQuantityIri(unit.iri))) return 'Select at least one unit.'
  if (!['integer', 'double'].includes(value.datatype)) return 'Choose a numeric datatype.'
  for (const bound of [value.minimum, value.maximum]) {
    if (!bound.trim()) continue
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(bound.trim()) || !Number.isFinite(Number(bound))) return 'Bounds must be finite numbers.'
    if (value.datatype === 'integer' && !/^[+-]?\d+$/.test(bound.trim())) return 'Integer bounds must be whole numbers.'
  }
  if ((value.minimum.trim() || value.maximum.trim()) && value.units.length !== 1) return 'Select exactly one unit when using bounds.'
  if (value.minimum.trim() && value.maximum.trim() && Number(value.minimum) > Number(value.maximum)) return 'Minimum must not exceed maximum.'
  if (!Number.isSafeInteger(value.minCount) || value.minCount < 0 || (value.maxCount !== null && (!Number.isSafeInteger(value.maxCount) || value.maxCount < value.minCount))) return 'Enter valid minimum and maximum counts.'
  return null
}
export function buildQuantityProfile(iri: string, value: QuantityDefinition): ShaclProfile {
  const error = quantityDefinitionError(value)
  if (error) throw new Error(error)
  const m4i = 'http://w3id.org/nfdi4ing/metadata4ing#'
  const property = (key: string, name: string, path: string, order: number): PropertyShape => ({
    nodeId: new NamedNode(`${iri}#${key}`), name, nameLiterals: [{ value: name, lang: 'en' }], path: new NamedNode(path), order, minCount: 1, maxCount: 1,
  })
  const role = { ...property('role', 'Label', 'http://www.w3.org/2000/01/rdf-schema#label', 0), editorType: 'value' as const, hasValues: [new Literal(value.name.trim())] }
  const kind = { ...property('quantity-kind', 'Quantity kind', `${m4i}hasKindOfQuantity`, 1), editorType: 'value' as const, hasValues: [new NamedNode(value.quantityKind.iri)] }
  const numeric = { ...property('value', 'Numerical value', `${m4i}hasNumericalValue`, 2), editorType: 'datatype' as const, datatype: new NamedNode(`http://www.w3.org/2001/XMLSchema#${value.datatype}`), minInclusive: value.minimum.trim() || undefined, maxInclusive: value.maximum.trim() || undefined }
  const units = { ...property('unit', 'Unit', `${m4i}hasUnit`, 3), editorType: 'list' as const, allowedValues: [...new Set(value.units.map(unit => unit.iri))], allowedValueLabels: Object.fromEntries(value.units.map(unit => [unit.iri, [{ value: unit.label, lang: 'en' }]])) }
  return { iri, source: `${iri.split('/').pop()}.ttl`, origin: 'created', rawTurtle: '', imports: [NUMERICAL_VARIABLE_PROFILE], nodeShapes: [{ nodeId: new NamedNode(iri), sourceProfileIri: iri, label: value.name.trim(), labelLiterals: [{ value: value.name.trim(), lang: 'en' }], description: value.description, descriptionLiterals: value.description ? [{ value: value.description, lang: 'en' }] : [], inheritedShapeIris: [NUMERICAL_VARIABLE_PROFILE], properties: [role, kind, numeric, units] }] }
}
