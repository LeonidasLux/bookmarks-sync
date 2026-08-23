import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRemoteFiles } from '../../../extension/options/hooks/useRemoteFiles'

function mockSendMessage(handler: (msg: unknown, cb?: (res: unknown) => void) => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(handler as any)
}

describe('useRemoteFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('未配置时不发送消息', async () => {
    const sendMessage = mockSendMessage(() => {})
    renderHook(() => useRemoteFiles('', '', ''))

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('应携带表单配置发送 LIST_BOOKMARK_FILES', async () => {
    const sendMessage = mockSendMessage((_msg, cb) => {
      if (cb) cb({ success: true, files: ['bookmarks-chrome.json'] })
    })
    const { result } = renderHook(() => useRemoteFiles('token', 'owner', 'repo'))

    await act(async () => {})

    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'LIST_BOOKMARK_FILES',
      githubToken: 'token',
      repoOwner: 'owner',
      repoName: 'repo',
    }), expect.any(Function))
    expect(result.current.files).toEqual(['bookmarks-chrome.json'])
    expect(result.current.ready).toBe(true)
    expect(result.current.loading).toBe(false)
  })

  it('失败时设置错误信息', async () => {
    mockSendMessage((_msg, cb) => {
      if (cb) cb({ success: false, error: 'GitHub API error' })
    })
    const { result } = renderHook(() => useRemoteFiles('token', 'owner', 'repo'))

    await act(async () => {})

    expect(result.current.error).toBe('GitHub API error')
    expect(result.current.ready).toBe(true)
  })

  it('后台无响应时提示重新加载扩展', async () => {
    vi.useFakeTimers()
    mockSendMessage(() => { /* 永不回调 */ })
    const { result } = renderHook(() => useRemoteFiles('token', 'owner', 'repo'))

    act(() => { vi.advanceTimersByTime(10001) })

    expect(result.current.error).toBe('扩展后台无响应，请重新加载扩展后重试')
    expect(result.current.loading).toBe(false)
  })

  it('手动刷新可重复请求', async () => {
    const sendMessage = mockSendMessage((_msg, cb) => {
      if (cb) cb({ success: true, files: [] })
    })
    const { result } = renderHook(() => useRemoteFiles('token', 'owner', 'repo'))

    await act(async () => {})
    expect(sendMessage).toHaveBeenCalledTimes(1)

    await act(async () => { result.current.refresh() })
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })
})
