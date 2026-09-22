import { useConfigForm } from './hooks/useConfigForm'
import { useCommands } from './hooks/useCommands'
import { useRemoteFiles } from './hooks/useRemoteFiles'
import { useBodyTheme, useResolvedTheme } from './hooks/useTheme'
import { palettes } from './palette'
import { font } from './styles'
import { AutoSyncSection } from './components/AutoSyncSection'
import { GithubSection } from './components/GithubSection'
import { SaveBar } from './components/SaveBar'
import { SettingsColumns } from './components/SettingsColumns'
import { ShortcutsSection } from './components/ShortcutsSection'
import { SuggestSection } from './components/SuggestSection'
import { SyncFilesSection } from './components/SyncFilesSection'
import { SyncOptionsSection } from './components/SyncOptionsSection'
import { ThemeSelector } from './components/ThemeSelector'

function App() {
  const { config, saved, save, updateField } = useConfigForm()
  const { commands } = useCommands()
  const syncFiles = useRemoteFiles(config.githubToken, config.repoOwner, config.repoName)
  const pullFiles = useRemoteFiles(config.githubToken, config.repoOwner, config.repoName)
  const mode = useResolvedTheme(config.theme)
  const colors = palettes[mode]

  useBodyTheme(colors.bg, colors.text)

  return (
    <div style={{
      maxWidth: 960,
      margin: '2rem auto',
      padding: '0 1.5rem',
      fontFamily: font,
      color: colors.text,
      background: 'transparent',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        borderBottom: `1px solid ${colors.borderLight}`,
        paddingBottom: '0.75rem',
        marginBottom: '1.5rem',
      }}>
        <h1 style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          letterSpacing: '0.5px',
          margin: 0,
        }}>
          <span style={{ color: colors.accent }}>◆</span> Bookmarks Sync 设置
        </h1>
        <ThemeSelector
          value={config.theme}
          onChange={(v) => updateField('theme', v)}
          colors={colors}
        />
      </header>

      <SettingsColumns
        left={
          <>
            <GithubSection config={config} updateField={updateField} colors={colors} />
            <SyncFilesSection
              config={config}
              updateField={updateField}
              syncFiles={syncFiles}
              pullFiles={pullFiles}
              colors={colors}
            />
          </>
        }
        right={
          <>
            <SuggestSection config={config} updateField={updateField} colors={colors} />
            <SyncOptionsSection config={config} updateField={updateField} colors={colors} />
            <AutoSyncSection config={config} updateField={updateField} colors={colors} />
            <ShortcutsSection commands={commands} colors={colors} />
          </>
        }
      />

      <SaveBar saved={saved} onSave={save} colors={colors} />
    </div>
  )
}

export default App
