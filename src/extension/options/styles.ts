import type { CSSProperties } from 'react'
import type { Palette } from './palette'

/** 设置页统一等宽字体 */
export const font = '"JetBrains Mono", "SF Mono", "Fira Code", "Consolas", monospace'

/** 输入类控件的基础样式 */
export function inputStyle(colors: Palette): CSSProperties {
  return {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    background: colors.bg,
    color: colors.text,
    fontFamily: font,
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }
}

/** 聚焦时的高亮描边 */
export function focusGlow(colors: Palette): CSSProperties {
  return {
    borderColor: colors.accent,
    boxShadow: `0 0 0 3px ${colors.accentGlow}`,
  }
}

/**
 * 与 select 等表单控件并排的行内文字样式。
 * 表单控件的文字由浏览器按字体内容区垂直居中，若沿用全局 line-height: 1.6 的半行距，
 * CJK 文字的墨迹会被顶到偏上位置，与控件中部对不齐；normal 行高可消除这段偏移。
 */
export const controlLabelStyle: CSSProperties = { lineHeight: 'normal' }
