export type CanvasSelectionMode = 'replace' | 'add' | 'remove'
export function combineCanvasSelection(previous: ReadonlySet<string>, hits: ReadonlySet<string>, mode: CanvasSelectionMode): Set<string> {
  if (mode === 'replace') return new Set(hits)
  const result = new Set(previous)
  for (const id of hits) { if (mode === 'add') result.add(id); else result.delete(id) }
  return result
}
