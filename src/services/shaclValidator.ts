/**
 * SHACL Constraint Validator
 *
 * Validates a mapping + data against the PropertyShape constraints
 * (minCount, maxCount, sh:pattern, sh:datatype) without requiring
 * a full SHACL engine dependency.
 *
 * The validation runs on raw source rows, not on the generated RDF,
 * so violations include row-level context for easy debugging.
 */
import type { ApplicationProfile, NodeShape, PropertyShape } from '@/domain/NodeShape'
import { classifyShape } from '@/domain/NodeShape'
import type { MappingState } from '@/domain/Mapping'
import type { DataSource } from '@/domain/DataSource'

export type ViolationSeverity = 'error' | 'warning' | 'info'

export interface ValidationViolation {
  severity: ViolationSeverity
  shapeIri: string
  shapeLabel: string
  propertyPath: string
  propertyLabel: string
  message: string
  /** Which row (0-based) triggered this violation. -1 = structural (not row-specific). */
  rowIndex: number
}

export interface ValidationResult {
  violations: ValidationViolation[]
  readonly isValid: boolean
  readonly errorCount: number
  readonly warningCount: number
}

function makeResult(violations: ValidationViolation[]): ValidationResult {
  return {
    violations,
    get isValid() { return violations.every(v => v.severity !== 'error') },
    get errorCount() { return violations.filter(v => v.severity === 'error').length },
    get warningCount() { return violations.filter(v => v.severity === 'warning').length },
  }
}

function shapeLabel(ns: NodeShape): string {
  return ns.label ?? ns.nodeId.value.split(/[/#]/).filter(Boolean).pop() ?? ns.nodeId.value
}

function propLabel(p: PropertyShape): string {
  return p.name ?? p.path?.value.split(/[/#]/).filter(Boolean).pop() ?? ''
}

/** XSD datatype validation patterns */
const DATATYPE_CHECKS: Record<string, (v: string) => boolean> = {
  'http://www.w3.org/2001/XMLSchema#integer': v => /^-?\d+$/.test(v.trim()),
  'http://www.w3.org/2001/XMLSchema#decimal': v => /^-?\d+(\.\d+)?$/.test(v.trim()),
  'http://www.w3.org/2001/XMLSchema#double': v => !isNaN(Number(v.trim())) && v.trim() !== '',
  'http://www.w3.org/2001/XMLSchema#float': v => !isNaN(Number(v.trim())) && v.trim() !== '',
  'http://www.w3.org/2001/XMLSchema#boolean': v => /^(true|false|0|1)$/i.test(v.trim()),
  'http://www.w3.org/2001/XMLSchema#date': v => /^\d{4}-\d{2}-\d{2}$/.test(v.trim()),
  'http://www.w3.org/2001/XMLSchema#dateTime': v => !isNaN(Date.parse(v.trim())),
  'http://www.w3.org/2001/XMLSchema#anyURI': v => { try { new URL(v.trim()); return true } catch { return false } },
}

export function validateMapping(
  ap: ApplicationProfile,
  mapping: MappingState,
  sources: DataSource[],
): ValidationResult {
  const violations: ValidationViolation[] = []
  const sourceMap = new Map(sources.map(s => [s.id, s]))

  for (const shape of ap.allNodeShapes()) {
    if (classifyShape(shape) === 'form') continue

    const sLabel = shapeLabel(shape)
    const sIri = shape.nodeId.value
    const edges = mapping.forShape(sIri)

    // --- Structural checks (row-independent) ---
    for (const p of shape.properties) {
      if (!p.path || p.node) continue // skip FK refs
      const pLabel = propLabel(p)
      const minCount = p.minCount ?? 0

      const edge = edges.find(e => e.propertyPath === p.path!.value)
      if (!edge && minCount > 0) {
        violations.push({
          severity: 'warning',
          shapeIri: sIri,
          shapeLabel: sLabel,
          propertyPath: p.path.value,
          propertyLabel: pLabel,
          message: `Pflichtfeld (sh:minCount ${minCount}) ist nicht gemappt.`,
          rowIndex: -1,
        })
      }
    }

    if (edges.length === 0) continue

    // --- Row-level checks ---
    const sourceId = edges[0].sourceId
    const source = sourceMap.get(sourceId)
    if (!source) continue

    for (let rowIdx = 0; rowIdx < source.rows.length; rowIdx++) {
      const row = source.rows[rowIdx]

      for (const edge of edges) {
        const p = shape.properties.find(ps => ps.path?.value === edge.propertyPath)
        if (!p?.path) continue

        const headerIdx = source.headers.indexOf(edge.sourceHeader)
        if (headerIdx < 0) continue

        const raw = row[headerIdx]
        const isEmpty = raw === null || raw === undefined || String(raw).trim() === ''
        const pLabel = propLabel(p)
        const minCount = p.minCount ?? 0

        // minCount violation
        if (isEmpty && minCount > 0) {
          violations.push({
            severity: 'error',
            shapeIri: sIri,
            shapeLabel: sLabel,
            propertyPath: p.path.value,
            propertyLabel: pLabel,
            message: `Zeile ${rowIdx + 1}: Pflichtfeld leer (sh:minCount ${minCount}).`,
            rowIndex: rowIdx,
          })
          continue
        }

        if (isEmpty) continue
        const val = String(raw).trim()

        // maxCount violation (only for single-value, not split-comma)
        const maxCount = p.maxCount
        if (maxCount !== undefined && maxCount === 1 && edge.transform === 'split-comma') {
          const parts = val.split(',').filter(s => s.trim())
          if (parts.length > 1) {
            violations.push({
              severity: 'error',
              shapeIri: sIri,
              shapeLabel: sLabel,
              propertyPath: p.path.value,
              propertyLabel: pLabel,
              message: `Zeile ${rowIdx + 1}: sh:maxCount 1, aber Spalte enthält ${parts.length} Werte (Komma-getrennt).`,
              rowIndex: rowIdx,
            })
          }
        }

        // sh:pattern check
        if (p.pattern) {
          try {
            if (!new RegExp(p.pattern).test(val)) {
              violations.push({
                severity: 'error',
                shapeIri: sIri,
                shapeLabel: sLabel,
                propertyPath: p.path.value,
                propertyLabel: pLabel,
                message: `Zeile ${rowIdx + 1}: Wert "${val.slice(0, 40)}" entspricht nicht sh:pattern ${p.pattern}.`,
                rowIndex: rowIdx,
              })
            }
          } catch { /* invalid regex — skip */ }
        }

        // sh:datatype check
        if (p.datatype) {
          const checker = DATATYPE_CHECKS[p.datatype.value]
          if (checker && !checker(val)) {
            violations.push({
              severity: 'error',
              shapeIri: sIri,
              shapeLabel: sLabel,
              propertyPath: p.path.value,
              propertyLabel: pLabel,
              message: `Zeile ${rowIdx + 1}: "${val.slice(0, 40)}" ist kein gültiger Wert für ${p.datatype.value.split('#').pop()}.`,
              rowIndex: rowIdx,
            })
          }
        }
      }
    }
  }

  return makeResult(violations)
}
