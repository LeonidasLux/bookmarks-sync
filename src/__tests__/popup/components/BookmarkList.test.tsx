import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithTheme } from '../test-utils'
import { BookmarkList } from '../../../extension/popup/components/BookmarkList'

/** 取目录树中某个标题所在的行 */
function getTreeRow(title: string): HTMLElement {
  const row = screen.getByText(title).closest('[data-testid="folder-tree-row"]')
  if (!row) throw new Error(`未找到目录行：${title}`)
  return row as HTMLElement
}

describe('BookmarkList', () => {
  const defaultProps = {
    currentItems: [] as chrome.bookmarks.BookmarkTreeNode[],
    isHomeView: false,
    onEnterFolder: vi.fn(),
    onOpenBookmark: vi.fn(),
  }

  it('空列表时显示占位文本', () => {
    renderWithTheme(<BookmarkList {...defaultProps} />)
    expect(screen.getByText('∅ 暂无书签和文件夹')).toBeInTheDocument()
  })

  it('显示目录标签', () => {
    const items: chrome.bookmarks.BookmarkTreeNode[] = [
      { id: '1', title: '目录A', children: [] },
      { id: '2', title: '目录B', children: [] },
    ]
    renderWithTheme(<BookmarkList {...defaultProps} currentItems={items} />)
    expect(screen.getByText('目录A')).toBeInTheDocument()
    expect(screen.getByText('目录B')).toBeInTheDocument()
    // 目录区域应有 section label
    expect(screen.getByText('目录')).toBeInTheDocument()
  })

  it('显示书签行，favicon URL 使用 chrome.runtime.getURL', () => {
    const items: chrome.bookmarks.BookmarkTreeNode[] = [
      { id: '10', title: 'GitHub', url: 'https://github.com' },
      { id: '11', title: 'Google', url: 'https://google.com' },
    ]
    renderWithTheme(<BookmarkList {...defaultProps} currentItems={items} />)

    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()
    // 书签区域应有 section label
    expect(screen.getByText('书签')).toBeInTheDocument()

    const imgs = screen.getAllByRole('img')
    expect(imgs).toHaveLength(2)
    expect(imgs[0]).toHaveAttribute(
      'src',
      'chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fgithub.com&size=16',
    )
    expect(imgs[1]).toHaveAttribute(
      'src',
      'chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fgoogle.com&size=16',
    )
  })

  it('favicon 加载失败时 fallback 显示首字母', async () => {
    const items: chrome.bookmarks.BookmarkTreeNode[] = [
      { id: '10', title: 'GitHub', url: 'https://github.com' },
    ]
    renderWithTheme(<BookmarkList {...defaultProps} currentItems={items} />)

    // 初始渲染 img
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute(
      'src',
      'chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fgithub.com&size=16',
    )

    // 触发加载失败
    fireEvent.error(img)

    // 等待 React 重渲染后，fallback 首字母 'G' 出现
    await waitFor(() => {
      expect(screen.getByText('G')).toBeInTheDocument()
    })
    // img 应被替换移除
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('书签无标题时显示"无标题"', () => {
    const items: chrome.bookmarks.BookmarkTreeNode[] = [
      { id: '10', title: '', url: 'https://example.com' },
    ]
    renderWithTheme(<BookmarkList {...defaultProps} currentItems={items} />)
    expect(screen.getByText('无标题')).toBeInTheDocument()
  })

  it('点击书签行触发 onOpenBookmark', () => {
    const onOpenBookmark = vi.fn()
    const items: chrome.bookmarks.BookmarkTreeNode[] = [
      { id: '10', title: 'GitHub', url: 'https://github.com' },
    ]
    renderWithTheme(
      <BookmarkList
        {...defaultProps}
        currentItems={items}
        onOpenBookmark={onOpenBookmark}
      />,
    )
    fireEvent.click(screen.getByText('GitHub'))
    expect(onOpenBookmark).toHaveBeenCalledWith('https://github.com')
  })

  it('点击目录标签触发 onEnterFolder', () => {
    const onEnterFolder = vi.fn()
    const items: chrome.bookmarks.BookmarkTreeNode[] = [
      { id: '5', title: '我的目录', children: [] },
    ]
    renderWithTheme(
      <BookmarkList
        {...defaultProps}
        currentItems={items}
        onEnterFolder={onEnterFolder}
      />,
    )
    fireEvent.click(screen.getByText('我的目录'))
    expect(onEnterFolder).toHaveBeenCalledWith('5', '我的目录', [])
  })

  it('目录以树形展示且默认全部折叠', () => {
    const items: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        id: '5',
        title: '我的目录',
        children: [
          {
            id: '6',
            title: '子目录',
            children: [{ id: '7', title: '孙目录', children: [] }],
          },
        ],
      },
      { id: '8', title: '空目录', children: [] },
    ]
    renderWithTheme(<BookmarkList {...defaultProps} currentItems={items} />)

    expect(screen.getByTestId('bookmark-folder-tree')).toBeInTheDocument()
    // 默认折叠：只展示当前层的目录
    expect(screen.getByText('我的目录')).toBeInTheDocument()
    expect(screen.getByText('空目录')).toBeInTheDocument()
    expect(screen.queryByText('子目录')).not.toBeInTheDocument()
    expect(screen.queryByText('孙目录')).not.toBeInTheDocument()

    // 有子目录的节点显示折叠箭头，叶子节点没有
    expect(within(getTreeRow('我的目录')).getByTestId('folder-tree-toggle')).toHaveTextContent('▸')
    expect(within(getTreeRow('空目录')).getByTestId('folder-tree-toggle')).toHaveTextContent('')
  })

  it('点击箭头逐级展开子目录且不进入目录', () => {
    const onEnterFolder = vi.fn()
    const items: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        id: '5',
        title: '我的目录',
        children: [
          {
            id: '6',
            title: '子目录',
            children: [{ id: '7', title: '孙目录', children: [] }],
          },
        ],
      },
    ]
    renderWithTheme(
      <BookmarkList
        {...defaultProps}
        currentItems={items}
        onEnterFolder={onEnterFolder}
      />,
    )

    expect(screen.queryByText('子目录')).not.toBeInTheDocument()

    // 展开第一级
    fireEvent.click(within(getTreeRow('我的目录')).getByTestId('folder-tree-toggle'))

    expect(screen.getByText('子目录')).toBeInTheDocument()
    expect(screen.queryByText('孙目录')).not.toBeInTheDocument()
    expect(onEnterFolder).not.toHaveBeenCalled()

    // 层级越深缩进越大
    const parentIndent = parseInt(getTreeRow('我的目录').style.paddingLeft, 10)
    const childIndent = parseInt(getTreeRow('子目录').style.paddingLeft, 10)
    expect(childIndent).toBeGreaterThan(parentIndent)

    // 再展开第二级
    fireEvent.click(within(getTreeRow('子目录')).getByTestId('folder-tree-toggle'))

    const grandChildIndent = parseInt(getTreeRow('孙目录').style.paddingLeft, 10)
    expect(grandChildIndent).toBeGreaterThan(childIndent)
    expect(onEnterFolder).not.toHaveBeenCalled()

    // 再次点击折叠回去
    fireEvent.click(within(getTreeRow('我的目录')).getByTestId('folder-tree-toggle'))
    expect(screen.queryByText('子目录')).not.toBeInTheDocument()
  })

  it('点击嵌套子目录进入目录并携带祖先链', () => {
    const onEnterFolder = vi.fn()
    const items: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        id: '5',
        title: '我的目录',
        children: [
          {
            id: '6',
            title: '子目录',
            children: [{ id: '7', title: '孙目录', children: [] }],
          },
        ],
      },
    ]
    renderWithTheme(
      <BookmarkList
        {...defaultProps}
        currentItems={items}
        onEnterFolder={onEnterFolder}
      />,
    )

    // 默认折叠，需要先展开到目标目录所在层级
    fireEvent.click(within(getTreeRow('我的目录')).getByTestId('folder-tree-toggle'))
    fireEvent.click(within(getTreeRow('子目录')).getByTestId('folder-tree-toggle'))

    fireEvent.click(screen.getByText('孙目录'))
    expect(onEnterFolder).toHaveBeenCalledWith('7', '孙目录', [
      { id: '5', title: '我的目录' },
      { id: '6', title: '子目录' },
    ])
  })

  it('isHomeView 时有内容时底部显示根级目录', () => {
    const items: chrome.bookmarks.BookmarkTreeNode[] = [
      { id: '1', title: 'Folder', children: [] },
    ]
    renderWithTheme(
      <BookmarkList {...defaultProps} currentItems={items} isHomeView={true} />,
    )
    expect(screen.getByText('其他书签')).toBeInTheDocument()
    expect(screen.getByText('移动设备书签')).toBeInTheDocument()
  })

  it('混排时目录在书签之前展示', () => {
    const items: chrome.bookmarks.BookmarkTreeNode[] = [
      { id: '1', title: 'Folder', children: [] },
      { id: '2', title: 'Bookmark', url: 'https://example.com' },
    ]
    renderWithTheme(<BookmarkList {...defaultProps} currentItems={items} />)

    // 目录在前
    expect(screen.getByText('Folder')).toBeInTheDocument()
    // 书签在后
    expect(screen.getByText('Bookmark')).toBeInTheDocument()

    // 验证 favicon 正常渲染
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fexample.com&size=16',
    )
  })
})
