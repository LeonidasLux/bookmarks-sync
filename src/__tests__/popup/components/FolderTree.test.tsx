import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, within } from '@testing-library/react'
import { renderWithTheme } from '../test-utils'
import { FolderTree } from '../../../extension/popup/components/FolderTree'
import { buildFolderTree } from '../../../extension/popup/hooks/useFolderTree'

const folderTree = buildFolderTree([
  {
    id: '1',
    title: '书签栏',
    children: [
      {
        id: '11',
        title: '技术',
        children: [
          { id: '111', title: '前端', children: [] },
        ],
      },
      { id: '12', title: '工具', children: [] },
    ],
  },
  { id: '9', title: '书签条目', url: 'https://example.com' },
] as chrome.bookmarks.BookmarkTreeNode[])

function getRow(title: string): HTMLElement {
  const row = screen.getByText(title).closest('[data-testid="folder-tree-row"]')
  if (!row) throw new Error(`未找到目录行：${title}`)
  return row as HTMLElement
}

describe('FolderTree', () => {
  it('展开的节点渲染子级，折叠的节点隐藏子级', () => {
    const { rerender } = renderWithTheme(
      <FolderTree
        nodes={folderTree}
        expandedIds={new Set(['1', '11'])}
        onToggleExpand={vi.fn()}
      />,
    )

    expect(screen.getByText('技术')).toBeInTheDocument()
    expect(screen.getByText('前端')).toBeInTheDocument()

    rerender(
      <FolderTree nodes={folderTree} expandedIds={new Set(['1'])} onToggleExpand={vi.fn()} />,
    )

    expect(screen.getByText('技术')).toBeInTheDocument()
    expect(screen.queryByText('前端')).not.toBeInTheDocument()
  })

  it('忽略书签条目，只渲染文件夹', () => {
    renderWithTheme(
      <FolderTree nodes={folderTree} expandedIds={new Set(['1', '11'])} onToggleExpand={vi.fn()} />,
    )

    expect(screen.queryByText('书签条目')).not.toBeInTheDocument()
  })

  it('点击箭头触发 onToggleExpand，且不触发 onSelect', () => {
    const onToggleExpand = vi.fn()
    const onSelect = vi.fn()
    renderWithTheme(
      <FolderTree
        nodes={folderTree}
        expandedIds={new Set(['1'])}
        onToggleExpand={onToggleExpand}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(within(getRow('技术')).getByTestId('folder-tree-toggle'))

    expect(onToggleExpand).toHaveBeenCalledWith('11')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('点击行主体触发 onSelect 并传入节点', () => {
    const onSelect = vi.fn()
    renderWithTheme(
      <FolderTree
        nodes={folderTree}
        expandedIds={new Set(['1', '11'])}
        onToggleExpand={vi.fn()}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByText('前端'))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      id: '111',
      title: '前端',
      path: '书签栏/技术/前端',
    })
  })

  it('行内只展示目录名，完整路径放在 hover 提示里', () => {
    renderWithTheme(
      <FolderTree
        nodes={folderTree}
        expandedIds={new Set(['1', '11'])}
        onToggleExpand={vi.fn()}
      />,
    )

    // 不再渲染路径子行
    expect(screen.queryByText('书签栏/技术/前端')).not.toBeInTheDocument()
    expect(getRow('前端')).toHaveAttribute('title', '书签栏/技术/前端')
  })

  it('renderMeta 渲染行尾内容，选中行标记 aria-selected', () => {
    renderWithTheme(
      <FolderTree
        nodes={folderTree}
        expandedIds={new Set(['1'])}
        onToggleExpand={vi.fn()}
        selectedId="11"
        renderMeta={node => <span>meta-{node.id}</span>}
      />,
    )

    expect(within(getRow('技术')).getByText('meta-11')).toBeInTheDocument()
    expect(getRow('技术')).toHaveAttribute('aria-selected', 'true')
    expect(getRow('工具')).toHaveAttribute('aria-selected', 'false')
  })

  it('缩进随层级递增，itemIdPrefix 生成行 id', () => {
    renderWithTheme(
      <FolderTree
        nodes={folderTree}
        expandedIds={new Set(['1', '11'])}
        onToggleExpand={vi.fn()}
        itemIdPrefix="folder-item-"
      />,
    )

    const rootIndent = parseInt(getRow('书签栏').style.paddingLeft, 10)
    const childIndent = parseInt(getRow('技术').style.paddingLeft, 10)
    const grandChildIndent = parseInt(getRow('前端').style.paddingLeft, 10)

    expect(getRow('书签栏')).toHaveAttribute('id', 'folder-item-1')
    expect(childIndent).toBeGreaterThan(rootIndent)
    expect(grandChildIndent).toBeGreaterThan(childIndent)
  })

  it('无子目录的节点不带展开箭头', () => {
    const onToggleExpand = vi.fn()
    renderWithTheme(
      <FolderTree
        nodes={folderTree}
        expandedIds={new Set(['1'])}
        onToggleExpand={onToggleExpand}
      />,
    )

    const toggle = within(getRow('工具')).getByTestId('folder-tree-toggle')
    expect(toggle).toHaveTextContent('')

    fireEvent.click(toggle)
    expect(onToggleExpand).not.toHaveBeenCalled()
  })
})
