import type { AppConfig, Bookmark, BookmarkDiff } from '../../shared/types'
import { DEFAULT_CONFIG } from '../../shared/types'
import { SyncEngine, LEGACY_BOOKMARK_PATH } from '../../shared/sync'
import { applyDevEnv } from '../../shared/env'
import { AUTO_SYNC_ALARM, scheduleAutoSync } from './auto-sync'
import { getBrowserBookmarks } from './bookmark-utils'
import { computeEmptyFolders } from './folder-utils'
import { applyDiffsToBrowser, reorderBookmarks, showResult } from './diff-applier'
import { suggestSaveFolder } from './folder-suggest'

const REMOTE_BOOKMARKS_KEY = 'lastRemoteBookmarks'

let config: AppConfig = DEFAULT_CONFIG
let syncEngine: SyncEngine | null = null
/** 上次 PULL 获取的远程书签数组，用于后续 APPLY 时重排顺序 */
let lastRemoteBookmarks: Bookmark[] = []
/** 定时同步执行中标志，防止 alarm 重入 */
let autoSyncRunning = false

function loadConfig(): Promise<AppConfig> {
  return new Promise((resolve) => {
    chrome.storage.local.get('config', (result) => {
      const cfg = applyDevEnv({ ...DEFAULT_CONFIG, ...(result.config ?? {}) } as AppConfig)
      config = cfg
      syncEngine = new SyncEngine(cfg)
      scheduleAutoSync(cfg)
      resolve(cfg)
    })
  })
}

/** 配置不完整错误文案（手动推送时保持原行为：不写失败日志） */
const CONFIG_INCOMPLETE = '请先完成设置'

/**
 * 推送本地书签到远程（手动推送与定时同步共用）。
 * 成功时写入 lastSync/syncLog 并返回时间戳；失败抛出异常。
 */
async function pushToGitHub(fileName: string | undefined, steps: string[]): Promise<string> {
  if (!config.githubToken || !config.repoOwner || !config.repoName) {
    steps.push('配置不完整')
    showResult(steps, false)
    throw new Error(CONFIG_INCOMPLETE)
  }
  if (!syncEngine) syncEngine = new SyncEngine(config)

  const target = fileName || config.syncFileName || LEGACY_BOOKMARK_PATH
  const local = await getBrowserBookmarks(steps)
  await syncEngine.pushOnly(local, steps, target)
  steps.push(`完成: ${local.length} 条 -> ${target}`)
  showResult(steps, true)
  const timestamp = new Date().toISOString()
  chrome.storage.local.set({ lastSync: timestamp, syncLog: { success: true, timestamp, steps } })
  return timestamp
}

/** 定时同步：刷新配置后执行一次推送（alarm 触发入口） */
export async function runAutoSync(): Promise<void> {
  if (autoSyncRunning) return
  autoSyncRunning = true
  const steps: string[] = ['[定时同步] 开始']
  try {
    await loadConfig()
    await pushToGitHub(undefined, steps)
    steps.push('[定时同步] 完成')
  } catch (e) {
    steps.push(`❌ ${(e as Error).message}`)
    const timestamp = new Date().toISOString()
    chrome.storage.local.set({ syncLog: { success: false, timestamp, error: (e as Error).message, steps } })
  } finally {
    autoSyncRunning = false
  }
}

/** alarm 触发入口：仅响应定时同步 alarm */
export function handleAutoSyncAlarm(alarm: chrome.alarms.Alarm): void {
  if (alarm.name === AUTO_SYNC_ALARM) {
    void runAutoSync()
  }
}

// ---- 定时同步 ----
chrome.alarms.onAlarm.addListener(handleAutoSyncAlarm)

// ---- 快捷键：保存书签 ----
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-bookmark') {
    await chrome.storage.local.set({ pendingSaveBookmark: true })
    // 通知可能已打开的 popup
    chrome.runtime.sendMessage({ type: 'TRIGGER_SAVE_BOOKMARK' }).catch(() => {
      // popup 未打开，走 openPopup 流程
    })
    try {
      await chrome.action.openPopup()
    } catch {
      // openPopup 失败（如无活跃窗口），pendingSaveBookmark 已写入 storage
      // 下次点击扩展图标时 popup 会自动触发保存流程
    }
  }
})

// ---- 初始化 ----
loadConfig()

chrome.runtime.onInstalled.addListener(async () => {
  await loadConfig()
})

