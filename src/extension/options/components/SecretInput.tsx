import { useState } from 'react'
import type { Palette } from '../palette'
import { focusGlow, inputStyle } from '../styles'

interface SecretInputProps {
  value: string
  onChange: (value: string) => void
  colors: Palette
  placeholder?: string
  ariaLabel?: string
  /** 显隐按钮的 title 文案前缀，如 Token / Key */
  label?: string
}

/** 密钥输入框：默认隐藏，可切换明文显示 */
export function SecretInput({
  value,
  onChange,
  colors,
  placeholder,
  ariaLabel,
  label = 'Token',
}: SecretInputProps) {
  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputStyle(colors),
          paddingRight: 40,
          ...(focused ? focusGlow(colors) : {}),
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        style={{
          position: 'absolute',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 6px',
          color: colors.textMuted,
          fontSize: '14px',
          lineHeight: 1,
        }}
        title={visible ? `隐藏 ${label}` : `显示 ${label}`}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  )
}
