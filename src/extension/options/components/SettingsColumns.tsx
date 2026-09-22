import type { CSSProperties, ReactNode } from 'react'

interface SettingsColumnsProps {
  left: ReactNode
  right: ReactNode
}

const columnStyle: CSSProperties = {
  flex: '1 1 380px',
  minWidth: 320,
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
}

/**
 * 设置项双列排布：宽屏并排两列，窄屏自动回落为单列。
 * 左右两列顶层均为 flex 纵列，保证卡片间距一致。
 */
export function SettingsColumns({ left, right }: SettingsColumnsProps) {
  return (
    <div
      data-testid="settings-columns"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: '1.25rem',
      }}
    >
      <div data-testid="settings-column-left" style={columnStyle}>{left}</div>
      <div data-testid="settings-column-right" style={columnStyle}>{right}</div>
    </div>
  )
}
