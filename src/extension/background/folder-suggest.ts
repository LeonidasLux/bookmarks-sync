import { selectFolderByJev, type FolderCandidate, type FolderSuggestion, type JevPageInfo } from '../../shared/jev'
import { ROOT_FOLDER_CANONICAL } from './bookmark-utils'

/** 每个目录收集的示例书签数 */
const MAX_SAMPLES = 4
/** 每个目录收集的子目录名数 */
const MAX_SUBFOLDERS = 4

/** 从 URL 中取出站点名，作为书签样本的补充信息 */
function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * 展开浏览器书签树，收集全部文件夹作为 Jev 的候选目标。
 * 每个候选附带目录内直接包含的书签样本与子目录名，便于模型判断目录用途。
 */
export async function collectFolderCandidates(): Promise<FolderCandidate[]> {
  const tree = await chrome.bookmarks.getTree()
  const candidates: FolderCandidate[] = []

  function walk(nodes: chrome.bookmarks.BookmarkTreeNode[], parentPath: string) {
    for (const node of nodes) {
      if (node.url) continue
      const folderName = ROOT_FOLDER_CANONICAL[node.id] ?? node.title
      const path = parentPath ? `${parentPath}/${folderName}` : folderName

      const children = node.children ?? []
      // 根节点没有名称，不作为候选，但继续展开其子目录
      if (!path) {
        walk(children, '')
        continue
      }

      const samples = children
        .filter(child => child.url)
        .slice(0, MAX_SAMPLES)
        .map(child => (siteOf(child.url!) ? `${child.title} (${siteOf(child.url!)})` : child.title))
        .filter(Boolean)
      const subfolders = children
        .filter(child => !child.url)
        .slice(0, MAX_SUBFOLDERS)
        .map(child => child.title)
        .filter(Boolean)

      candidates.push({ id: node.id, path, samples, subfolders })
      if (children.length > 0) walk(children, path)
    }
  }

  walk(tree, '')
  return candidates
}

/**
 * 用 Jev 推荐保存目录；调用方负责处理异常与降级。
 */
export async function suggestSaveFolder(
  apiKey: string,
  page: JevPageInfo,
): Promise<FolderSuggestion | null> {
  const candidates = await collectFolderCandidates()
  return selectFolderByJev({ apiKey, page, candidates })
}
