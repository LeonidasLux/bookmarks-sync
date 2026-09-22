/**
 * TypeSafe Jev 集成：为「保存书签」自动推荐目标目录。
 *
 * Jev 是 TypeSafe 的 System One 模型：给一段 state + 若干 typed questions，
 * 返回结构化答案与概率分布。这里只用 Choice 问题——在已存在的书签目录里选出最合适的一个：
 *
 * - 目录数不超过单个 Choice 的选项上限（API 上限 255）时，把所有目录一次性交给模型，
 *   让它在完整候选集上给出概率分布，避免"先选上级目录"这种粗粒度决策把正确答案切掉；
 * - 目录数超过上限时，等分切块后在同一个请求里并行提问（fan-out），各块目录互不重叠，
 *   再按概率合并出最终结果，任何目录都不会被丢弃或截断。
 *
 * 参考文档：
 * - Choice 原语 https://docs.typesafe.ai/primitives/choice
 * - HTTP API https://docs.typesafe.ai/api
 * - 置信度 https://docs.typesafe.ai/confidence
 * - 并行 fan-out https://docs.typesafe.ai/patterns/fan-out
 */

/** TypeSafe System One 评估端点 */
export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
/** TypeSafe 旗舰模型别名 */
export const JEV_MODEL = 'jev-latest'
/** 单个 Choice 问题的选项数上限（TypeSafe API 硬上限 255） */
export const MAX_OPTIONS_PER_QUESTION = 255
/** 超过上限时每个分块的选项数，分块数 = ceil(目录数 / 该值) */
const FANOUT_CHUNK_SIZE = 128
/** 单次请求超时时间（毫秒） */
const REQUEST_TIMEOUT_MS = 30000
/** 每个目录最多附带的示例书签数 */
const MAX_SAMPLES = 4
/** 示例书签 / 子目录名称的最大长度 */
const MAX_HINT_LENGTH = 60

/**
 * 不作为 Jev 推荐目标的根级目录 id。
 * '2' = 其他书签（Chrome 固定的系统目录），避免推荐把书签保存到这里。
 */
export const EXCLUDED_TARGET_FOLDER_IDS: ReadonlySet<string> = new Set(['2'])

/** 参与 Jev 选择的书签目录候选 */
export interface FolderCandidate {
  /** 浏览器书签文件夹 id */
  id: string
  /** 完整目录路径，以 `/` 分隔，如 `书签栏/开发/前端` */
  path: string
  /** 目录内直接包含的书签样本（标题与站点） */
  samples?: string[]
  /** 子目录名称，帮助模型理解空目录的用途 */
  subfolders?: string[]
  /** 附加说明 */
  note?: string
}

/** Jev 的目录推荐结果 */
export interface FolderSuggestion {
  folderId: string
  folderPath: string
  /** Choice 答案的置信度（0-1），反映概率分布的集中程度 */
  confidence: number
  /** 候选目录 id → 概率，供 UI 按置信度由高到低展示备选 */
  probabilities: Record<string, number>
  /** 执行步骤说明，便于调试与展示 */
  steps: string[]
}

/** 待保存页面的信息 */
export interface JevPageInfo {
  title: string
  url: string
}

/** 注入式 fetch，便于测试替换 */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

interface ChoiceAnswer {
  choice: string
  confidence: number
  probabilities: Record<string, number>
}

interface QuestionSpec {
  instructions: unknown
  criteria: Record<string, unknown>
}

interface AskOptions {
  apiKey: string
  state: unknown
  questions: Record<string, QuestionSpec>
  fetchImpl: FetchLike
}

function truncate(text: string, max = MAX_HINT_LENGTH): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

/** 把目录候选转换为 Choice 的 criteria 描述 */
function describeCandidate(candidate: FolderCandidate): Record<string, unknown> {
  const description: Record<string, unknown> = { path: candidate.path }
  if (candidate.samples && candidate.samples.length > 0) {
    description.bookmarks_inside = candidate.samples.slice(0, MAX_SAMPLES).map(s => truncate(s))
  }
  if (candidate.subfolders && candidate.subfolders.length > 0) {
    description.subfolders = candidate.subfolders.slice(0, MAX_SAMPLES).map(s => truncate(s))
  }
  if (candidate.note) {
    description.about = candidate.note
  }
  return description
}

/** 构造 Choice 的 criteria：选项名用目录 id，语义完全由描述承载 */
export function buildFolderCriteria(candidates: FolderCandidate[]): Record<string, unknown> {
  const criteria: Record<string, unknown> = {}
  for (const candidate of candidates) {
    criteria[candidate.id] = describeCandidate(candidate)
  }
  return criteria
}

function endpointError(status: number, detail: string): string {
  if (status === 401) return 'Jev API Key 无效，请在设置中检查'
  if (status === 429) return 'Jev 请求超过速率限制，请稍后重试'
  if (status === 529) return 'Jev 服务繁忙，请稍后重试'
  if (status === 422) return `Jev 请求参数有误${detail ? `：${truncate(detail, 120)}` : ''}`
  return `Jev 请求失败（HTTP ${status}）${detail ? `：${truncate(detail, 120)}` : ''}`
}

