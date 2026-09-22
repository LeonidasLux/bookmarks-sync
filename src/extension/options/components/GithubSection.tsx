import type { AppConfig } from '../../../shared/types'
import type { Palette } from '../palette'
import type { UpdateField } from '../types'
import { font } from '../styles'
import { FieldLabel } from './FieldLabel'
import { SectionCard } from './SectionCard'
import { SecretInput } from './SecretInput'
import { TextInput } from './TextInput'

interface GithubSectionProps {
  config: AppConfig
  updateField: UpdateField
  colors: Palette
}

const hintStyle = (color: string): React.CSSProperties => ({
  fontSize: '11px',
  color,
  margin: '0.25rem 0 0 0',
  fontFamily: font,
  wordBreak: 'break-all',
})

/** GitHub 后端连接配置：Token / 仓库所有者 / 仓库名 */
export function GithubSection({ config, updateField, colors }: GithubSectionProps) {
  const repoName = config.repoName || 'my-bookmarks'

  return (
    <SectionCard title="GitHub 仓库" icon="🐙" colors={colors}>
      <div style={{ marginBottom: '1rem' }}>
        <FieldLabel name="GITHUB_TOKEN" required colors={colors} />
        <SecretInput
          value={config.githubToken}
          onChange={(v) => updateField('githubToken', v)}
          colors={colors}
          placeholder="ghp_..."
          ariaLabel="GITHUB_TOKEN"
          label="Token"
        />
        <p style={hintStyle(colors.textDim)}>
          # 从{' '}
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noreferrer"
            style={{ color: colors.accent, textDecoration: 'none' }}
          >github.com/settings/tokens</a>{' '}
          生成 Token（需勾选 <code style={{ background: colors.bg, padding: '1px 4px', borderRadius: '3px' }}>repo</code> 权限）
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <FieldLabel name="REPO_OWNER" required colors={colors} />
        <TextInput
          value={config.repoOwner}
          onChange={(v) => updateField('repoOwner', v)}
          colors={colors}
          placeholder="your-username"
          ariaLabel="REPO_OWNER"
        />
      </div>

      <div>
        <FieldLabel name="REPO_NAME" hint="(可选，默认 my-bookmarks)" colors={colors} />
        <TextInput
          value={config.repoName}
          onChange={(v) => updateField('repoName', v)}
          colors={colors}
          placeholder="my-bookmarks"
          ariaLabel="REPO_NAME"
        />
        {config.repoOwner && (
          <p style={{ ...hintStyle(colors.textDim), marginTop: '0.375rem' }}>
            # 仓库地址：
            <a
              href={`https://github.com/${config.repoOwner}/${repoName}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: colors.accent, textDecoration: 'none', marginLeft: '0.25rem' }}
            >
              https://github.com/{config.repoOwner}/{repoName}
            </a>
          </p>
        )}
      </div>
    </SectionCard>
  )
}
