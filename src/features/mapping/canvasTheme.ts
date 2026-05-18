export const CANVAS_EDGE_COLORS = {
  primary: '#111827',
  structural: '#d1d5db',
} as const

export const CANVAS_EDGE_STYLES = {
  primary: {
    stroke: CANVAS_EDGE_COLORS.primary,
    strokeWidth: 2,
  },
  primaryDashed: {
    stroke: CANVAS_EDGE_COLORS.primary,
    strokeWidth: 2,
    strokeDasharray: '8 4',
  },
  structural: {
    stroke: CANVAS_EDGE_COLORS.structural,
    strokeWidth: 2,
    strokeDasharray: '6 3',
  },
} as const

export const CANVAS_NODE_COLORS = {
  importer: {
    headerBackground: '#ecfdf5',
    headerColor: '#166534',
    subtleColor: '#15803d',
    previewBorderColor: 'rgba(22, 101, 52, 0.18)',
    handleColor: '#16a34a',
    borderColor: '#bbf7d0',
    accentBackground: '#ecfdf5',
    accentHoverBackground: '#d1fae5',
    badgeBackground: '#dcfce7',
    badgeBorderColor: '#bbf7d0',
    badgeColor: '#166534',
    codeBackground: 'rgba(255, 255, 255, 0.72)',
  },
  enricher: {
    headerBackground: '#e0f2fe',
    headerColor: '#0f4c81',
    subtleColor: '#0369a1',
    previewBorderColor: 'rgba(15, 76, 129, 0.18)',
    handleColor: '#0284c7',
    inputHandleColor: '#0ea5e9',
    outputHandleColor: '#0284c7',
  },
  transform: {
    headerBackground: '#fff7ed',
    headerColor: '#9a3412',
    subtleColor: '#c2410c',
    previewBorderColor: 'rgba(154, 52, 18, 0.18)',
    handleColor: '#c2410c',
    inputHandleColor: '#ea580c',
    outputHandleColor: '#c2410c',
  },
  shape: {
    headerBackground: '#eef2ff',
    headerColor: '#4338ca',
    subtleColor: '#4f46e5',
    previewBorderColor: 'rgba(67, 56, 202, 0.18)',
    handleColor: '#4f46e5',
    accentBackground: '#eef2ff',
    accentHoverBackground: '#e0e7ff',
    badgeBackground: '#e0e7ff',
    badgeBorderColor: '#c7d2fe',
    badgeColor: '#3730a3',
    inheritedBackground: '#f8fafc',
  },
} as const
