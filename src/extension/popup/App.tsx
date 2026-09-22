import { useState, useCallback, useEffect } from 'react'
import { useConfig } from './hooks/useConfig'
import { useBookmarkNavigation } from './hooks/useBookmarkNavigation'
import { useBookmarkStats } from './hooks/useBookmarkStats'
import { useSync } from './hooks/useSync'
import { useDiffReview } from './hooks/useDiffReview'
import { Toolbar } from './components/Toolbar'
import { BreadcrumbNav } from './components/BreadcrumbNav'
import { BookmarkList } from './components/BookmarkList'
import { BookmarkStats } from './components/BookmarkStats'
import { DiffReviewPanel } from './components/DiffReviewPanel'
import { PushConfirmModal } from './components/PushConfirmModal'
import { FilePickModal } from './components/FilePickModal'
import { FolderPicker } from './components/FolderPicker'
import { LoadingView } from './components/LoadingView'
import type { Bookmark } from '../../shared/types'
import { UnconfiguredView } from './components/UnconfiguredView'
import { ThemeProvider, useTheme } from './theme'

function openOptions() {
  chrome.runtime.openOptionsPage()
}

/**
 * 外层：读取配置后注入 ThemeProvider
 */
function App() {
  const { config } = useConfig()
  return (
    <ThemeProvider themeMode={config?.theme ?? 'system'}>
      <AppShell />
    </ThemeProvider>
  )
}

/**
 * 内层：所有状态 / 效果 / 渲染逻辑，可安全调用 useTheme()
 */
