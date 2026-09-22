import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  buildFolderTree,
  collectFolderIds,
  filterFolderTree,
  useFolderTree,
} from '../../../extension/popup/hooks/useFolderTree'

const chromeNodes = [
  {
    id: '1',
    title: '书签栏',
    children: [
      {
        id: '11',
        title: '技术',
        children: [{ id: '111', title: '前端', children: [] }],
      },
      { id: '12', title: '工具', children: [] },
    ],
  },
  { id: '2', title: '其他书签', children: [] },
  { id: '99', title: '书签条目', url: 'https://example.com' },
] as chrome.bookmarks.BookmarkTreeNode[]

describe('buildFolderTree', () => {
  it('递归构建目录树并填充路径与祖先链', () => {
    const tree = buildFolderTree(chromeNodes)

    expect(tree.map(n => n.id)).toEqual(['1', '2'])

    const tech = tree[0].children[0]
    expect(tech.path).toBe('书签栏/技术')
    expect(tech.ancestors).toEqual([{ id: '1', title: '书签栏' }])

    const frontend = tech.children[0]
    expect(frontend.path).toBe('书签栏/技术/前端')
    expect(frontend.ancestors).toEqual([
      { id: '1', title: '书签栏' },
      { id: '11', title: '技术' },
    ])
    expect(frontend.children).toEqual([])
  })

  it('忽略书签条目，无标题目录使用占位名', () => {
    const tree = buildFolderTree([
      { id: '1', title: '', children: [] },
      { id: '2', title: '书签', url: 'https://example.com' },
    ] as chrome.bookmarks.BookmarkTreeNode[])

    expect(tree).toHaveLength(1)
    expect(tree[0].title).toBe('未命名目录')
    expect(tree[0].path).toBe('未命名目录')
  })
})

describe('collectFolderIds', () => {
  it('深度优先收集全部目录 id', () => {
    expect(collectFolderIds(buildFolderTree(chromeNodes))).toEqual(['1', '11', '111', '12', '2'])
  })

  it('空树返回空数组', () => {
    expect(collectFolderIds([])).toEqual([])
  })
})

describe('filterFolderTree', () => {
  const tree = buildFolderTree(chromeNodes)

  it('空关键词返回原树', () => {
    expect(filterFolderTree(tree, '   ')).toBe(tree)
  })

  it('命中节点保留完整子树，并为命中的子孙保留祖先链', () => {
    const filtered = filterFolderTree(tree, '技术')

    expect(filtered.map(n => n.id)).toEqual(['1'])
    expect(filtered[0].children.map(n => n.id)).toEqual(['11'])
    // 命中节点自身保留完整子树
    expect(filtered[0].children[0].children.map(n => n.id)).toEqual(['111'])
  })

  it('深层命中时保留祖先链', () => {
    const filtered = filterFolderTree(tree, '前端')

    expect(filtered.map(n => n.id)).toEqual(['1'])
    expect(filtered[0].children.map(n => n.id)).toEqual(['11'])
    expect(filtered[0].children[0].children.map(n => n.id)).toEqual(['111'])
  })

  it('按路径命中：搜索"书签栏/工具"', () => {
    const filtered = filterFolderTree(tree, '书签栏/工具')

    const ids = filtered.flatMap(n => n.children.map(c => c.id))
    expect(ids).toContain('12')
  })

  it('无匹配返回空数组', () => {
    expect(filterFolderTree(tree, '不存在_xyz')).toEqual([])
  })
})

describe('useFolderTree', () => {
  const tree = buildFolderTree(chromeNodes)

  it('数据到达后默认全部展开', async () => {
    const { result } = renderHook(() => useFolderTree(tree))

    await waitFor(() => expect(result.current.allExpanded).toBe(true))

    expect(result.current.isExpanded('11')).toBe(true)
    expect(result.current.expandedIds.size).toBe(5)
  })

  it('toggleExpand 可折叠 / 重新展开指定目录', async () => {
    const { result } = renderHook(() => useFolderTree(tree))
    await waitFor(() => expect(result.current.allExpanded).toBe(true))

    act(() => result.current.toggleExpand('11'))
    expect(result.current.isExpanded('11')).toBe(false)
    expect(result.current.allExpanded).toBe(false)

    act(() => result.current.toggleExpand('11'))
    expect(result.current.isExpanded('11')).toBe(true)
  })

  it('collapseAll / expandAll 切换整体展开状态', async () => {
    const { result } = renderHook(() => useFolderTree(tree))
    await waitFor(() => expect(result.current.allExpanded).toBe(true))

    act(() => result.current.collapseAll())
    expect(result.current.expandedIds.size).toBe(0)
    expect(result.current.allExpanded).toBe(false)

    act(() => result.current.expandAll())
    expect(result.current.allExpanded).toBe(true)
  })

  it('defaultExpanded 为 false 时默认全部折叠', async () => {
    const { result } = renderHook(() => useFolderTree(tree, { defaultExpanded: false }))

    await waitFor(() => expect(result.current.expandedIds.size).toBe(0))

    expect(result.current.isExpanded('1')).toBe(false)
    expect(result.current.allExpanded).toBe(false)
  })

  it('空树时保持折叠状态，数据到达后按默认策略展开', async () => {
    const { result, rerender } = renderHook(
      ({ nodes }: { nodes: typeof tree }) => useFolderTree(nodes),
      { initialProps: { nodes: [] as typeof tree } },
    )

    expect(result.current.expandedIds.size).toBe(0)

    rerender({ nodes: tree })

    await waitFor(() => expect(result.current.allExpanded).toBe(true))
  })

  it('切换到另一层目录（树根变化）时重新按默认策略展开', async () => {
    const otherRoot = buildFolderTree([
      {
        id: '21',
        title: '工作',
        children: [{ id: '211', title: '会议', children: [] }],
      },
    ] as chrome.bookmarks.BookmarkTreeNode[])

    const { result, rerender } = renderHook(
      ({ nodes }: { nodes: typeof tree }) => useFolderTree(nodes),
      { initialProps: { nodes: tree } },
    )
    await waitFor(() => expect(result.current.allExpanded).toBe(true))

    act(() => result.current.toggleExpand('11'))
    expect(result.current.isExpanded('11')).toBe(false)

    rerender({ nodes: otherRoot })

    await waitFor(() => expect(result.current.isExpanded('211')).toBe(true))
    expect(result.current.isExpanded('11')).toBe(false)
  })
})
