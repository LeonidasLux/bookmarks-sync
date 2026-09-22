import type { Palette } from '../palette'
import { font } from '../styles'

interface FieldLabelProps {
  /** 字段名，渲染为 `$ NAME` */
  name: string
  /** 必填标记 */
  required?: boolean
  /** 追加在字段名后的说明文案 */
  hint?: string
  colors: Palette
}

/** 设置项统一的字段标签 */
export function FieldLabel({ name, required, hint, colors }: FieldLabelProps) {
  return (
    <label
      style={{
        display: 'block',
        marginBottom: '0.375rem',
        fontSize: '12px',
        fontWeight: 500,
        color: colors.textMuted,
        fontFamily: font,
      }}
    >
      <span style={{ color: colors.accent }}>$</span> {name}
      {required && <span style={{ color: colors.orange }}> *</span>}
      {hint && (
        <span style={{ color: colors.textDim, fontWeight: 400, marginLeft: '0.375rem' }}>{hint}</span>
      )}
    </label>
  )
}
