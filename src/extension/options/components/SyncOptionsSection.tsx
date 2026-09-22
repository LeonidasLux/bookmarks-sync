import type { AppConfig } from '../../../shared/types'
import type { Palette } from '../palette'
import type { UpdateField } from '../types'
import { font } from '../styles'
import { SectionCard } from './SectionCard'

interface SyncOptionsSectionProps {
  config: AppConfig
  updateField: UpdateField
  colors: Palette
}

/** 同步行为选项 */
export function SyncOptionsSection({ config, updateField, colors }: SyncOptionsSectionProps) {
  return (
    <SectionCard title="同步行为" icon="🔀" colors={colors}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '13px' }}>
        <input
          type="checkbox"
          checked={config.cleanEmptyFolders}
          onChange={(e) => updateField('cleanEmptyFolders', e.target.checked)}
          style={{ accentColor: colors.accent }}
        />
        <span style={{ fontWeight: 500 }}>应用差异后自动清理空文件夹</span>
      </label>
      <p style={{ fontSize: '11px', color: colors.textDim, margin: '0.25rem 0 0 1.5rem', fontFamily: font }}>
        # 删除或移走书签后，若原文件夹变空则自动删除该文件夹
      </p>
    </SectionCard>
  )
}
