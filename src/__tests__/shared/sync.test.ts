import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  normalizeFolderPath,
  SyncEngine,
  isValidBookmarkName,
  buildBookmarkFileName,
  extractBookmarkName,
  isBookmarkFileName,
} from '../../shared/sync'
import type { AppConfig, Bookmark } from '../../shared/types'

const TEST_CONFIG: AppConfig = {
  githubToken: 'test-token',
  repoOwner: 'test-owner',
  repoName: 'test-repo',
  cleanEmptyFolders: true,
  theme: 'dark',
  syncFileName: '',
  pullFileName: '',
  autoSyncInterval: 0,
}

function mockFetchResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response
}

describe('书签文件名工具', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('isValidBookmarkName 应接受英文名', () => {
    expect(isValidBookmarkName('chrome')).toBe(true)
    expect(isValidBookmarkName('Edge_2')).toBe(true)
    expect(isValidBookmarkName('firefox-beta')).toBe(true)
  })

  it('isValidBookmarkName 应拒绝非法名', () => {
    expect(isValidBookmarkName('')).toBe(false)
    expect(isValidBookmarkName('1chrome')).toBe(false)
    expect(isValidBookmarkName('中文')).toBe(false)
    expect(isValidBookmarkName('chrome name')).toBe(false)
    expect(isValidBookmarkName('a'.repeat(51))).toBe(false)
  })

  it('buildBookmarkFileName 应生成 bookmarks-[name].json', () => {
    expect(buildBookmarkFileName('chrome')).toBe('bookmarks-chrome.json')
  })

  it('extractBookmarkName 应提取 name', () => {
    expect(extractBookmarkName('bookmarks-chrome.json')).toBe('chrome')
    expect(extractBookmarkName('bookmarks.json')).toBeNull()
    expect(extractBookmarkName('other.json')).toBeNull()
  })

  it('isBookmarkFileName 应兼容旧版和新版格式', () => {
    expect(isBookmarkFileName('bookmarks.json')).toBe(true)
    expect(isBookmarkFileName('bookmarks-chrome.json')).toBe(true)
    expect(isBookmarkFileName('bookmarks-edge-2.json')).toBe(true)
    expect(isBookmarkFileName('README.md')).toBe(false)
    expect(isBookmarkFileName('bookmarks-chrome.txt')).toBe(false)
  })
})

describe('SyncEngine 多文件操作', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('listBookmarkFiles 应只返回 bookmarks*.json 文件', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(200, [
      { name: 'bookmarks.json', type: 'file' },
      { name: 'bookmarks-chrome.json', type: 'file' },
      { name: 'bookmarks-edge.json', type: 'file' },
      { name: 'README.md', type: 'file' },
      { name: 'docs', type: 'dir' },
    ])))

    const engine = new SyncEngine(TEST_CONFIG)
    const steps: string[] = []
    const files = await engine.listBookmarkFiles(steps)

    expect(files).toEqual(['bookmarks-chrome.json', 'bookmarks-edge.json', 'bookmarks.json'])
  })

  it('listBookmarkFiles 空仓库（contents 404 但仓库存在）应返回空列表', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse(404, {}))          // contents 404
      .mockResolvedValueOnce(mockFetchResponse(200, { full_name: 'test-owner/test-repo' })) // 仓库存在

    vi.stubGlobal('fetch', fetchMock)

    const engine = new SyncEngine(TEST_CONFIG)
    const steps: string[] = []
    const files = await engine.listBookmarkFiles(steps)

    expect(files).toEqual([])
  })

  it('listBookmarkFiles 仓库不存在时抛出明确错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(404, {})))

    const engine = new SyncEngine(TEST_CONFIG)
    const steps: string[] = []

    await expect(engine.listBookmarkFiles(steps)).rejects.toThrow('仓库不存在或 Token 无权访问')
  })

  it('pushOnly 应向指定文件 PUT（含 sha 覆盖）', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse(200, { sha: 'abc123' })) // 获取 sha
      .mockResolvedValueOnce(mockFetchResponse(200, { content: {} }))   // PUT

    vi.stubGlobal('fetch', fetchMock)

    const engine = new SyncEngine(TEST_CONFIG)
    const steps: string[] = []
    const bookmarks: Bookmark[] = [{ id: '1', title: 'A', url: 'https://a.com', folder: '/', tags: [], createdAt: '', updatedAt: '' }]

    await engine.pushOnly(bookmarks, steps, 'bookmarks-chrome.json')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const putCall = fetchMock.mock.calls[1]
    expect(String(putCall[0])).toContain('contents/bookmarks-chrome.json')
    expect(putCall[1].method).toBe('PUT')
    expect(JSON.parse(putCall[1].body).sha).toBe('abc123')
    expect(JSON.parse(putCall[1].body).message).toBe('sync bookmarks: 1 items')
  })

  it('pushOnly 文件不存在时应自动新建（无 sha）', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse(404, {}))
      .mockResolvedValueOnce(mockFetchResponse(200, { content: {} }))

    vi.stubGlobal('fetch', fetchMock)

    const engine = new SyncEngine(TEST_CONFIG)
    const steps: string[] = []
    await engine.pushOnly([], steps, 'bookmarks-firefox.json')

    const putCall = fetchMock.mock.calls[1]
    expect(JSON.parse(putCall[1].body).sha).toBeUndefined()
    expect(steps.some(s => s.includes('远程文件不存在，将新建'))).toBe(true)
  })

  it('pullOnly 应从指定文件读取并解码', async () => {
    const bookmarks: Bookmark[] = [{ id: '1', title: 'A', url: 'https://a.com', folder: '/', tags: [], createdAt: '', updatedAt: '' }]
    const content = btoa(JSON.stringify(bookmarks))

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(200, { content })))

    const engine = new SyncEngine(TEST_CONFIG)
    const steps: string[] = []
    const result = await engine.pullOnly(steps, 'bookmarks-edge.json')

    expect(result).toEqual(bookmarks)
    expect(String(fetchMockCalls()[0])).toContain('contents/bookmarks-edge.json')
  })

  it('pullOnly 文件不存在时返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(404, {})))

    const engine = new SyncEngine(TEST_CONFIG)
    const steps: string[] = []
    const result = await engine.pullOnly(steps, 'bookmarks-missing.json')

    expect(result).toEqual([])
  })
})

