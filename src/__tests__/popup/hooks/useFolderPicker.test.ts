import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFolderPicker } from '../../../extension/popup/hooks/useFolderPicker'
import type { FolderNode } from '../../../extension/popup/hooks/useFolderPicker'
import type { FolderTreeNode } from '../../../extension/popup/hooks/useFolderTree'

/** 深度优先展开目录树，便于断言 */
function flatten(nodes: FolderTreeNode[]): FolderTreeNode[] {
  return nodes.flatMap(node => [node, ...flatten(node.children)])
}

const mockTree: chrome.bookmarks.BookmarkTreeNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: '书签栏',
        children: [
          {
            id: '11',
            title: '技术',
            children: [
              {
                id: '111',
                title: '前端',
                dateAdded: Date.now(),
                children: [
                  { id: '1111', title: 'React 文档', url: 'https://react.dev', dateAdded: Date.now() },
                ],
              },
              { id: '112', title: '后端', children: [] },
            ],
          },
          { id: '12', title: '工具', children: [] },
        ],
      },
      {
        id: '2',
        title: '其他书签',
        children: [
          { id: '21', title: '工作', children: [] },
        ],
      },
      {
        id: '3',
        title: '移动设备书签',
        children: [],
      },
    ],
  },
]

beforeEach(() => {
  vi.spyOn(chrome.bookmarks, 'getTree').mockResolvedValue(mockTree)
})

describe('useFolderPicker', () => {
  it('应加载所有文件夹并默认选中第一个', async () => {
    const { result } = renderHook(() => useFolderPicker())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.allFolders.length).toBeGreaterThanOrEqual(6)

    const folderIds = result.current.allFolders.map((f: FolderNode) => f.id)
    expect(folderIds).toContain('1')
    expect(folderIds).toContain('11')
    expect(folderIds).toContain('111')
    expect(folderIds).toContain('12')
    expect(folderIds).toContain('2')
    expect(folderIds).toContain('21')
    expect(folderIds).toContain('3')

    // 文件夹路径应为可读路径
    const frontend = result.current.allFolders.find((f: FolderNode) => f.id === '111')
    expect(frontend?.path).toBe('书签栏/技术/前端')

    // 默认选中第一个文件夹
    expect(result.current.selectedFolderId).toBe(result.current.allFolders[0].id)
  })

  it('应过滤书签文件夹（不包含书签条目）', async () => {
    const { result } = renderHook(() => useFolderPicker())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // 不应包含书签条目（有 url 属性的节点）
    const hasBookmark = result.current.allFolders.some((f: FolderNode) => f.id === '1111')
    expect(hasBookmark).toBe(false)
  })

  it('searchQuery 应为空字符串（默认初始值）', async () => {
    const { result } = renderHook(() => useFolderPicker())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.searchQuery).toBe('')
    expect(result.current.filteredTree).toEqual(result.current.folderTree)
  })

  it('应以树形结构组织目录（父子关系与缩进层级）', async () => {
    const { result } = renderHook(() => useFolderPicker())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // 顶层目录为书签栏 / 其他书签 / 移动设备书签
    expect(result.current.folderTree.map(n => n.id)).toEqual(['1', '2', '3'])

    const bookmarkBar = result.current.folderTree[0]
    expect(bookmarkBar.children.map(n => n.id)).toEqual(['11', '12'])

    const tech = bookmarkBar.children[0]
    expect(tech.children.map(n => n.id)).toEqual(['111', '112'])

    // 深层目录携带祖先链，便于拼接面包屑
    expect(flatten(result.current.folderTree).find(n => n.id === '111')?.ancestors)
      .toEqual([
        { id: '1', title: '书签栏' },
        { id: '11', title: '技术' },
      ])
  })

  it('设置 searchQuery 后应过滤目录树并保留祖先链', async () => {
    const { result } = renderHook(() => useFolderPicker())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setSearchQuery('技术')
    })

    // 书签栏作为命中的「技术」的祖先被保留，工具与其他书签被剪掉
    expect(result.current.filteredTree.map(n => n.id)).toEqual(['1'])
    expect(result.current.filteredTree[0].children.map(n => n.id)).toEqual(['11'])
  })

  it('搜索"前端"应匹配文件夹名称和路径', async () => {
    const { result } = renderHook(() => useFolderPicker())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setSearchQuery('前端')
    })

    const matched = flatten(result.current.filteredTree).map(f => f.id)
    expect(matched).toEqual(['1', '11', '111'])
  })

  it('无匹配搜索应返回空列表', async () => {
    const { result } = renderHook(() => useFolderPicker())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setSearchQuery('不存在的文件夹名称_xyz')
    })

    expect(result.current.filteredTree).toHaveLength(0)
  })

  it('clearSearch 应重置搜索', async () => {
    const { result } = renderHook(() => useFolderPicker())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setSearchQuery('前端'))
    expect(result.current.searchQuery).toBe('前端')

    act(() => result.current.clearSearch())
    expect(result.current.searchQuery).toBe('')
    expect(result.current.filteredTree).toEqual(result.current.folderTree)
  })

  it('应正确设置选中文件夹', async () => {
    const { result } = renderHook(() => useFolderPicker())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setSelectedFolderId('11')
    })
    expect(result.current.selectedFolderId).toBe('11')
    expect(result.current.selectedFolder?.title).toBe('技术')
  })

  it('getTree 异常时应有保护', async () => {
    vi.spyOn(chrome.bookmarks, 'getTree').mockRejectedValue(new Error('API error'))

    const { result } = renderHook(() => useFolderPicker())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.allFolders).toEqual([])
    expect(result.current.folderTree).toEqual([])
    expect(result.current.filteredTree).toEqual([])
  })
})
