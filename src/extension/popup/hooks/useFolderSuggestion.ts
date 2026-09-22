import { useState, useEffect } from 'react'
import type { FolderSuggestion } from '../../../shared/jev'

export type FolderSuggestionState = 'idle' | 'loading' | 'ready' | 'skipped' | 'error'

interface SuggestionResponse {
  success?: boolean
  skipped?: boolean
  suggestion?: FolderSuggestion
  error?: string
}

export interface UseFolderSuggestionResult {
  state: FolderSuggestionState
  suggestion: FolderSuggestion | null
  error: string | null
}

/**
 * 请求后台用 Jev 推荐目标目录。
 * 未配置 API Key 时返回 skipped，调用方保持原有默认选择即可。
 */
export function useFolderSuggestion(title: string, url: string): UseFolderSuggestionResult {
  const [state, setState] = useState<FolderSuggestionState>('idle')
  const [suggestion, setSuggestion] = useState<FolderSuggestion | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!url) {
      // 缺少页面信息时不发起推荐，也不展示提示
      setState('idle')
      return
    }

    let cancelled = false
    setState('loading')

    chrome.runtime.sendMessage(
      { type: 'SUGGEST_SAVE_FOLDER', title, url },
      (response: SuggestionResponse | undefined) => {
        if (cancelled) return
        const msg = chrome.runtime.lastError?.message
        if (msg) {
          setError(msg)
          setState('error')
          return
        }
        if (response?.success && response.suggestion) {
          setSuggestion(response.suggestion)
          setState('ready')
        } else if (response?.skipped) {
          setState('skipped')
        } else {
          setError(response?.error ?? 'Jev 未返回结果')
          setState('error')
        }
      },
    )

    return () => { cancelled = true }
  }, [title, url])

  return { state, suggestion, error }
}
