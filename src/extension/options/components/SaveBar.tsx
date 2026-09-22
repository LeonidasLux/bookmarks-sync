import type { Palette } from '../palette'
import { font } from '../styles'

interface SaveBarProps {
  saved: boolean
  onSave: () => void
  colors: Palette
}

/** 底部保存按钮 + 保存反馈 */
export function SaveBar({ saved, onSave, colors }: SaveBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
      <button
        onClick={onSave}
        style={{
          padding: '8px 20px',
          border: `1px solid ${colors.accent}`,
          borderRadius: '6px',
          background: `${colors.accent}15`,
          color: colors.accent,
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: font,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = `${colors.accent}25` }}
        onMouseLeave={(e) => { e.currentTarget.style.background = `${colors.accent}15` }}
      >
        $ save
      </button>

      {saved && (
        <span style={{ color: colors.green, fontSize: '12px', fontFamily: font }}>
          <span style={{ color: colors.green }}>●</span> 已保存
        </span>
      )}
    </div>
  )
}
