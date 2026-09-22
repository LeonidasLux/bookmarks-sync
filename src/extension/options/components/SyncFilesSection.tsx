import type { AppConfig } from '../../../shared/types'
import type { Palette } from '../palette'
import type { UpdateField } from '../types'
import type { RemoteFilesState } from '../hooks/useRemoteFiles'
import { FileDefaultPicker } from './FileDefaultPicker'
import { SectionCard } from './SectionCard'

interface SyncFilesSectionProps {
  config: AppConfig
  updateField: UpdateField
  syncFiles: RemoteFilesState
  pullFiles: RemoteFilesState
  colors: Palette
}

/** 默认同步文件配置：推送文件 / 拉取文件 */
export function SyncFilesSection({ config, updateField, syncFiles, pullFiles, colors }: SyncFilesSectionProps) {
  return (
    <SectionCard title="同步文件" icon="🗂" colors={colors}>
      <FileDefaultPicker
        label="SYNC_FILE"
        description="推送时默认写入"
        value={config.syncFileName}
        onChange={(v) => updateField('syncFileName', v)}
        files={syncFiles.files}
        loading={syncFiles.loading}
        error={syncFiles.error}
        emptyHint={syncFiles.ready && syncFiles.files.length === 0 ? '远程暂无 bookmarks 文件，可直接新建' : null}
        onRefresh={syncFiles.refresh}
        colors={colors}
      />

      <FileDefaultPicker
        label="PULL_FILE"
        description="拉取时默认读取"
        value={config.pullFileName}
        onChange={(v) => updateField('pullFileName', v)}
        files={pullFiles.files}
        loading={pullFiles.loading}
        error={pullFiles.error}
        emptyHint={pullFiles.ready && pullFiles.files.length === 0 ? '远程暂无 bookmarks 文件' : null}
        onRefresh={pullFiles.refresh}
        colors={colors}
        marginBottom={0}
      />
    </SectionCard>
  )
}
