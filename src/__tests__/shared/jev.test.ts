import { describe, it, expect, vi } from 'vitest'
import {
  selectFolderByJev,
  buildFolderCriteria,
  MAX_OPTIONS_PER_QUESTION,
  type FolderCandidate,
  type FetchLike,
} from '../../shared/jev'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

/** 构造只返回指定选项的假 fetch（单问题场景） */
function stubFetch(choices: string[]): FetchLike {
  let call = 0
  return vi.fn(async () => {
    const choice = choices[call] ?? choices[choices.length - 1]
    call += 1
    return jsonResponse({
      model: 'jev-1.13.0',
      answers: {
        folder: { type: 'choice', choice, confidence: 0.9, probabilities: { [choice]: 0.9 } },
      },
      usage: { input_tokens: 100, output_tokens: 10 },
    })
  }) as unknown as FetchLike
}

const page = { title: 'React 官方文档 – 快速开始', url: 'https://react.dev/learn' }

describe('buildFolderCriteria', () => {
  it('应以目录 id 为选项名，并带上路径、书签样本与子目录', () => {
    const candidates: FolderCandidate[] = [
      { id: '11', path: '书签栏/开发/前端', samples: ['React 文档 (react.dev)'], subfolders: ['Vite'] },
      { id: '12', path: '书签栏/工具', samples: [], subfolders: [] },
    ]

    const criteria = buildFolderCriteria(candidates)

    expect(Object.keys(criteria)).toEqual(['11', '12'])
    expect(criteria['11']).toEqual({
      path: '书签栏/开发/前端',
      bookmarks_inside: ['React 文档 (react.dev)'],
      subfolders: ['Vite'],
    })
    // 没有样本的目录只保留路径
    expect(criteria['12']).toEqual({ path: '书签栏/工具' })
  })

  it('应截断过长文本，避免请求体膨胀', () => {
    const long = 'a'.repeat(200)
    const criteria = buildFolderCriteria([
      { id: '1', path: '书签栏', samples: [long] },
    ]) as Record<string, { bookmarks_inside: string[] }>

    expect(criteria['1'].bookmarks_inside[0].length).toBeLessThanOrEqual(60)
  })
})

