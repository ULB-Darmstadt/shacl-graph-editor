/**
 * Auto-Matcher
 *
 * Suggests CSV-column → SHACL-property mappings using normalised
 * Levenshtein similarity. Returns suggestions ordered by confidence.
 */
import type { NodeShape } from '@/domain/NodeShape'
import { classifyShape } from '@/domain/NodeShape'
import type { DataSource } from '@/domain/DataSource'
import type { MappingEdge } from '@/domain/Mapping'
import { detectLinkedColumns } from '@/services/linkDetector'

export interface SuggestedMapping extends MappingEdge {
  /** Similarity score 0..1 (1 = perfect match). */
  confidence: number
  /** Human-readable property label used for display. */
  propertyLabel: string
  /** Human-readable shape label. */
  shapeLabel: string
}

/** Minimum similarity score required to emit a suggestion. */
const MIN_CONFIDENCE = 0.45

// ---------------------------------------------------------------------------
// Levenshtein distance (iterative, O(m·n))
// ---------------------------------------------------------------------------
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1).fill(0)
    row[0] = i
    return row
  })
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/** Similarity ∈ [0,1]: 1 = identical, 0 = completely different. */
function similarity(a: string, b: string): number {
  if (a === b) return 1
  const dist = levenshtein(a, b)
  return 1 - dist / Math.max(a.length, b.length, 1)
}

// ---------------------------------------------------------------------------
// Name normalisation
// ---------------------------------------------------------------------------
function normalize(s: string): string {
  // 1. Extract local name from IRI
  const local = s.split(/[/#]/).filter(Boolean).pop() ?? s
  // 2. camelCase / PascalCase → words
  const words = local
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .toLowerCase()
    .trim()
  return words
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function suggestMappings(
  sources: DataSource[],
  shapes: NodeShape[],
): SuggestedMapping[] {
  const suggestions: SuggestedMapping[] = []

  const canvasShapes = shapes.filter(ns => {
    const k = classifyShape(ns)
    return k === 'data' || k === 'reference'
  })

  // Pre-compute linked-record info per source for FK matching
  const linkedColsBySource = new Map<string, Set<string>>()
  for (const src of sources) {
    const linked = detectLinkedColumns(src, sources)
    linkedColsBySource.set(src.id, new Set(linked.map(l => l.header)))
  }

  for (const shape of canvasShapes) {
    const sLabel = shape.label ?? normalize(shape.nodeId.value)

    for (const p of shape.properties) {
      if (!p.path) continue
      const isFkProp = Boolean(p.node)
      const pNorm = normalize(p.name ?? p.path.value)
      const pLabel = p.name ?? (p.path.value.split(/[/#]/).filter(Boolean).pop() ?? '')

      let best: { src: DataSource; header: string; score: number } | null = null

      for (const src of sources) {
        const linkedSet = linkedColsBySource.get(src.id) ?? new Set()
        for (const header of src.headers) {
          const headerIsLinked = linkedSet.has(header)
          // Type compatibility: FK property must match linked-record column;
          // literal property must match non-linked column. Skip mismatches.
          if (isFkProp && !headerIsLinked) continue
          if (!isFkProp && headerIsLinked) continue

          const hNorm = normalize(header)
          let score = Math.max(
            similarity(pNorm, hNorm),
            similarity(pNorm.replace(normalize(sLabel), '').trim(), hNorm),
          )
          // Bonus when both are FK and shape's targetClass name matches header
          if (isFkProp && p.node) {
            const refLocal = normalize(p.node.value)
            score = Math.max(score, similarity(refLocal, hNorm))
          }
          if (!best || score > best.score) {
            best = { src, header, score }
          }
        }
      }

      if (best && best.score >= MIN_CONFIDENCE) {
        suggestions.push({
          sourceId: best.src.id,
          sourceHeader: best.header,
          shapeIri: shape.nodeId.value,
          propertyPath: p.path.value,
          confidence: best.score,
          propertyLabel: pLabel,
          shapeLabel: sLabel,
        })
      }
    }
  }

  // Sort by confidence descending
  return suggestions.sort((a, b) => b.confidence - a.confidence)
}
