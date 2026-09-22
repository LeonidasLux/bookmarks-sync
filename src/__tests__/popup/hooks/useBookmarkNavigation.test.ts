import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBookmarkNavigation } from '../../../extension/popup/hooks/useBookmarkNavigation'

/** 模拟的分层目录：id -> 子节点 */
const childrenById: Record<string, chrome.bookmarks.BookmarkTreeNode[]> = {
  '1': [
    {
      id: '11',
      title: '技术',
      children: [{ id: '111', title: '前端', children: [] }],
    },
  ],
  '11': [{ id: '111', title: '前端', children: [] }],
  '111': [{ id: '1111', title: 'React 文档', url: 'https://react.dev' }],
  '2': [{ id: '21', title: '工作', children: [] }],
}

beforeEach(() => {
  vi.spyOn(chrome.bookmarks, 'getSubTree').mockImplementation((async (id: string) => [
    { id, title: id, children: childrenById[id] ?? [] },
  ]) as unknown as typeof chrome.bookmarks.getSubTree)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useBookmarkNavigation', () => {
  it('挂载时加载书签栏内容', async () => {
    const { result } = renderHook(() => useBookmarkNavigation())

    await waitFor(() => expect(result.current.currentItems).toHaveLength(1))

    expect(result.current.currentFolder).toEqual({ id: '1', title: '书签栏' })
    expect(result.current.breadcrumbs).toEqual([])
    expect(result.current.isHomeView).toBe(true)
  })

  it('点击树中的深层目录时用祖先链补全面包屑', async () => {
    const { result } = renderHook(() => useBookmarkNavigation())
    await waitFor(() => expect(result.current.currentItems).toHaveLength(1))

    await act(async () => {
      await result.current.enterFolder('111', '前端', [{ id: '11', title: '技术' }])
    })

    expect(result.current.breadcrumbs).toEqual([
      { id: '1', title: '书签栏' },
      { id: '11', title: '技术' },
    ])
    expect(result.current.currentFolder).toEqual({ id: '111', title: '前端' })
    expect(result.current.isHomeView).toBe(false)
  })

  it('进入其他书签等根级目录时不产生面包屑', async () => {
    const { result } = renderHook(() => useBookmarkNavigation())
    await waitFor(() => expect(result.current.currentItems).toHaveLength(1))

    await act(async () => {
      await result.current.enterFolder('2', '其他书签')
    })

    expect(result.current.breadcrumbs).toEqual([])
    expect(result.current.currentFolder).toEqual({ id: '2', title: '其他书签' })
  })

  it('goBack 逐级返回上级目录', async () => {
    const { result } = renderHook(() => useBookmarkNavigation())
    await waitFor(() => expect(result.current.currentItems).toHaveLength(1))

    await act(async () => {
      await result.current.enterFolder('111', '前端', [{ id: '11', title: '技术' }])
    })

    await act(async () => {
      await result.current.goBack()
    })

    expect(result.current.breadcrumbs).toEqual([{ id: '1', title: '书签栏' }])
    expect(result.current.currentFolder).toEqual({ id: '11', title: '技术' })

    await act(async () => {
      await result.current.goBack()
    })

    expect(result.current.breadcrumbs).toEqual([])
    expect(result.current.currentFolder).toEqual({ id: '1', title: '书签栏' })
  })

  it('navigateToBreadcrumb 可跳回指定层级', async () => {
    const { result } = renderHook(() => useBookmarkNavigation())
    await waitFor(() => expect(result.current.currentItems).toHaveLength(1))

    await act(async () => {
      await result.current.enterFolder('111', '前端', [{ id: '11', title: '技术' }])
    })

    await act(async () => {
      await result.current.navigateToBreadcrumb(0)
    })

    expect(result.current.breadcrumbs).toEqual([])
    expect(result.current.currentFolder).toEqual({ id: '1', title: '书签栏' })
  })
})
