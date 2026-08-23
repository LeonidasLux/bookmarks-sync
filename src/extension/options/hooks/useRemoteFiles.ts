import { useState, useCallback, useEffect } from 'react'

interface RemoteFilesResult {
  success: boolean
  files?: string[]
  error?: string
}

/**
 * 从远程仓库拉取书签文件列表（设置页默认文件下拉用）
 * enabled 为 false 时（未配置 GitHub）不请求
 */
export function useRemoteFiles(enabled: boolean) {
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!enabled) {
      setFiles([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    chrome.runtime.sendMessage({ type: 'LIST_BOOKMARK_FILES' }, (res: RemoteFilesResult) => {
      setLoading(false)
      if (res?.success) {
        setFiles(res.files ?? [])
      } else {
        setError(res?.error || '获取远程文件列表失败')
      }
    })
  }, [enabled])

  useEffect(() => { refresh() }, [refresh])

  return { files, loading, error, refresh }
}
