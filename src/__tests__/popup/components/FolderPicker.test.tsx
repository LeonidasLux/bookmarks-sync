import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithTheme } from '../test-utils'
import userEvent from '@testing-library/user-event'
import { FolderPicker } from '../../../extension/popup/components/FolderPicker'

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
              { id: '111', title: '前端', children: [] },
            ],
          },
          { id: '12', title: '工具', children: [] },
        ],
      },
      {
        id: '2',
        title: '其他书签',
        children: [],
      },
    ],
  },
]

beforeEach(() => {
  vi.spyOn(chrome.bookmarks, 'getTree').mockResolvedValue(mockTree)
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** 获取文件夹列表中指定标题的元素（title span） */
function getFolderItem(title: string): HTMLElement | null {
  const allTitleSpans = screen.queryAllByText(title)
  return allTitleSpans.find(
    el => el.tagName === 'SPAN' && el.style.fontWeight === '500',
  ) ?? null
}

/** 获取目录树中指定标题所在的行 */
function getTreeRow(title: string): HTMLElement {
  const item = getFolderItem(title)
  const row = item?.closest('[data-testid="folder-tree-row"]')
  if (!row) throw new Error(`未找到目录行：${title}`)
  return row as HTMLElement
}

describe('FolderPicker', () => {
  const INITIAL_TITLE = '测试页面标题'

  it('应渲染标题、书签标题输入框和搜索框', async () => {
    const onSave = vi.fn()
    const onBack = vi.fn()

    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={onSave} onBack={onBack} />)

    await waitFor(() => {
      expect(screen.getByText('保存书签')).toBeInTheDocument()
    })

    // 书签标题输入框应存在并已填入初始值
    const titleInput = screen.getByDisplayValue(INITIAL_TITLE) as HTMLInputElement
    expect(titleInput).toBeInTheDocument()
    expect(titleInput.tagName).toBe('INPUT')

    expect(screen.getByPlaceholderText('搜索目录...')).toBeInTheDocument()
  })

  it('应可编辑书签标题', async () => {
    const onSave = vi.fn()
    const onBack = vi.fn()

    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={onSave} onBack={onBack} />)

    await waitFor(() => {
      expect(screen.getByText('保存书签')).toBeInTheDocument()
    })

    const titleInput = screen.getByDisplayValue(INITIAL_TITLE) as HTMLInputElement
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, '自定义标题')

    expect(titleInput).toHaveValue('自定义标题')
  })

  it('应渲染文件夹列表', async () => {
    const onSave = vi.fn()
    const onBack = vi.fn()

    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={onSave} onBack={onBack} />)

    await waitFor(() => {
      expect(getFolderItem('书签栏')).toBeTruthy()
    })

    expect(getFolderItem('技术')).toBeTruthy()
    expect(getFolderItem('工具')).toBeTruthy()
    expect(getFolderItem('其他书签')).toBeTruthy()
  })

  it('搜索应过滤文件夹', async () => {
    const onSave = vi.fn()
    const onBack = vi.fn()

    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={onSave} onBack={onBack} />)

    await waitFor(() => {
      expect(getFolderItem('书签栏')).toBeTruthy()
    })

    const searchInput = screen.getByPlaceholderText('搜索目录...')
    await userEvent.type(searchInput, '技术')

    expect(getFolderItem('技术')).toBeTruthy()

    await waitFor(() => {
      expect(getFolderItem('工具')).toBeNull()
    })
    expect(getFolderItem('其他书签')).toBeNull()
  })

  it('应树形展示嵌套目录，箭头可折叠 / 展开子目录', async () => {
    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={vi.fn()} onBack={vi.fn()} />)

    await waitFor(() => {
      expect(getFolderItem('书签栏')).toBeTruthy()
    })

    // 默认展开：父目录下的子目录直接可见，且层级更深
    expect(getFolderItem('前端')).toBeTruthy()
    expect(parseInt(getTreeRow('前端').style.paddingLeft, 10))
      .toBeGreaterThan(parseInt(getTreeRow('技术').style.paddingLeft, 10))

    // 点击父目录箭头折叠，子目录隐藏
    await userEvent.click(within(getTreeRow('技术')).getByTestId('folder-tree-toggle'))
    await waitFor(() => {
      expect(getFolderItem('前端')).toBeNull()
    })
    // 父目录自身仍然可见
    expect(getFolderItem('技术')).toBeTruthy()

    // 再次点击恢复展开
    await userEvent.click(within(getTreeRow('技术')).getByTestId('folder-tree-toggle'))
    await waitFor(() => {
      expect(getFolderItem('前端')).toBeTruthy()
    })
  })

  it('点击箭头不应改变已选目录', async () => {
    const onSave = vi.fn()
    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={onSave} onBack={vi.fn()} />)

    await waitFor(() => {
      expect(getFolderItem('技术')).toBeTruthy()
    })

    // 默认选中第一个目录（书签栏），折叠它之后保存仍写入书签栏
    await userEvent.click(within(getTreeRow('书签栏')).getByTestId('folder-tree-toggle'))
    await userEvent.click(screen.getByText('保存'))

    expect(onSave).toHaveBeenCalledWith('1', INITIAL_TITLE)
  })

  it('展开全部 / 折叠全部 可切换整棵目录树', async () => {
    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={vi.fn()} onBack={vi.fn()} />)

    await waitFor(() => {
      expect(getFolderItem('前端')).toBeTruthy()
    })

    await userEvent.click(screen.getByTestId('folder-tree-expand-toggle'))
    await waitFor(() => {
      expect(getFolderItem('前端')).toBeNull()
      expect(getFolderItem('技术')).toBeNull()
    })
    // 按钮文案切换为「展开全部」
    expect(screen.getByTestId('folder-tree-expand-toggle')).toHaveTextContent('展开全部')

    await userEvent.click(screen.getByTestId('folder-tree-expand-toggle'))
    await waitFor(() => {
      expect(getFolderItem('前端')).toBeTruthy()
    })
  })

  it('搜索命中深层目录时保留祖先链，可直接选中保存', async () => {
    const onSave = vi.fn()
    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={onSave} onBack={vi.fn()} />)

    await waitFor(() => {
      expect(getFolderItem('书签栏')).toBeTruthy()
    })

    await userEvent.type(screen.getByPlaceholderText('搜索目录...'), '前端')

    // 祖先链保留：书签栏 / 技术 / 前端
    expect(getFolderItem('书签栏')).toBeTruthy()
    expect(getFolderItem('技术')).toBeTruthy()
    expect(getFolderItem('前端')).toBeTruthy()
    expect(getFolderItem('工具')).toBeNull()

    await userEvent.click(getFolderItem('前端')!)
    await userEvent.click(screen.getByText('保存'))

    expect(onSave).toHaveBeenCalledWith('111', INITIAL_TITLE)
  })

  it('无匹配搜索应显示空状态', async () => {
    const onSave = vi.fn()
    const onBack = vi.fn()

    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={onSave} onBack={onBack} />)

    await waitFor(() => {
      expect(getFolderItem('书签栏')).toBeTruthy()
    })

    const searchInput = screen.getByPlaceholderText('搜索目录...')
    await userEvent.type(searchInput, '不存在的文件夹')

    expect(screen.getByText('∅ 未找到匹配的目录')).toBeInTheDocument()
  })

  it('选中文件夹并点击保存应调用 onSave 并传入标题和文件夹 ID', async () => {
    const onSave = vi.fn()
    const onBack = vi.fn()

    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={onSave} onBack={onBack} />)

    await waitFor(() => {
      expect(getFolderItem('技术')).toBeTruthy()
    })

    // 点击技术文件夹
    const techFolder = getFolderItem('技术')!
    await userEvent.click(techFolder)

    // 点击保存按钮
    await userEvent.click(screen.getByText('保存'))

    // 应传入文件夹 ID 和标题
    expect(onSave).toHaveBeenCalledWith('11', INITIAL_TITLE)
    expect(onBack).not.toHaveBeenCalled()
  })

  it('编辑标题后保存应传入修改后的标题', async () => {
    const onSave = vi.fn()
    const onBack = vi.fn()

    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={onSave} onBack={onBack} />)

    await waitFor(() => {
      expect(getFolderItem('书签栏')).toBeTruthy()
    })

    // 修改标题
    const titleInput = screen.getByDisplayValue(INITIAL_TITLE) as HTMLInputElement
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, '修改后的标题')

    // 保存
    await userEvent.click(screen.getByText('保存'))
    expect(onSave).toHaveBeenCalledWith('1', '修改后的标题')
  })

  it('取消按钮应调用 onBack', async () => {
    const onSave = vi.fn()
    const onBack = vi.fn()

    renderWithTheme(<FolderPicker initialTitle={INITIAL_TITLE} onSave={onSave} onBack={onBack} />)

    await waitFor(() => {
      expect(screen.getByText('保存书签')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('取消'))
    expect(onBack).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('收到 Jev 建议后应预选该目录并给出提示', async () => {
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(((
      _msg: unknown,
      cb?: (res: unknown) => void,
    ) => {
      cb?.({
        success: true,
        suggestion: {
          folderId: '12',
          folderPath: '书签栏/工具',
          confidence: 0.88,
          probabilities: { '12': 0.88 },
          steps: [],
        },
      })
      return Promise.resolve()
    }) as unknown as typeof chrome.runtime.sendMessage)

    const onSave = vi.fn()
    renderWithTheme(
      <FolderPicker
        initialTitle={INITIAL_TITLE}
        pageUrl="https://react.dev/learn"
        onSave={onSave}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Jev 建议/)).toBeInTheDocument()
    })

    // 建议目录被预选，直接保存即写入该目录
    await userEvent.click(screen.getByText('保存'))
    expect(onSave).toHaveBeenCalledWith('12', INITIAL_TITLE)
  })

  it('用户手动改选目录后，不再被 Jev 建议覆盖', async () => {
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(((
      _msg: unknown,
      cb?: (res: unknown) => void,
    ) => {
      // 模拟慢响应：用户已先手动选择
      setTimeout(() => cb?.({
        success: true,
        suggestion: {
          folderId: '12',
          folderPath: '书签栏/工具',
          confidence: 0.88,
          probabilities: { '12': 0.88 },
          steps: [],
        },
      }), 0)
      return Promise.resolve()
    }) as unknown as typeof chrome.runtime.sendMessage)

    const onSave = vi.fn()
    renderWithTheme(
      <FolderPicker
        initialTitle={INITIAL_TITLE}
        pageUrl="https://react.dev/learn"
        onSave={onSave}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(getFolderItem('技术')).toBeTruthy()
    })

    await userEvent.click(getFolderItem('技术')!)
    await waitFor(() => {
      expect(screen.getByText(/Jev 建议/)).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('保存'))
    expect(onSave).toHaveBeenCalledWith('11', INITIAL_TITLE)
  })

  it('应在建议下方按置信度由高到低列出前 5 个备选目录，可点击改选', async () => {
    const altTree: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        id: '0',
        title: '',
        children: [
          {
            id: '1',
            title: '书签栏',
            children: [
              { id: '21', title: 'A', children: [] },
              { id: '22', title: 'B', children: [] },
              { id: '23', title: 'C', children: [] },
              { id: '24', title: 'D', children: [] },
              { id: '25', title: 'E', children: [] },
              { id: '26', title: 'F', children: [] },
            ],
          },
        ],
      },
    ]
    vi.spyOn(chrome.bookmarks, 'getTree').mockResolvedValue(altTree)
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(((
      _msg: unknown,
      cb?: (res: unknown) => void,
    ) => {
      cb?.({
        success: true,
        suggestion: {
          folderId: '21',
          folderPath: '书签栏/A',
          confidence: 0.5,
          probabilities: { '21': 0.5, '22': 0.3, '23': 0.1, '24': 0.05, '25': 0.03, '26': 0.02 },
          steps: [],
        },
      })
      return Promise.resolve()
    }) as unknown as typeof chrome.runtime.sendMessage)

    const onSave = vi.fn()
    renderWithTheme(
      <FolderPicker
        initialTitle={INITIAL_TITLE}
        pageUrl="https://react.dev/learn"
        onSave={onSave}
        onBack={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('备选目录（置信度由高到低）')).toBeInTheDocument()
    })

    const alternatives = screen.getAllByTestId('folder-alternative')
    // 只展示前 5 个，且按置信度降序
    expect(alternatives).toHaveLength(5)
    expect(alternatives.map(el => el.textContent)).toEqual([
      '1书签栏/A50%✓',
      '2书签栏/B30%',
      '3书签栏/C10%',
      '4书签栏/D5.0%',
      '5书签栏/E3.0%',
    ])
    expect(alternatives.some(el => el.textContent?.includes('书签栏/F'))).toBe(false)

    // 点击第 3 个备选后保存，应写入该目录
    await userEvent.click(alternatives[2])
    await userEvent.click(screen.getByText('保存'))
    expect(onSave).toHaveBeenCalledWith('23', INITIAL_TITLE)
  })

})
