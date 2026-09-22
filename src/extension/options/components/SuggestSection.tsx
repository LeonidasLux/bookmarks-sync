import type { AppConfig } from '../../../shared/types'
import type { Palette } from '../palette'
import type { UpdateField } from '../types'
import { font } from '../styles'
import { FieldLabel } from './FieldLabel'
import { SectionCard } from './SectionCard'
import { SecretInput } from './SecretInput'

interface SuggestSectionProps {
  config: AppConfig
  updateField: UpdateField
  colors: Palette
}

/** TypeSafe Jev：保存书签时自动推荐目标目录 */
export function SuggestSection({ config, updateField, colors }: SuggestSectionProps) {
  return (
    <SectionCard title="书签智能推荐" icon="✨" colors={colors}>
      <FieldLabel name="TYPESAFE_API_KEY" hint="(可选)" colors={colors} />
      <SecretInput
        value={config.typesafeApiKey}
        onChange={(v) => updateField('typesafeApiKey', v)}
        colors={colors}
        placeholder="ts_..."
        ariaLabel="TYPESAFE_API_KEY"
        label="Key"
      />
      <p style={{ fontSize: '11px', color: colors.textDim, margin: '0.375rem 0 0', fontFamily: font }}>
        # 配置后，保存书签时由{' '}
        <a
          href="https://docs.typesafe.ai/primitives/choice"
          target="_blank"
          rel="noreferrer"
          style={{ color: colors.accent, textDecoration: 'none' }}
        >TypeSafe Jev</a>{' '}
        模型推荐目标目录（仍可在保存前手动改选）；留空则关闭该功能
      </p>
    </SectionCard>
  )
}
