import { useState } from 'react'
import { useTheme } from '../theme'

interface UnconfiguredViewProps {
  onOpenOptions: () => void
}

/**
 * 未配置仓库连接时的内联提示条。
 * 书签浏览 / 保存等本地功能仍然可用，仅推送、拉取等依赖远程配置的功能禁用。
 */
export function UnconfiguredView({ onOpenOptions }: UnconfiguredViewProps) {
  const { colors, fonts } = useTheme()
  const [btnHover, setBtnHover] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        textAlign: 'left',
        padding: '6px 8px',
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        background: colors.surface,
        marginBottom: 8,
        fontFamily: fonts.mono,
        fontSize: '11px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ color: colors.textMuted, fontSize: '12px', fontFamily: fonts.mono }}>
          <span style={{ color: colors.orange }}>⚠</span> 请先配置 GitHub 仓库连接
        </span>
        <span style={{ fontSize: '11px', color: colors.textDim, fontFamily: fonts.mono }}>
          $ 推送 / 拉取已禁用，需要 GitHub Token、仓库 Owner 和名称
        </span>
      </div>
      <button
        onClick={onOpenOptions}
        style={{
          padding: '4px 12px',
          border: `1px solid ${btnHover ? colors.accent : colors.border}`,
          borderRadius: '6px',
          background: btnHover ? `${colors.accent}15` : colors.surface,
          color: btnHover ? colors.accent : colors.textMuted,
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: fonts.mono,
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
      >
        $ cd setup
      </button>
    </div>
  )
}