function AppShell() {
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [initialSaveTitle, setInitialSaveTitle] = useState('')
  const [saveTabUrl, setSaveTabUrl] = useState('')
  const [syncSteps, setSyncSteps] = useState<string[] | null>(null)
  const [pushPreview, setPushPreview] = useState<Bookmark[] | null>(null)
  const [filePickMode, setFilePickMode] = useState<'push' | 'pull' | null>(null)
  const [remoteFiles, setRemoteFiles] = useState<string[] | null>(null)
  const [remoteFilesError, setRemoteFilesError] = useState<string | null>(null)
  const [pushTargetFile, setPushTargetFile] = useState('')
  const { config, loading, syncStatus, setSyncStatus, isConfigured } = useConfig()
  const {
    currentFolder,
    breadcrumbs,
    currentItems,
    isHomeView,
    loadFolder,
    enterFolder,
    goBack,
    navigateToBreadcrumb,
    openBookmark,
  } = useBookmarkNavigation()
  const { stats, refreshStats } = useBookmarkStats()
  const { pushLoading, pullLoading, getPushPreview, executePush, handlePull, handleSaveCurrent, getCurrentTabInfo, listRemoteFiles } = useSync()
  const {
    pullDiffs,
    selectedIds,
    emptyFolders,
    diffTab,
    applying,
    setDiffTab,
    openReview,
    cancelPullReview,
    applySelected,
    toggleId,
    selectAllInGroup,
    invertSelectionInGroup,
  } = useDiffReview()
  const { styles, colors } = useTheme()

  // ---- 快捷键：挂载时检查是否有待处理的保存请求 ----
  const triggerSaveBookmark = useCallback(async () => {
    await chrome.storage.local.remove('pendingSaveBookmark')
    const info = await getCurrentTabInfo()
    if (info) {
      setInitialSaveTitle(info.title)
      setSaveTabUrl(info.url)
      setShowFolderPicker(true)
    } else {
      setSyncStatus('❌ 无法获取当前标签页信息')
    }
  }, [getCurrentTabInfo, setSyncStatus])

  useEffect(() => {
    chrome.storage.local.get('pendingSaveBookmark', async (result) => {
      if (!result.pendingSaveBookmark) return
      await triggerSaveBookmark()
    })
  }, [triggerSaveBookmark])

  // 监听后台发送的 TRIGGER_SAVE_BOOKMARK 消息（popup 已打开时）
  useEffect(() => {
    const handler = (msg: { type: string }) => {
      if (msg.type === 'TRIGGER_SAVE_BOOKMARK') {
        triggerSaveBookmark()
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [triggerSaveBookmark])

  // ---- 文件选择弹窗：推送 / 拉取前选择远程书签文件 ----
  const openFilePick = useCallback((mode: 'push' | 'pull') => {
    if (!isConfigured) {
      setSyncStatus('❌ 请先配置 GitHub Token、仓库 Owner 和名称')
      return
    }
    setSyncSteps(null)
    setFilePickMode(mode)
    setRemoteFiles(null)
    setRemoteFilesError(null)
  }, [isConfigured, setSyncStatus])

  useEffect(() => {
    if (!filePickMode) return
    let cancelled = false
    listRemoteFiles().then(({ files, error }) => {
      if (cancelled) return
      setRemoteFiles(files)
      setRemoteFilesError(error)
    })
    return () => { cancelled = true }
  }, [filePickMode, listRemoteFiles])

  const onFilePickConfirm = useCallback((fileName: string) => {
    const mode = filePickMode
    setFilePickMode(null)
    if (mode === 'push') {
      setPushTargetFile(fileName)
      getPushPreview().then(setPushPreview)
    } else if (mode === 'pull') {
      handlePull(setSyncStatus, setSyncSteps, fileName).then(res => {
        if (res.success && res.diffs.length > 0) {
          setSyncSteps(null)
          openReview(res.diffs, res.emptyFolders ?? [])
        }
      })
    }
  }, [filePickMode, getPushPreview, handlePull, openReview, setSyncStatus])

  const onCancelPush = useCallback(() => {
    setPushPreview(null)
    setSyncStatus('已取消推送')
  }, [setSyncStatus])

  const onConfirmPush = useCallback(() => {
    setPushPreview(null)
    executePush(setSyncStatus, setSyncSteps, pushTargetFile)
  }, [executePush, pushTargetFile, setSyncStatus])

  const onStartSave = useCallback(async () => {
    const info = await getCurrentTabInfo()
    if (!info) {
      setSyncStatus('❌ 无法获取当前标签页信息')
      return
    }
    setInitialSaveTitle(info.title)
    setSaveTabUrl(info.url)
    setShowFolderPicker(true)
  }, [getCurrentTabInfo, setSyncStatus])

  const onSaveToFolder = async (folderId: string, title: string) => {
    setShowFolderPicker(false)
    await handleSaveCurrent(folderId, title, saveTabUrl, currentFolder.id, loadFolder, setSyncStatus)
  }

  const onApplySelected = () => {
    applySelected(config?.cleanEmptyFolders ?? true, currentFolder.id, loadFolder, setSyncStatus, setSyncSteps, refreshStats)
  }

  // ---- 将状态消息中的 emoji 转为终端色彩 ----
  const renderStatus = (msg: string) => {
    if (!msg) return null
    let color: string | undefined
    let prefix: string | undefined

    if (msg.startsWith('✅')) {
      color = colors.green; prefix = '✓'
    } else if (msg.startsWith('❌')) {
      color = colors.red; prefix = '✗'
    } else if (msg.startsWith('🔄')) {
      color = colors.orange; prefix = '⟳'
    } else {
      color = colors.textMuted; prefix = '→'
    }

    const text = msg.replace(/^[✅❌🔄]/, '').trim()

    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', width: '100%' }}>
        <span style={color ? { ...styles.statusDot, background: color, boxShadow: `0 0 4px ${color}60` } : undefined} />
        <span>{prefix}</span>
        {text}
      </span>
    )
  }

  // ---- 渲染 ----
  if (pullDiffs) {
    return (
      <DiffReviewPanel
        pullDiffs={pullDiffs}
        selectedIds={selectedIds}
        emptyFolders={emptyFolders}
        diffTab={diffTab}
        applying={applying}
        cleanEnabled={config?.cleanEmptyFolders ?? true}
        onTabChange={setDiffTab}
        onToggleId={toggleId}
        onSelectAllInGroup={selectAllInGroup}
        onInvertSelectionInGroup={invertSelectionInGroup}
        onCancel={cancelPullReview}
        onApply={onApplySelected}
      />
    )
  }

  if (showFolderPicker) {
    return (
      <FolderPicker
        initialTitle={initialSaveTitle}
        pageUrl={saveTabUrl}
        onSave={onSaveToFolder}
        onBack={() => setShowFolderPicker(false)}
      />
    )
  }

  if (loading) {
    return <LoadingView />
  }

  return (
    <div style={styles.container}>
      <Toolbar
        pushLoading={pushLoading}
        pullLoading={pullLoading}
        syncDisabled={!isConfigured}
        onSaveCurrent={onStartSave}
        onPush={() => openFilePick('push')}
        onPull={() => openFilePick('pull')}
        onOpenOptions={openOptions}
      />

      {!isConfigured && <UnconfiguredView onOpenOptions={openOptions} />}

      {isHomeView && <BookmarkStats stats={stats} />}

      {!isHomeView && (
        <BreadcrumbNav
          breadcrumbs={breadcrumbs}
          currentFolderTitle={currentFolder.title}
          onGoBack={goBack}
          onNavigateToBreadcrumb={navigateToBreadcrumb}
        />
      )}

      <BookmarkList
        currentItems={currentItems}
        isHomeView={isHomeView}
        onEnterFolder={enterFolder}
        onOpenBookmark={openBookmark}
      />

      {syncStatus && (
        <div style={styles.status}>
          {renderStatus(syncStatus)}
        </div>
      )}

      {syncSteps && syncSteps.length > 0 && (
        <div style={styles.syncLog}>
          <div style={styles.syncLogHeader}>
            <span>
              <span style={{ color: colors.accent }}>▼</span> 执行日志
            </span>
            <span style={styles.syncLogClose} onClick={() => setSyncSteps(null)}>✕</span>
          </div>
          <div style={styles.syncLogBody}>
            {syncSteps.map((step, i) => (
              <div key={i} style={styles.syncLogItem}>
                <span style={{ color: colors.textDim }}>[{i + 1}]</span> {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {pushPreview && (
        <PushConfirmModal
          bookmarks={pushPreview}
          fileName={pushTargetFile}
          onCancel={onCancelPush}
          onConfirm={onConfirmPush}
        />
      )}

      {filePickMode && (
        <FilePickModal
          mode={filePickMode}
          files={remoteFiles}
          defaultFile={filePickMode === 'push' ? (config?.syncFileName ?? '') : (config?.pullFileName ?? '')}
          error={remoteFilesError}
          onConfirm={onFilePickConfirm}
          onCancel={() => setFilePickMode(null)}
        />
      )}
    </div>
  )
}

export default App
