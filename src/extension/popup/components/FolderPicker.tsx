import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useFolderPicker } from '../hooks/useFolderPicker'
import { useFolderSuggestion } from '../hooks/useFolderSuggestion'
import { collectFolderIds, useFolderTree } from '../hooks/useFolderTree'
import { useTheme } from '../theme'
import { FolderTree } from './FolderTree'

interface FolderPickerProps {
  initialTitle: string
  /** 待保存页面的 URL，用于 Jev 目录推荐 */
  pageUrl?: string
  onSave: (folderId: string, title: string) => void
  onBack: () => void
}

export function FolderPicker({ initialTitle, pageUrl = '', onSave, onBack }: FolderPickerProps) {
  const { styles, colors, fonts } = useTheme()
  const {
    allFolders,
    folderTree,
    filteredTree,
    loading,
    searchQuery,
    setSearchQuery,
    selectedFolderId,
    setSelectedFolderId,
  } = useFolderPicker()
  // 目录树默认全部展开，便于直接看到嵌套目录
  const { expandedIds, allExpanded, toggleExpand, expandAll, collapseAll } = useFolderTree(folderTree)
  const searching = searchQuery.trim().length > 0
  /** 搜索时强制展开命中目录的祖先链，保证搜索结果可见 */
  const visibleExpandedIds = useMemo(
    () => (searching ? new Set(collectFolderIds(filteredTree)) : expandedIds),
    [searching, filteredTree, expandedIds],
  )
  // 页面标题固定使用打开时的标题，避免编辑书签标题时反复触发推荐
  const { state: suggestionState, suggestion, error: suggestionError } = useFolderSuggestion(initialTitle, pageUrl)

  const [title, setTitle] = useState(initialTitle)
  const [titleFocus, setTitleFocus] = useState(false)
  const [searchFocus, setSearchFocus] = useState(false)
  const [hoverItem, setHoverItem] = useState<string | null>(null)
  /** 用户手动点选目录后，不再被 AI 推荐覆盖 */
  const userPickedRef = useRef(false)

  const inputBorderStyle = { border: `1px solid ${colors.border}` } as React.CSSProperties
  const inputFocusBorder = { border: `1px solid ${colors.accent}` } as React.CSSProperties
  const titleInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleInputRef.current?.focus()
    titleInputRef.current?.select()
  }, [])

  // Jev 推荐返回后预选该目录，用户仍可手动改选
  useEffect(() => {
    if (!suggestion || userPickedRef.current) return
    setSelectedFolderId(suggestion.folderId)
    requestAnimationFrame(() => {
      document.getElementById(`folder-item-${suggestion.folderId}`)?.scrollIntoView?.({ block: 'nearest' })
    })
  }, [suggestion, setSelectedFolderId])

  const selectFolder = useCallback((folderId: string) => {
    userPickedRef.current = true
    setSelectedFolderId(folderId)
  }, [setSelectedFolderId])

  /** Jev 概率分布中置信度最高的前 5 个目录，作为推荐备选 */
  const alternatives = useMemo(() => {
    if (!suggestion) return []
    return Object.entries(suggestion.probabilities)
      .map(([id, probability]) => {
        const folder = allFolders.find(f => f.id === id)
        return folder ? { ...folder, probability } : null
      })
      .filter((item): item is { id: string; title: string; path: string; probability: number } => item !== null)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5)
  }, [suggestion, allFolders])

  const handleSave = useCallback(() => {
    if (selectedFolderId && title.trim()) {
      onSave(selectedFolderId, title.trim())
    }
  }, [selectedFolderId, title, onSave])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedFolderId && title.trim()) {
      handleSave()
    } else if (e.key === 'Escape') {
      onBack()
    }
  }, [selectedFolderId, title, handleSave, onBack])

  return (
    <div style={{
      width: 420,
      padding: '12px',
      fontFamily: fonts.ui,
      background: colors.bg,
      color: colors.text,
      fontSize: '12px',
      lineHeight: 1.6,
    }} onKeyDown={handleKeyDown}>
      {/* 顶部导航栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: `1px solid ${colors.borderLight}`,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            border: `1px solid transparent`,
            borderRadius: '6px',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '12px',
            color: colors.textMuted,
            fontFamily: fonts.mono,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = colors.surface
            e.currentTarget.style.borderColor = colors.border
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'transparent'
          }}
        >
          ← 返回
        </button>
        <span style={{ fontWeight: 600, fontSize: '12px', color: colors.text }}>
          <span style={{ color: colors.accent }}>$</span> 保存书签
        </span>
      </div>

      {/* 书签标题编辑 */}
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        color: colors.textDim,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        marginBottom: '4px',
        fontFamily: fonts.mono,
      }}>
        书签标题
      </div>
      <input
        ref={titleInputRef}
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onFocus={() => setTitleFocus(true)}
        onBlur={() => setTitleFocus(false)}
        style={{
          fontFamily: fonts.mono,
          fontSize: '12px',
          padding: '6px 10px',
          borderRadius: '6px',
          background: colors.bg,
          color: colors.text,
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          marginBottom: '10px',
          width: '100%',
          boxSizing: 'border-box' as const,
          ...(titleFocus ? inputFocusBorder : inputBorderStyle),
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.stopPropagation()
            searchInputRef.current?.focus()
          }
        }}
      />

      {/* Jev 目录推荐状态 */}
      {suggestionState !== 'idle' && (
        <div style={{
          fontSize: '11px',
          fontFamily: fonts.mono,
          marginBottom: '6px',
          color: suggestionState === 'error' ? colors.red : colors.textDim,
          lineHeight: 1.5,
        }}>
          {suggestionState === 'loading' && (
            <span><span style={{ color: colors.accent }}>⟳</span> Jev 正在推荐目标目录...</span>
          )}
          {suggestionState === 'ready' && suggestion && (
            <span>
              <span style={{ color: colors.accent }}>🤖</span> Jev 建议：{suggestion.folderPath}
              <span style={{ color: colors.textMuted }}>
                （置信度 {(suggestion.confidence * 100).toFixed(0)}%）
              </span>
              <span> · {suggestion.confidence < 0.4 ? '置信度较低，请确认' : '可手动改选'}</span>
            </span>
          )}
          {suggestionState === 'skipped' && (
            <span>未配置 Jev API Key，已跳过智能目录推荐</span>
          )}
          {suggestionState === 'error' && (
            <span>Jev 推荐失败：{suggestionError}</span>
          )}
        </div>
      )}

      {/* Jev 备选目录：按置信度由高到低 */}
      {alternatives.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 600,
            color: colors.textDim,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
            marginBottom: '4px',
            fontFamily: fonts.mono,
          }}>
            备选目录（置信度由高到低）
          </div>
          <div style={{
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            background: colors.surface,
            overflow: 'hidden' as const,
          }}>
            {alternatives.map((alt, index) => (
              <div
                key={alt.id}
                data-testid="folder-alternative"
                onClick={() => selectFolder(alt.id)}
                onMouseEnter={() => setHoverItem(alt.id)}
                onMouseLeave={() => setHoverItem(null)}
                title={alt.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 8px',
                  cursor: 'pointer',
                  fontFamily: fonts.mono,
                  fontSize: '11px',
                  transition: 'background 0.1s',
                  ...(index > 0 ? { borderTop: `1px solid ${colors.borderLight}` } : {}),
                  ...(alt.id === selectedFolderId ? { background: `${colors.accent}12` } : {}),
                  ...(hoverItem === alt.id && alt.id !== selectedFolderId ? { background: `${colors.accent}08` } : {}),
                }}
              >
                <span style={{ color: colors.textDim, width: 12, flexShrink: 0 }}>{index + 1}</span>
                <span style={{
                  flex: 1,
                  minWidth: 0,
                  color: alt.id === suggestion?.folderId ? colors.accent : colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const,
                }}>
                  {alt.path}
                </span>
                <span style={{ color: colors.textMuted, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {(alt.probability * 100).toFixed(alt.probability >= 0.1 ? 0 : 1)}%
                </span>
                {alt.id === selectedFolderId && (
                  <span style={{ color: colors.accent, fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>✓</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 手动选择目录 */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        fontSize: '10px',
        fontWeight: 600,
        color: colors.textDim,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        marginBottom: '4px',
        fontFamily: fonts.mono,
      }}>
        <span>手动选择</span>
        {!searching && folderTree.length > 0 && (
          <span
            data-testid="folder-tree-expand-toggle"
            onClick={allExpanded ? collapseAll : expandAll}
            style={{
              cursor: 'pointer',
              color: colors.accent,
              fontWeight: 400,
              textTransform: 'none' as const,
              letterSpacing: 0,
            }}
          >
            {allExpanded ? '折叠全部' : '展开全部'}
          </span>
        )}
      </div>
      <input
        ref={searchInputRef}
        type="text"
        placeholder="搜索目录..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        onFocus={() => setSearchFocus(true)}
        onBlur={() => setSearchFocus(false)}
        style={{
          fontFamily: fonts.mono,
          fontSize: '12px',
          padding: '6px 10px',
          borderRadius: '6px',
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          marginBottom: '8px',
          width: '100%',
          boxSizing: 'border-box' as const,
          background: colors.bg,
          color: colors.text,
          ...(searchFocus ? inputFocusBorder : inputBorderStyle),
        }}
      />

      {/* 文件夹列表 */}
      <div style={{
        flex: 1,
        overflowY: 'auto' as const,
        maxHeight: 260,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        background: colors.surface,
        marginBottom: '10px',
      }}>
        {loading ? (
          <div style={{
            textAlign: 'center' as const,
            color: colors.textDim,
            padding: '24px 0',
            fontSize: '12px',
            fontFamily: fonts.mono,
          }}>
            <span style={{ color: colors.accent }}>⟳</span> 加载中...
          </div>
        ) : filteredTree.length === 0 ? (
          <div style={{
            textAlign: 'center' as const,
            color: colors.textDim,
            padding: '24px 0',
            fontSize: '12px',
            fontFamily: fonts.mono,
          }}>
            ∅ 未找到匹配的目录
          </div>
        ) : (
          <div style={{ padding: '4px' }}>
            <FolderTree
              nodes={filteredTree}
              expandedIds={visibleExpandedIds}
              onToggleExpand={toggleExpand}
              onSelect={node => selectFolder(node.id)}
              selectedId={selectedFolderId}
              showPath
              itemIdPrefix="folder-item-"
              renderMeta={node => (
                <>
                  {node.id === suggestion?.folderId && node.id !== selectedFolderId && (
                    <span
                      style={{ color: colors.textMuted, fontSize: '11px', flexShrink: 0 }}
                      title="Jev 推荐"
                    >
                      🤖
                    </span>
                  )}
                  {node.id === selectedFolderId && (
                    <span style={{ color: colors.accent, fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                      ✓
                    </span>
                  )}
                </>
              )}
            />
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end' as const,
      }}>
        <button
          onClick={onBack}
          style={styles.btnSecondary}
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={!selectedFolderId || !title.trim()}
          style={(selectedFolderId && title.trim()) ? styles.btnPrimary : styles.btnPrimaryDisabled}
        >
          保存
        </button>
      </div>
    </div>
  )
}
