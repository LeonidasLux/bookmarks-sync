import { useState, type CSSProperties } from 'react'
import type { Palette } from '../palette'
import { focusGlow, inputStyle } from '../styles'

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  colors: Palette
  type?: string
  placeholder?: string
  ariaLabel?: string
  style?: CSSProperties
}

/** 带聚焦高亮的文本 / 数字输入框 */
export function TextInput({
  value,
  onChange,
  colors,
  type = 'text',
  placeholder,
  ariaLabel,
  style,
}: TextInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle(colors),
        ...(focused ? focusGlow(colors) : {}),
        ...style,
      }}
    />
  )
}