describe('selectFolderByJev', () => {
  it('只有一个候选目录时直接返回，不发起请求', async () => {
    const fetchImpl = vi.fn() as unknown as FetchLike
    const result = await selectFolderByJev({
      apiKey: 'ts_test',
      page,
      candidates: [{ id: '11', path: '书签栏/开发' }],
      fetchImpl,
    })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result).toMatchObject({ folderId: '11', folderPath: '书签栏/开发', confidence: 1 })
  })

  it('没有候选目录时返回 null', async () => {
    const result = await selectFolderByJev({ apiKey: 'ts_test', page, candidates: [] })
    expect(result).toBeNull()
  })

  it('应把 Jev 选中的选项映射回目录 id 与路径', async () => {
    const candidates: FolderCandidate[] = [
      { id: '11', path: '书签栏/开发/前端' },
      { id: '12', path: '书签栏/工具' },
    ]
    const fetchImpl = stubFetch(['12'])

    const result = await selectFolderByJev({ apiKey: 'ts_test', page, candidates, fetchImpl })

    expect(result?.folderId).toBe('12')
    expect(result?.folderPath).toBe('书签栏/工具')
    expect(result?.confidence).toBeCloseTo(0.9)

    const [endpoint, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(endpoint).toBe('https://api.typesafe.ai/v1/systemone')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer ts_test' })
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toBe('jev-latest')
    expect(Object.keys(body.questions.folder.criteria)).toEqual(['11', '12'])
    expect(body.state.page.url).toBe('https://react.dev/learn')
  })

  it('选项名不在返回结果中时应回退到首个候选，避免脏数据', async () => {
    const candidates: FolderCandidate[] = [
      { id: '11', path: '书签栏/开发' },
      { id: '12', path: '书签栏/工具' },
    ]
    const result = await selectFolderByJev({
      apiKey: 'ts_test',
      page,
      candidates,
      fetchImpl: stubFetch(['不存在的目录']),
    })

    expect(result?.folderId).toBe('11')
  })

  it('目录数不超过上限时只发一次请求，且包含全部目录', async () => {
    const candidates: FolderCandidate[] = [
      ...Array.from({ length: MAX_OPTIONS_PER_QUESTION - 1 }, (_, i) => ({
        id: `a${i}`,
        path: `书签栏/A/f${i}`,
      })),
    ]
    // 真实场景回归：根目录下还有一个空目录时，不应退化成"先选上级目录"
    candidates.push({ id: 'other', path: '其他书签' })
    const fetchImpl = stubFetch(['a3'])

    const result = await selectFolderByJev({ apiKey: 'ts_test', page, candidates, fetchImpl })

    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(1)
    const body = JSON.parse((calls[0][1] as RequestInit).body as string)
    expect(Object.keys(body.questions)).toEqual(['folder'])
    expect(Object.keys(body.questions.folder.criteria)).toHaveLength(MAX_OPTIONS_PER_QUESTION)
    expect(Object.keys(body.questions.folder.criteria)).toContain('other')
    expect(result?.folderPath).toBe('书签栏/A/f3')
  })

  it('目录超过上限时等分分块并行提问，并按概率合并结果', async () => {
    // 300 个目录 → 3 块（每块 100），单次请求内三个问题
    const candidates: FolderCandidate[] = [
      ...Array.from({ length: 299 }, (_, i) => ({ id: `a${i}`, path: `书签栏/A/f${i}` })),
      { id: 'other', path: '其他书签' },
    ]
    const fetchImpl = vi.fn(async (_endpoint: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      const ids = Object.keys(body.questions)
      const answers: Record<string, unknown> = {}
      ids.forEach((id, index) => {
        const options = Object.keys(body.questions[id].criteria)
        // 概率逐块升高 → 应选最后一块的结果
        const choice = options[index === 0 ? 0 : options.length - 1]
        const probability = 0.3 + index * 0.3
        answers[id] = { type: 'choice', choice, confidence: probability, probabilities: { [choice]: probability } }
      })
      return jsonResponse({ answers })
    }) as unknown as FetchLike

    const result = await selectFolderByJev({ apiKey: 'ts_test', page, candidates, fetchImpl })

    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(1)
    const body = JSON.parse((calls[0][1] as RequestInit).body as string)
    expect(Object.keys(body.questions)).toEqual(['folder_1', 'folder_2', 'folder_3'])
    const chunkSizes = Object.values(body.questions).map((q: unknown) =>
      Object.keys((q as { criteria: Record<string, unknown> }).criteria).length,
    )
    expect(chunkSizes).toEqual([100, 100, 100])
    // 最后一块概率最高 → 选中该块的选项
    expect(result?.folderId).toBe('other')
    expect(result?.confidence).toBeCloseTo(0.9)
    // 概率表包含各分块选出的目录，供 UI 展示备选
    expect(Object.keys(result?.probabilities ?? {})).toHaveLength(3)
  })

  it('API Key 无效时应给出可读错误', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ detail: 'invalid api key' }, 401)) as unknown as FetchLike

    await expect(selectFolderByJev({
      apiKey: 'bad',
      page,
      candidates: [{ id: '11', path: '书签栏/开发' }, { id: '12', path: '书签栏/工具' }],
      fetchImpl,
    })).rejects.toThrow('Jev API Key 无效')
  })

  it('返回格式异常时应抛错，由调用方降级为手动选择', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ answers: {} })) as unknown as FetchLike

    await expect(selectFolderByJev({
      apiKey: 'ts_test',
      page,
      candidates: [{ id: '11', path: '书签栏/开发' }, { id: '12', path: '书签栏/工具' }],
      fetchImpl,
    })).rejects.toThrow('Jev 返回结果格式异常')
  })
})
