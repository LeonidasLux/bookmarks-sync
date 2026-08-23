import { useState, useCallback, useEffect, useRef } from 'react'

interface RemoteFilesResult {
  success: boolean
  files?: string[]
  error?: string
}

/**
 * 从远程仓库拉取书签文件列表（设置页默认文件下拉用）
 * 直接携带表单当前配置请求，避免与后台已保存配置脱节
 */
export function useRemoteFiles(githubToken: string, repoOwner: string, repoName: string) {
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 是否已收到一次响应（区分「未请求」与「请求完成但为空」） */
  const [ready, setReady] = useState(false)

  const enabled = !!(githubToken && repoOwner && repoName)

  const refresh = useCallback(() => {
    if (!enabled) {
      setFiles([])
      setError(null)
      setReady(false)
      return
    }
    setLoading(true)
    setError(null)
    let settled = false
    // 后台无响应时（如扩展未重新加载）给出明确提示
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      setLoading(false)
      setError('扩展后台无响应，请重新加载扩展后重试')
    }, 10000)
    chrome.runtime.sendMessage({
      type: 'LIST_BOOKMARK_FILES',
      githubToken,
      repoOwner,
      repoName,
    }, (res: RemoteFilesResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      setLoading(false)
      setReady(true)
      if (res?.success) {
        setFiles(res.files ?? [])
      } else if (!res) {
        setError('后台无响应，请重新加载扩展后重试')
      } else {
        setError(res.error || '获取远程文件列表失败')
      }
    })
  }, [enabled, githubToken, repoOwner, repoName])

  // 配置从「未完成」变为「完成」时自动请求一次；之后只手动刷新
  const prevEnabled = useRef(false)
  useEffect(() => {
    if (enabled && !prevEnabled.current) refresh()
    prevEnabled.current = enabled
  }, [enabled, refresh])

  return { files, loading, error, ready, refresh }
}
