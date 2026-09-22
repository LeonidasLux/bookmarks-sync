import { useState, useEffect, useCallback, useMemo } from 'react'
import { buildFolderTree, filterFolderTree, type FolderTreeNode } from './useFolderTree'

export interface FolderNode {
  id: string
  title: string
  path: string
}

/** 扁平化目录树，便于按 id / 路径查找（Jev 推荐与备选目录使用） */
function flattenFolderTree(nodes: FolderTreeNode[]): FolderNode[] {
  return nodes.flatMap(node => [
    { id: node.id, title: node.title, path: node.path },
    ...flattenFolderTree(node.children),
  ])
}

/**
 * 加载 Chrome 书签树并构建目录树，支持按名称/路径搜索
 */
export function useFolderPicker() {
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')

  useEffect(() => {
    setLoading(true)
    chrome.bookmarks.getTree()
      .then(([root]) => {
        const tree = buildFolderTree(root.children ?? [])
        setFolderTree(tree)
        // 仅在用户/推荐尚未选定目录时使用首个目录兜底，
        // 避免异步加载覆盖 Jev 推荐或用户的手动选择
        const firstFolder = flattenFolderTree(tree)[0]
        if (firstFolder) {
          setSelectedFolderId(prev => prev || firstFolder.id)
        }
      })
      .catch(() => {
        setFolderTree([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  /** 全部目录的扁平视图（含完整路径） */
  const allFolders = useMemo(() => flattenFolderTree(folderTree), [folderTree])

  /** 按搜索词过滤后的目录树（保留命中目录的祖先链） */
  const filteredTree = useMemo(
    () => filterFolderTree(folderTree, searchQuery),
    [folderTree, searchQuery],
  )

  const selectedFolder = useMemo(
    () => allFolders.find(f => f.id === selectedFolderId),
    [allFolders, selectedFolderId],
  )

  const clearSearch = useCallback(() => setSearchQuery(''), [])

  return {
    folderTree,
    filteredTree,
    allFolders,
    loading,
    searchQuery,
    setSearchQuery,
    selectedFolderId,
    setSelectedFolderId,
    selectedFolder,
    clearSearch,
  }
}