// ---- 消息处理 ----
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'PUSH_TO_GITHUB': {
      ;(async () => {
        const steps: string[] = []
        try {
          const timestamp = await pushToGitHub(msg.fileName as string | undefined, steps)
          sendResponse({ success: true, timestamp, steps })
        } catch (e) {
          const error = (e as Error).message
          if (error !== CONFIG_INCOMPLETE) {
            steps.push(`❌ ${error}`)
            showResult(steps, false)
            const timestamp = new Date().toISOString()
            chrome.storage.local.set({ syncLog: { success: false, timestamp, error, steps } })
          }
          sendResponse({ success: false, error, steps })
        }
      })()
      return true
    }

    case 'PULL_FROM_GITHUB': {
      ;(async () => {
        const steps: string[] = []
        try {
          if (!config.githubToken || !config.repoOwner || !config.repoName) {
            steps.push('配置不完整')
            showResult(steps, false)
            sendResponse({ success: false, timestamp: '', diffs: [], error: '请先完成设置', steps })
            return
          }
          if (!syncEngine) syncEngine = new SyncEngine(config)

          const fileName = (msg.fileName as string) || config.pullFileName || LEGACY_BOOKMARK_PATH
          const remote = await syncEngine.pullOnly(steps, fileName)
          lastRemoteBookmarks = remote
          // 持久化到 storage，避免 SW 回收后 APPLY 时丢失
          chrome.storage.local.set({ [REMOTE_BOOKMARKS_KEY]: remote })
          const local = await getBrowserBookmarks(steps)
          const diffs = SyncEngine.computeDiff(remote, local)
          steps.push(`差异: 新增${diffs.filter(d => d.type === 'added').length} / 删除${diffs.filter(d => d.type === 'deleted').length} / 修改${diffs.filter(d => d.type === 'modified').length}`)

          const emptyFolders = await computeEmptyFolders(diffs)

          showResult(steps, true)
          sendResponse({ success: true, timestamp: new Date().toISOString(), diffs, emptyFolders, steps })
        } catch (e) {
          steps.push(`❌ ${(e as Error).message}`)
          showResult(steps, false)
          sendResponse({ success: false, timestamp: '', diffs: [], error: (e as Error).message, steps })
        }
      })()
      return true
    }

    case 'LIST_BOOKMARK_FILES': {
      ;(async () => {
        const steps: string[] = []
        try {
          // 优先使用消息携带的表单配置（设置页可能尚未保存）
          const listConfig = {
            ...config,
            githubToken: (msg.githubToken as string) || config.githubToken,
            repoOwner: (msg.repoOwner as string) || config.repoOwner,
            repoName: (msg.repoName as string) || config.repoName,
          }
          if (!listConfig.githubToken || !listConfig.repoOwner || !listConfig.repoName) {
            steps.push('配置不完整')
            sendResponse({ success: false, files: [], error: '请先完成设置', steps })
            return
          }

          const files = await new SyncEngine(listConfig).listBookmarkFiles(steps)
          sendResponse({ success: true, files, steps })
        } catch (e) {
          steps.push(`❌ ${(e as Error).message}`)
          sendResponse({ success: false, files: [], error: (e as Error).message, steps })
        }
      })()
      return true
    }

    case 'APPLY_PULL_DIFFS': {
      ;(async () => {
        const steps: string[] = []
        try {
          const selectedDiffs = msg.selectedDiffs as BookmarkDiff[]
          const cleanEmptyFolders = msg.cleanEmptyFolders as boolean
          await applyDiffsToBrowser(selectedDiffs, steps, cleanEmptyFolders)

          // 按远程书签顺序重排
          // 先从 storage 恢复（SW 可能被回收导致内存数据丢失）
          if (lastRemoteBookmarks.length === 0) {
            const stored = await chrome.storage.local.get(REMOTE_BOOKMARKS_KEY)
            lastRemoteBookmarks = (stored[REMOTE_BOOKMARKS_KEY] ?? []) as Bookmark[]
          }
          if (lastRemoteBookmarks.length > 0) {
            await reorderBookmarks(lastRemoteBookmarks, steps)
          } else {
            steps.push('跳过重排：无远程书签数据')
          }

          // 清理 storage 中的远程数据
          chrome.storage.local.remove(REMOTE_BOOKMARKS_KEY)

          steps.push(`完成: 应用 ${selectedDiffs.length} 项`)
          showResult(steps, true)
          const timestamp = new Date().toISOString()
          chrome.storage.local.set({ lastSync: timestamp, syncLog: { success: true, timestamp, steps } })
          sendResponse({ success: true, timestamp, steps })
        } catch (e) {
          steps.push(`❌ ${(e as Error).message}`)
          showResult(steps, false)
          sendResponse({ success: false, error: (e as Error).message, steps })
        }
      })()
      return true
    }

    case 'GET_CONFIG':
      chrome.storage.local.get('config', (result) => {
        sendResponse({ config: applyDevEnv({ ...DEFAULT_CONFIG, ...(result.config ?? {}) } as AppConfig) })
      })
      return true

    case 'SUGGEST_SAVE_FOLDER': {
      ;(async () => {
        try {
          const stored = await chrome.storage.local.get('config')
          const cfg = applyDevEnv({ ...DEFAULT_CONFIG, ...(stored.config ?? {}) } as AppConfig)
          const apiKey = cfg.typesafeApiKey?.trim()
          if (!apiKey) {
            sendResponse({ success: false, skipped: true, error: '未配置 Jev API Key' })
            return
          }

          const suggestion = await suggestSaveFolder(apiKey, {
            title: (msg.title as string) ?? '',
            url: (msg.url as string) ?? '',
          })
          if (!suggestion) {
            sendResponse({ success: false, error: '没有可用的书签目录' })
            return
          }
          sendResponse({ success: true, suggestion })
        } catch (e) {
          sendResponse({ success: false, error: (e as Error).message })
        }
      })()
      return true
    }

    case 'SAVE_CONFIG':
      config = msg.config as AppConfig
      syncEngine = new SyncEngine(config)
      scheduleAutoSync(config)
      chrome.storage.local.set({ config }, () => {
        sendResponse({ success: true })
      })
      return true
  }
})
