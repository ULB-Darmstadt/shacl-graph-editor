import { describe, expect, it } from 'vitest'
import { applyDefaultExtensionEdgeStyle } from '@/features/mapping/canvasGraphBuilders'

describe('canvasEdgeLabels', () => {
  it('suppresses relation badges for hidden extension helper edges', () => {
    const edge = applyDefaultExtensionEdgeStyle({
      id: 'airtable:hidden',
      source: 'hub:airtable',
      sourceHandle: 'airtable-out',
      target: 'src:table-1',
      targetHandle: 'table-parent',
      style: { opacity: 0 },
    })

    expect(edge.label).toBe('')
    expect(edge.data).toMatchObject({ relationLabel: '' })
  })
})