function fetchMockCalls() {
  return vi.mocked(fetch).mock.calls.map(c => c[0])
}

describe('normalizeFolderPath', () => {
  it('应该返回根路径 "/" 对于空字符串', () => {
    expect(normalizeFolderPath('')).toBe('/')
  })

  it('应该去掉多余斜杠', () => {
    expect(normalizeFolderPath('//a//b//')).toBe('/a/b')
  })

  it('应该保证以单斜杠开头', () => {
    expect(normalizeFolderPath('a/b')).toBe('/a/b')
  })

  it('应该保留已有正确格式', () => {
    expect(normalizeFolderPath('/书签栏/子文件夹')).toBe('/书签栏/子文件夹')
  })
})

describe('SyncEngine.computeDiff', () => {
  const makeBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
    id: '1',
    title: 'Test',
    url: 'https://example.com',
    folder: '/',
    tags: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  })

  it('应该检测远程新增的书签', () => {
    const remote: Bookmark[] = [makeBookmark({ id: 'r1', title: 'New', url: 'https://new.com' })]
    const local: Bookmark[] = []

    const diffs = SyncEngine.computeDiff(remote, local)

    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe('added')
    expect(diffs[0].remote.title).toBe('New')
  })

  it('应该检测本地独有的书签为删除', () => {
    const remote: Bookmark[] = []
    const local: Bookmark[] = [makeBookmark({ id: 'l1', title: 'Local Only', url: 'https://local.com' })]

    const diffs = SyncEngine.computeDiff(remote, local)

    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe('deleted')
    expect(diffs[0].local!.title).toBe('Local Only')
  })

  it('应该检测标题修改', () => {
    const remote: Bookmark[] = [makeBookmark({ id: 'r1', title: 'Updated', url: 'https://same.com' })]
    const local: Bookmark[] = [makeBookmark({ id: 'l1', title: 'Original', url: 'https://same.com' })]

    const diffs = SyncEngine.computeDiff(remote, local)

    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe('modified')
    expect(diffs[0].changes).toHaveLength(1)
    expect(diffs[0].changes![0].from).toBe('Original')
    expect(diffs[0].changes![0].to).toBe('Updated')
  })

  it('应该检测文件夹路径修改', () => {
    const remote: Bookmark[] = [makeBookmark({ id: 'r1', title: 'Same', url: 'https://same.com', folder: '/new-folder' })]
    const local: Bookmark[] = [makeBookmark({ id: 'l1', title: 'Same', url: 'https://same.com', folder: '/old-folder' })]

    const diffs = SyncEngine.computeDiff(remote, local)

    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe('modified')
    expect(diffs[0].changes![0].field).toBe('folder')
  })

  it('完全相同时应返回空差异', () => {
    const remote: Bookmark[] = [makeBookmark({ id: 'r1', title: 'Same', url: 'https://same.com' })]
    const local: Bookmark[] = [makeBookmark({ id: 'l1', title: 'Same', url: 'https://same.com' })]

    const diffs = SyncEngine.computeDiff(remote, local)

    expect(diffs).toHaveLength(0)
  })

  it('应正确匹配重复URL的书签', () => {
    const remote: Bookmark[] = [
      makeBookmark({ id: 'r1', title: 'A', url: 'https://dup.com' }),
      makeBookmark({ id: 'r2', title: 'B', url: 'https://dup.com' }),
    ]
    const local: Bookmark[] = [
      makeBookmark({ id: 'l1', title: 'A', url: 'https://dup.com' }),
    ]

    const diffs = SyncEngine.computeDiff(remote, local)

    // 第一个匹配成功，第二个是新增
    const added = diffs.filter(d => d.type === 'added')
    expect(added).toHaveLength(1)
  })
})
