import type { Palette } from '../palette'
import { controlLabelStyle, focusGlow, inputStyle } from '../styles'

interface ThemeSelectorProps {
  value: 'dark' | 'light' | 'system'
  onChange: (value: 'dark' | 'light' | 'system') => void
  colors: Palette
}

const OPTIONS: Array<{ value: ThemeSelectorProps['value']; label: string }> = [
  { value: 'system', label: '🌓 跟随系统' },
  { value: 'dark', label: '🌙 暗色' },
  { value: 'light', label: '☀️ 亮色' },
]

/** 主题选择器（设置页标题栏右侧） */
export function ThemeSelector({ value, onChange, colors }: ThemeSelectorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '12px', color: colors.textMuted, ...controlLabelStyle }}>
        <span style={{ color: colors.accent }}>$</span> 主题
      </span>
      <select
        aria-label="主题"
        value={value}
        onChange={(e) => onChange(e.target.value as ThemeSelectorProps['value'])}
        style={{
          ...inputStyle(colors),
          width: 'auto',
          minWidth: 150,
          padding: '6px 10px',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: 'none',
        }}
        onFocus={(e) => Object.assign(e.currentTarget.style, focusGlow(colors))}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = colors.border
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}
