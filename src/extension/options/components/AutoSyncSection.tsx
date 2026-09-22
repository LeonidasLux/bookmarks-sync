import { DEFAULT_AUTO_SYNC_INTERVAL, type AppConfig } from '../../../shared/types'
import type { Palette } from '../palette'
import type { UpdateField } from '../types'
import { font } from '../styles'
import { SectionCard } from './SectionCard'
import { TextInput } from './TextInput'

interface AutoSyncSectionProps {
  config: AppConfig
  updateField: UpdateField
  colors: Palette
}

/** 解析间隔输入：留空 / 非法时回落到默认间隔，其余至少 1 分钟 */
function parseInterval(value: string): number {
  const minutes = Number(value)
  if (!value.trim() || Number.isNaN(minutes)) return DEFAULT_AUTO_SYNC_INTERVAL
  return Math.max(1, Math.floor(minutes))
}

/** 定时同步配置 */
export function AutoSyncSection({ config, updateField, colors }: AutoSyncSectionProps) {
  const enabled = config.autoSyncInterval > 0

  return (
    <SectionCard title="定时同步" icon="⚡" colors={colors}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '13px' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => updateField('autoSyncInterval', e.target.checked ? DEFAULT_AUTO_SYNC_INTERVAL : 0)}
          style={{ accentColor: colors.accent }}
        />
        <span style={{ fontWeight: 500 }}>启用定时同步</span>
      </label>

      {enabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.625rem 0 0.5rem' }}>
          <span style={{ fontSize: '12px', color: colors.textMuted }}>间隔</span>
          <TextInput
            type="number"
            value={String(config.autoSyncInterval)}
            onChange={(v) => updateField('autoSyncInterval', parseInterval(v))}
            colors={colors}
            ariaLabel="同步间隔（分钟）"
            style={{ width: 96 }}
          />
          <span style={{ fontSize: '12px', color: colors.textMuted }}>分钟</span>
        </div>
      )}

      <p style={{ fontSize: '11px', color: colors.textDim, margin: enabled ? 0 : '0.25rem 0 0 1.5rem', fontFamily: font }}>
        # 每隔固定时间自动把本地书签推送到远程同步文件，保存后生效
      </p>
    </SectionCard>
  )
}
