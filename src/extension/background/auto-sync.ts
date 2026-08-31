import type { AppConfig } from '../../shared/types'

/** 定时同步 alarm 名称 */
export const AUTO_SYNC_ALARM = 'auto-sync'

/** 定时同步最小间隔（分钟），Chrome alarms 周期下限为 0.5 分钟，UI 侧最小 1 分钟 */
export const MIN_AUTO_SYNC_INTERVAL = 1

/** 配置是否满足定时同步条件（已启用且凭据完整） */
export function canAutoSync(config: AppConfig): boolean {
  return (
    config.autoSyncInterval >= MIN_AUTO_SYNC_INTERVAL &&
    Boolean(config.githubToken && config.repoOwner && config.repoName)
  )
}

/**
 * 根据配置创建或清除定时同步 alarm。
 * 条件不满足时清除已有 alarm，避免凭据不完整时定时空转报错。
 */
export function scheduleAutoSync(config: AppConfig): void {
  if (!canAutoSync(config)) {
    chrome.alarms.clear(AUTO_SYNC_ALARM).catch(() => {})
    return
  }
  const minutes = config.autoSyncInterval
  chrome.alarms.create(AUTO_SYNC_ALARM, {
    delayInMinutes: minutes,
    periodInMinutes: minutes,
  })
}
