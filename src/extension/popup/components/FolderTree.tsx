import { useState, type ReactNode } from 'react'
import { useTheme } from '../theme'
import type { FolderTreeNode } from '../hooks/useFolderTree'

export interface FolderTreeProps {
  nodes: FolderTreeNode[]
  /** 已展开的文件夹 id 集合 */
  expandedIds: ReadonlySet<string>
  /** 点击展开 / 折叠箭头 */
  onToggleExpand: (id: string) => void
  /** 点击行主体（箭头以外的区域） */
  onSelect?: (node: FolderTreeNode) => void
  /** 当前选中项，选中行高亮显示 */
  selectedId?: string
  /** 在标题下方显示完整路径 */
  showPath?: boolean
  /** 行尾自定义内容，如选中 / 推荐标记 */
  renderMeta?: (node: FolderTreeNode) => ReactNode
  /** 行元素 id 前缀，便于 scrollIntoView 定位 */
  itemIdPrefix?: string
  /** 每一级缩进的像素数 */
  indentSize?: number
  testId?: string
}

interface TreeRowProps {
  node: FolderTreeNode
  depth: number
  indentSize: number
  expanded: boolean
  selected: boolean
  showPath: boolean
  onToggleExpand: (id: string) => void
  onSelect?: (node: FolderTreeNode) => void
  renderMeta?: (node: FolderTreeNode) => ReactNode
  itemIdPrefix?: string
}

function TreeRow({
  node,
  depth,
  indentSize,
  expanded,
  selected,
  showPath,
  onToggleExpand,
  onSelect,
  renderMeta,
  itemIdPrefix,
}: TreeRowProps) {
  const { styles, colors, fonts } = useTheme()
  const [hover, setHover] = useState(false)
  const hasChildren = node.children.length > 0

  return (
    <div
      id={itemIdPrefix ? `${itemIdPrefix}${node.id}` : undefined}
      data-testid="folder-tree-row"
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={selected}
      {...(hasChildren ? { 'aria-expanded': expanded } : {})}
      onClick={() => onSelect?.(node)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={showPath ? node.path : node.title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        paddingLeft: 8 + depth * indentSize,
        borderRadius: '4px',
        cursor: onSelect ? 'pointer' : 'default',
        fontFamily: fonts.mono,
        transition: 'background 0.1s',
        ...(selected ? {
          background: `${colors.accent}12`,
          border: `1px solid ${colors.accent}30`,
        } : {}),
        ...(hover && !selected ? { background: `${colors.accent}08` } : {}),
      }}
    >
      <span
        data-testid="folder-tree-toggle"
        onClick={e => {
          e.stopPropagation()
          if (hasChildren) onToggleExpand(node.id)
        }}
        title={hasChildren ? (expanded ? '折叠' : '展开') : undefined}
        style={{
          width: 10,
          flexShrink: 0,
          textAlign: 'center',
          fontSize: '10px',
          color: colors.textDim,
          cursor: hasChildren ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {hasChildren ? (expanded ? '▾' : '▸') : ''}
      </span>

      <span style={styles.folderIcon}>📁</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: fonts.mono,
            color: selected ? colors.accent : colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.title}
        </span>
        {showPath && (
          <span
            style={{
              display: 'block',
              marginTop: '1px',
              fontSize: '10px',
              fontFamily: fonts.mono,
              color: colors.textDim,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.path}
          </span>
        )}
      </div>

      {renderMeta?.(node)}
    </div>
  )
}

/**
 * 目录树：递归展示文件夹层级，箭头控制展开 / 折叠，行主体用于进入或选中目录。
 */
export function FolderTree({
  nodes,
  expandedIds,
  onToggleExpand,
  onSelect,
  selectedId,
  showPath = false,
  renderMeta,
  itemIdPrefix,
  indentSize = 14,
  testId = 'folder-tree',
}: FolderTreeProps) {
  const renderNodes = (list: FolderTreeNode[], depth: number): ReactNode =>
    list.map(node => {
      const expanded = expandedIds.has(node.id)
      return (
        <div key={node.id} role="none">
          <TreeRow
            node={node}
            depth={depth}
            indentSize={indentSize}
            expanded={expanded}
            selected={node.id === selectedId}
            showPath={showPath}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
            renderMeta={renderMeta}
            itemIdPrefix={itemIdPrefix}
          />
          {expanded && node.children.length > 0 && (
            <div role="group">{renderNodes(node.children, depth + 1)}</div>
          )}
        </div>
      )
    })

  return (
    <div data-testid={testId} role="tree">
      {renderNodes(nodes, 0)}
    </div>
  )
}
