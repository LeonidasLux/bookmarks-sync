import { useState } from 'react'
import { useTheme } from '../theme'
import { BookmarkIcon, PushIcon, PullIcon, SettingsIcon } from './Icons'

interface ToolbarProps {
  pushLoading: boolean
  pullLoading: boolean
  /** 未配置仓库连接时禁用推送 / 拉取（书签浏览与保存仍可用） */
  syncDisabled?: boolean
  onSaveCurrent: () => void
  onPush: () => void
  onPull: () => void
  onOpenOptions: () => void
}

function Btn({ title, loading, disabled, children, onClick }: {
  title: string
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  const { styles, colors } = useTheme()
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...styles.iconBtn,
        ...((hover && !disabled && !loading) ? styles.iconBtnHover : {}),
        ...((disabled || loading) ? styles.iconBtnDisabled : {}),
      }}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {loading ? (
        <span style={{ color: colors.orange }}>⋯</span>
      ) : children}
    </button>
  )
}

export function Toolbar({ pushLoading, pullLoading, syncDisabled, onSaveCurrent, onPush, onPull, onOpenOptions }: ToolbarProps) {
  const { styles, colors } = useTheme()
  const pushTitle = '推送到 GitHub（强制覆盖远程）'
  const pullTitle = '从 GitHub 拉取（对比差异后手动合并）'
  return (
    <div style={styles.toolbar}>
      <span style={styles.toolbarTitle}>
        <span style={{ color: colors.accent }}>◆</span> bookmarks
      </span>
      <Btn title="保存当前标签页到书签" onClick={onSaveCurrent}><BookmarkIcon /></Btn>
      <Btn
        title={syncDisabled ? `${pushTitle}（请先配置仓库连接）` : pushTitle}
        loading={pushLoading}
        disabled={syncDisabled}
        onClick={onPush}
      >
        <PushIcon />
      </Btn>
      <Btn
        title={syncDisabled ? `${pullTitle}（请先配置仓库连接）` : pullTitle}
        loading={pullLoading}
        disabled={syncDisabled}
        onClick={onPull}
      >
        <PullIcon />
      </Btn>
      <Btn title="设置" onClick={onOpenOptions}><SettingsIcon /></Btn>
    </div>
  )
}