/** 调用 System One 端点，返回每个问题的 Choice 答案 */
async function askQuestions(options: AskOptions): Promise<Record<string, ChoiceAnswer>> {
  const { apiKey, state, questions, fetchImpl } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const payload = {
      model: JEV_MODEL,
      state,
      questions: Object.fromEntries(
        Object.entries(questions).map(([id, q]) => [
          id,
          { type: 'choice', instructions: q.instructions, criteria: q.criteria },
        ]),
      ),
    }
    const response = await fetchImpl(JEV_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(endpointError(response.status, detail))
    }

    const data = await response.json() as {
      answers?: Record<string, { type?: string; choice?: string; confidence?: number; probabilities?: Record<string, number> }>
    }

    const answers: Record<string, ChoiceAnswer> = {}
    for (const id of Object.keys(questions)) {
      const answer = data?.answers?.[id]
      if (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string') {
        throw new Error('Jev 返回结果格式异常')
      }
      answers[id] = {
        choice: answer.choice,
        confidence: typeof answer.confidence === 'number' ? answer.confidence : 0,
        probabilities: answer.probabilities ?? {},
      }
    }
    return answers
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Jev 请求超时，请稍后重试')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** 把候选等分成 chunkCount 块，各块大小尽量一致，保证块间概率可比 */
function splitEvenly<T>(items: T[], chunkCount: number): T[][] {
  const chunks: T[][] = []
  let index = 0
  let remaining = items.length % chunkCount
  const base = Math.floor(items.length / chunkCount)
  for (let i = 0; i < chunkCount; i++) {
    const size = base + (remaining > 0 ? 1 : 0)
    if (remaining > 0) remaining -= 1
    chunks.push(items.slice(index, index + size))
    index += size
  }
  return chunks
}

const FOLDER_QUESTION = 'folder'

function folderInstructions(): Record<string, unknown> {
  return {
    question: 'Which existing folder should the bookmark for `page` be saved into? Pick the folder whose topic best matches the page.',
    note: 'Choose only from the listed folders. Prefer the most specific folder that fits the page; use a generic parent folder only when no child folder matches.',
  }
}

/**
 * 用 Jev 在候选目录中选出最适合保存该页面的目录。
 *
 * - 只有一个目录：直接返回，不消耗请求
 * - 目录数 ≤ 255：一次 Choice 覆盖全部目录
 * - 目录数 > 255：等分分块并行提问，按概率合并（不丢弃任何候选）
 */
export async function selectFolderByJev(params: {
  apiKey: string
  page: JevPageInfo
  candidates: FolderCandidate[]
  fetchImpl?: FetchLike
}): Promise<FolderSuggestion | null> {
  const { apiKey, page, candidates, fetchImpl = fetch } = params
  if (candidates.length === 0) return null

  const steps: string[] = []
  if (candidates.length === 1) {
    steps.push(`仅有一个目录：${candidates[0].path}`)
    return {
      folderId: candidates[0].id,
      folderPath: candidates[0].path,
      confidence: 1,
      probabilities: { [candidates[0].id]: 1 },
      steps,
    }
  }

  const state = {
    page: {
      title: truncate(page.title || '(无标题)', 120),
      url: page.url,
    },
  }

  const chunks = candidates.length <= MAX_OPTIONS_PER_QUESTION
    ? [candidates]
    : splitEvenly(candidates, Math.ceil(candidates.length / FANOUT_CHUNK_SIZE))

  const questionIdOf = (index: number) =>
    chunks.length === 1 ? FOLDER_QUESTION : `${FOLDER_QUESTION}_${index + 1}`

  steps.push(`候选目录 ${candidates.length} 个 → ${chunks.length} 个 Choice 问题`)

  const answers = await askQuestions({
    apiKey,
    state,
    fetchImpl,
    questions: Object.fromEntries(
      chunks.map((chunk, index) => [
        questionIdOf(index),
        { instructions: folderInstructions(), criteria: buildFolderCriteria(chunk) },
      ]),
    ),
  })

  // 合并各分块的概率：块按等分切分，跨块比较概率是合理近似；
  // 只有一个分块时就是模型给出的原始分布
  const mergedProbabilities: Record<string, number> = {}
  let winner: FolderCandidate | null = null
  let winnerProbability = -1
  let winnerConfidence = 0

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index]
    const answer = answers[questionIdOf(index)]
    if (!answer) continue

    for (const [folderId, probability] of Object.entries(answer.probabilities)) {
      mergedProbabilities[folderId] = probability
    }

    const picked = chunk.find(c => c.id === answer.choice) ?? chunk[0]
    if (!picked) continue
    // 模型给出的 choice 有时不带概率，兜底取该目录在分布中的值
    const pickedProbability = answer.probabilities[picked.id] ?? 0
    if (pickedProbability > winnerProbability) {
      winner = picked
      winnerProbability = pickedProbability
      winnerConfidence = answer.confidence
    }
  }

  if (!winner) return null

  // 归一化，便于 UI 直接展示百分比
  const total = Object.values(mergedProbabilities).reduce((sum, p) => sum + p, 0)
  if (total > 0) {
    for (const key of Object.keys(mergedProbabilities)) {
      mergedProbabilities[key] = mergedProbabilities[key] / total
    }
  }

  steps.push(`选中目录：${winner.path}（置信度 ${winnerConfidence.toFixed(2)}）`)

  return {
    folderId: winner.id,
    folderPath: winner.path,
    confidence: winnerConfidence,
    probabilities: mergedProbabilities,
    steps,
  }
}
