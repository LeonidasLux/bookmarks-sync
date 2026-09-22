import { useState, useEffect, useCallback, useMemo } from 'react'

export interface FolderNode {
  id: string
  title: string
  path: string
}

async function flattenFolders(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  parentPath: string,
): Promise<FolderNode[]> {
  const result: FolderNode[] = []
  for (const node of nodes) {
    if (!node.url && node.children) {
      const path = parentPath ? `${parentPath}/${node.title}` : node.title
      result.push({ id: node.id, title: node.title, path })
      const children = await flattenFolders(node.children, path)
      result.push(...children)
    }
  }
  return result
}

/**
 * 加载 Chrome 书签树并按层级展开所有文件夹，支持按名称/路径搜索
 */
export function useFolderPicker() {
  const [allFolders, setAllFolders] = useState<FolderNode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')

  useEffect(() => {
    setLoading(true)
    chrome.bookmarks.getTree()
      .then(async ([root]) => {
        const folders = await flattenFolders(root.children ?? [], '')
        setAllFolders(folders)
        // 仅在用户/推荐尚未选定目录时使用首个目录兜底，
        // 避免异步加载覆盖 Jev 推荐或用户的手动选择
        if (folders.length > 0) {
          setSelectedFolderId(prev => prev || folders[0].id)
        }
      })
      .catch(() => {
        setAllFolders([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return allFolders
    const q = searchQuery.toLowerCase()
    return allFolders.filter(
      f => f.path.toLowerCase().includes(q) || f.title.toLowerCase().includes(q),
    )
  }, [allFolders, searchQuery])

  const selectedFolder = useMemo(
    () => allFolders.find(f => f.id === selectedFolderId),
    [allFolders, selectedFolderId],
  )

  const clearSearch = useCallback(() => setSearchQuery(''), [])

  return {
    allFolders,
    filteredFolders,
    loading,
    searchQuery,
    setSearchQuery,
    selectedFolderId,
    setSelectedFolderId,
    selectedFolder,
    clearSearch,
  }
}
