// 暗色 / 亮色 调色板（设置页全局共用）
export const palettes = {
  dark: {
    bg: '#0d1117',
    surface: '#161b22',
    border: '#30363d',
    borderLight: '#21262d',
    text: '#e6edf3',
    textMuted: '#8b949e',
    textDim: '#6e7681',
    accent: '#3dd6c8',
    accentGlow: 'rgba(61, 214, 200, 0.15)',
    green: '#3fb950',
    orange: '#d29922',
    scrollbar: '#30363d',
    scrollbarHover: '#484f58',
  },
  light: {
    bg: '#ffffff',
    surface: '#f6f8fa',
    border: '#d8dee4',
    borderLight: '#e8ecf0',
    text: '#1f2328',
    textMuted: '#656d76',
    textDim: '#8b949e',
    accent: '#0d9488',
    accentGlow: 'rgba(13, 148, 136, 0.1)',
    green: '#1a7f37',
    orange: '#9a6700',
    scrollbar: '#cdd5dd',
    scrollbarHover: '#a9b3bd',
  },
}

export type Palette = (typeof palettes)[keyof typeof palettes]
