import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectFolderCandidates } from '../../extension/background/folder-suggest'

const mockTree: chrome.bookmarks.BookmarkTreeNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks bar',
        children: [
          {
            id: '11',
            title: '开发',
            children: [
              { id: '111', title: 'React 文档', url: 'https://react.dev/learn' },
              { id: '112', title: '前端小站', url: 'https://www.example.com/' },
              { id: '12', title: '前端', children: [] },
            ],
          },
          { id: '13', title: '工具', children: [] },
        ],
      },
      { id: '2', title: '其他书签', children: [] },
    ],
  },
]

beforeEach(() => {
  vi.spyOn(chrome.bookmarks, 'getTree').mockResolvedValue(mockTree)
})

describe('collectFolderCandidates', () => {
  it('应展开所有目录并统一根目录名称', async () => {
    const candidates = await collectFolderCandidates()
    const paths = candidates.map(c => c.path)

    expect(paths).toEqual([
      '书签栏',
      '书签栏/开发',
      '书签栏/开发/前端',
      '书签栏/工具',
      '其他书签',
    ])
    // 根节点自身不产生候选
    expect(candidates.every(c => c.path.length > 0)).toBe(true)
  })

  it('应为每个目录收集书签样本与子目录名', async () => {
    const candidates = await collectFolderCandidates()
    const dev = candidates.find(c => c.id === '11')!

    expect(dev.samples).toContain('React 文档 (react.dev)')
    expect(dev.samples).toContain('前端小站 (example.com)')
    expect(dev.subfolders).toEqual(['前端'])
  })
})
