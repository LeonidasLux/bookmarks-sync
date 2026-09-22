import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** 文件夹树节点（仅包含文件夹，书签条目被忽略） */
export interface FolderTreeNode {
  id: string
  title: string
  /** 从树根到当前节点的可读路径，如 书签栏/技术/前端 */
  path: string
  /** 从树根到父级的链路，用于拼接面包屑 */
  ancestors: Array<{ id: string; title: string }>
  children: FolderTreeNode[]
}

/** 将 Chrome 书签节点递归转换为文件夹树 */
export function buildFolderTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  parentPath = '',
  parentAncestors: Array<{ id: string; title: string }> = [],
): FolderTreeNode[] {
  const tree: FolderTreeNode[] = []
  for (const node of nodes) {
    if (node.url) continue
    const title = node.title || '未命名目录'
    const path = parentPath ? `${parentPath}/${title}` : title
    tree.push({
      id: node.id,
      title,
      path,
      ancestors: parentAncestors,
      children: buildFolderTree(
        node.children ?? [],
        path,
        [...parentAncestors, { id: node.id, title }],
      ),
    })
  }
  return tree
}

/** 深度优先收集树中全部文件夹 id */
export function collectFolderIds(nodes: FolderTreeNode[]): string[] {
  return nodes.flatMap(node => [node.id, ...collectFolderIds(node.children)])
}

/**
 * 按关键词过滤文件夹树。
 * 命中节点保留其完整子树，未命中的节点仅在其子孙命中时保留（作为定位用的祖先链）。
 */
export function filterFolderTree(nodes: FolderTreeNode[], query: string): FolderTreeNode[] {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return nodes

  const result: FolderTreeNode[] = []
  for (const node of nodes) {
    const hit = node.title.toLowerCase().includes(keyword) || node.path.toLowerCase().includes(keyword)
    if (hit) {
      result.push(node)
      continue
    }
    const children = filterFolderTree(node.children, keyword)
    if (children.length > 0) {
      result.push({ ...node, children })
    }
  }
  return result
}

export interface UseFolderTreeResult {
  /** 当前展开的文件夹 id 集合 */
  expandedIds: ReadonlySet<string>
  /** 是否所有文件夹都已展开 */
  allExpanded: boolean
  isExpanded: (id: string) => boolean
  toggleExpand: (id: string) => void
  expandAll: () => void
  collapseAll: () => void
}

/**
 * 文件夹树的展开 / 折叠状态。
 * 数据首次到达时按 defaultExpanded 初始化一次，之后完全由用户操作决定。
 */
export function useFolderTree(
  nodes: FolderTreeNode[],
  options: { defaultExpanded?: boolean } = {},
): UseFolderTreeResult {
  const { defaultExpanded = true } = options
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set<string>())
  const initializedRootRef = useRef<string | null>(null)

  const allIds = useMemo(() => collectFolderIds(nodes), [nodes])
  /** 树根标识：切换到另一层目录（根节点集合变化）时重新初始化展开状态 */
  const rootKey = nodes.map(node => node.id).join(',')

  useEffect(() => {
    if (allIds.length === 0 || initializedRootRef.current === rootKey) return
    initializedRootRef.current = rootKey
    setExpandedIds(defaultExpanded ? new Set(allIds) : new Set<string>())
  }, [allIds, rootKey, defaultExpanded])

  const isExpanded = useCallback((id: string) => expandedIds.has(id), [expandedIds])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => setExpandedIds(new Set(allIds)), [allIds])
  const collapseAll = useCallback(() => setExpandedIds(new Set<string>()), [])

  const allExpanded = allIds.length > 0 && allIds.every(id => expandedIds.has(id))

  return { expandedIds, allExpanded, isExpanded, toggleExpand, expandAll, collapseAll }
}
