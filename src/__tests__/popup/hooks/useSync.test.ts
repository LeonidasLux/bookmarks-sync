import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSync } from '../../../extension/popup/hooks/useSync'

/** mock sendMessage 回调式调用（绕过 chrome API 重载签名），返回 spy 供断言 */
function mockSendMessage(handler: (msg: unknown, cb?: (res: unknown) => void) => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(handler as any)
}

describe('useSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listRemoteFiles', () => {
    it('应返回远程书签文件列表', async () => {
      const sendMessage = mockSendMessage((_msg: unknown, cb?: (res: unknown) => void) => {
        if (cb) cb({ success: true, files: ['bookmarks-chrome.json', 'bookmarks.json'] })
        return Promise.resolve()
      })

      const { result } = renderHook(() => useSync())

      const res = await act(async () => {
        return await result.current.listRemoteFiles()
      })

      expect(res).toEqual({ files: ['bookmarks-chrome.json', 'bookmarks.json'], error: null })
      expect(sendMessage).toHaveBeenCalledWith(
        { type: 'LIST_BOOKMARK_FILES' },
        expect.any(Function),
      )
    })

    it('失败时应返回空列表和错误信息', async () => {
      mockSendMessage((_msg: unknown, cb?: (res: unknown) => void) => {
        if (cb) cb({ success: false, error: 'GitHub API error' })
        return Promise.resolve()
      })

      const { result } = renderHook(() => useSync())

      const res = await act(async () => {
        return await result.current.listRemoteFiles()
      })

      expect(res).toEqual({ files: [], error: 'GitHub API error' })
    })
  })

  describe('executePush', () => {
    it('应携带指定的 fileName 发送 PUSH_TO_GITHUB', async () => {
      const sendMessage = mockSendMessage((_msg: unknown, cb?: (res: unknown) => void) => {
        if (cb) cb({ success: true, timestamp: '2024-01-01T00:00:00Z', steps: [] })
        return Promise.resolve()
      })

      const { result } = renderHook(() => useSync())
      const setSyncStatus = vi.fn()

      await act(async () => {
        result.current.executePush(setSyncStatus, undefined, 'bookmarks-chrome.json')
      })

      expect(sendMessage).toHaveBeenCalledWith(
        { type: 'PUSH_TO_GITHUB', fileName: 'bookmarks-chrome.json' },
        expect.any(Function),
      )
    })
  })

  describe('handlePull', () => {
    it('应携带指定的 fileName 发送 PULL_FROM_GITHUB', async () => {
      const sendMessage = mockSendMessage((_msg: unknown, cb?: (res: unknown) => void) => {
        if (cb) cb({ success: true, timestamp: '2024-01-01T00:00:00Z', diffs: [], steps: [] })
        return Promise.resolve()
      })

      const { result } = renderHook(() => useSync())
      const setSyncStatus = vi.fn()

      const res = await act(async () => {
        return await result.current.handlePull(setSyncStatus, undefined, 'bookmarks-edge.json')
      })

      expect(sendMessage).toHaveBeenCalledWith(
        { type: 'PULL_FROM_GITHUB', fileName: 'bookmarks-edge.json' },
        expect.any(Function),
      )
      expect(res.success).toBe(true)
    })
  })

  describe('getCurrentTabInfo', () => {
    it('应正确获取当前标签页的 URL 和标题', async () => {
      const { result } = renderHook(() => useSync())

      const info = await act(async () => {
        return await result.current.getCurrentTabInfo()
      })

      expect(info).not.toBeNull()
      expect(info!.url).toBe('https://example.com')
      expect(info!.title).toBe('Test')
    })

    it('tabs.query 无结果时应返回 null', async () => {
      vi.spyOn(chrome.tabs, 'query').mockResolvedValue([])

      const { result } = renderHook(() => useSync())

      const info = await act(async () => {
        return await result.current.getCurrentTabInfo()
      })

      expect(info).toBeNull()
    })

    it('tabs.query 返回 tab 但无 url 时应返回 null', async () => {
      vi.spyOn(chrome.tabs, 'query').mockResolvedValue([
        { id: 1, url: undefined } as unknown as chrome.tabs.Tab,
      ])

      const { result } = renderHook(() => useSync())

      const info = await act(async () => {
        return await result.current.getCurrentTabInfo()
      })

      expect(info).toBeNull()
    })
  })

  describe('handleSaveCurrent', () => {
    it('应调用 chrome.bookmarks.create 并刷新文件夹', async () => {
      const createSpy = vi.spyOn(chrome.bookmarks, 'create')
      createSpy.mockImplementation(() => Promise.resolve({ id: 'new-id', title: '测试标题' } as chrome.bookmarks.BookmarkTreeNode))

      const loadFolder = vi.fn().mockResolvedValue(undefined)
      const setSyncStatus = vi.fn()

      const { result } = renderHook(() => useSync())

      const success = await act(async () => {
        return await result.current.handleSaveCurrent(
          '11',
          '测试标题',
          'https://example.com',
          '1',
          loadFolder,
          setSyncStatus,
        )
      })

      expect(success).toBe(true)
      expect(createSpy).toHaveBeenCalledWith({
        parentId: '11',
        title: '测试标题',
        url: 'https://example.com',
      })
      expect(loadFolder).toHaveBeenCalledWith('1')
      expect(setSyncStatus).toHaveBeenCalled()
    })

    it('bookmarks.create 失败时应返回 false 并调用 setSyncStatus', async () => {
      vi.spyOn(chrome.bookmarks, 'create')
        .mockImplementation(() => Promise.reject(new Error('创建失败')))

      const { result } = renderHook(() => useSync())
      const setSyncStatus = vi.fn()

      const success = await act(async () => {
        return await result.current.handleSaveCurrent(
          '11', '标题', 'https://example.com', '1', vi.fn(), setSyncStatus,
        )
      })

      expect(success).toBe(false)
      expect(setSyncStatus).toHaveBeenCalledWith(
        expect.stringContaining('❌'),
      )
    })
  })
})
