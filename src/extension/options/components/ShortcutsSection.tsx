import type { Palette } from '../palette'
import type { CommandInfo } from '../hooks/useCommands'
import { font } from '../styles'
import { SectionCard } from './SectionCard'

interface ShortcutsSectionProps {
  commands: CommandInfo[]
  colors: Palette
}

/** 扩展快捷键一览 */
export function ShortcutsSection({ commands, colors }: ShortcutsSectionProps) {
  return (
    <SectionCard title="快捷键" icon="⌨" colors={colors}>
      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', fontFamily: font }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
            <th style={{ textAlign: 'left', padding: '0.375rem 0.5rem', fontWeight: 500, color: colors.textMuted }}>功能</th>
            <th style={{ textAlign: 'left', padding: '0.375rem 0.5rem', fontWeight: 500, color: colors.textMuted }}>快捷键</th>
          </tr>
        </thead>
        <tbody>
          {commands.map((cmd) => (
            <tr key={cmd.name}>
              <td style={{ padding: '0.375rem 0.5rem', color: colors.text }}>{cmd.description || cmd.name}</td>
              <td style={{ padding: '0.375rem 0.5rem' }}>
                <kbd style={{
                  padding: '2px 8px',
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: cmd.shortcut ? colors.accent : colors.textDim,
                  fontFamily: font,
                }}>
                  {cmd.shortcut || '未设置'}
                </kbd>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '11px', color: colors.textDim, margin: '0.5rem 0 0', fontFamily: font }}>
        # 在{' '}
        <a
          href="chrome://extensions/shortcuts"
          target="_blank"
          style={{ color: colors.accent, textDecoration: 'none' }}
        >chrome://extensions/shortcuts</a>{' '}
        页面可自定义快捷键
      </p>
    </SectionCard>
  )
}
