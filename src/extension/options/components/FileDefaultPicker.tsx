import { useEffect, useState } from 'react'
import type { Palette } from '../palette'
import { buildBookmarkFileName, extractBookmarkName, isValidBookmarkName } from '../../../shared/sync'

const NEW_FILE_VALUE = '__new__'

interface FileDefaultPickerProps {
  label: string
  description?: string
  value: string
  onChange: (fileName: string) => void
  files: string[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  colors: Palette
}

/**
 * 设置页默认书签文件选择器：远程文件下拉 + 新建（英文名）
 */
export function FileDefaultPicker({ label, description, value, onChange, files, loading, error, onRefresh, colors }: FileDefaultPickerProps) {
  const [mode, setMode] = useState<'existing' | 'new'>(() =>
    value && !files.includes(value) ? 'new' : 'existing',
  )
  const [newName, setNewName] = useState(() => extractBookmarkName(value) ?? '')

  /** 当前值是否为未推送的新建文件（不在远程文件列表里） */
  const isUnsaved = !!(value && !files.includes(value))

  // 远程文件加载完成后，若默认值不在列表里则切到新建模式
  useEffect(() => {
    if (files.length > 0 && value && !files.includes(value)) {
      setMode('new')
      setNewName(extractBookmarkName(value) ?? '')
    }
  }, [files, value])

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    background: colors.bg,
    color: colors.text,
    fontFamily: 'inherit',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const selectStyle: React.CSSProperties = {
    ...inputBase,
    cursor: 'pointer',
    marginBottom: 6,
  }

  const nameValid = isValidBookmarkName(newName)

  const handleSelect = (v: string) => {
    if (v === NEW_FILE_VALUE) {
      setMode('new')
      if (!value || files.includes(value)) onChange('')
    } else if (v === value && isUnsaved) {
      // 选中未推送文件 → 保持新建编辑模式（可改名）
      setMode('new')
      setNewName(extractBookmarkName(v) ?? '')
    } else {
      setMode('existing')
      onChange(v)
    }
  }

  const handleNewName = (n: string) => {
    setNewName(n)
    onChange(isValidBookmarkName(n) ? buildBookmarkFileName(n) : '')
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '12px', fontWeight: 500, color: colors.textMuted }}>
        <span style={{ color: colors.accent }}>$</span> {label}
        {description && (
          <span style={{ color: colors.textDim, fontWeight: 400, marginLeft: '0.5rem' }}>
            # {description}
          </span>
        )}
      </label>

      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={isUnsaved ? value : (mode === 'new' ? NEW_FILE_VALUE : (value || ''))}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={loading && files.length === 0}
          style={selectStyle}
        >
          <option value="">{loading && files.length === 0 ? '加载中…' : '未配置（每次操作时选择）'}</option>
          {isUnsaved && (
            <option value={value}>
              {value}（未推送）
            </option>
          )}
          {files.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
          <option value={NEW_FILE_VALUE}>＋ 新建文件…</option>
        </select>
        <button
          onClick={onRefresh}
          disabled={loading}
          title="刷新远程文件列表"
          style={{
            flexShrink: 0,
            padding: '8px 12px',
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            background: colors.surface,
            color: loading ? colors.textDim : colors.textMuted,
            cursor: loading ? 'default' : 'pointer',
            fontSize: '13px',
            fontFamily: 'inherit',
          }}
        >
          ⟳
        </button>
      </div>

      {mode === 'new' && (
        <div style={{ marginTop: 6 }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => handleNewName(e.target.value)}
            placeholder="英文名，如 chrome / edge / firefox"
            style={{
              ...inputBase,
              borderColor: newName && !nameValid ? colors.orange : colors.border,
            }}
          />
          <p style={{ fontSize: '11px', color: colors.textDim, margin: '0.25rem 0 0', fontFamily: 'inherit' }}>
            {newName && !nameValid ? (
              <span style={{ color: colors.orange }}>
                # name 仅限英文（字母开头，可含数字 / 中划线 / 下划线，最长 50 字符）
              </span>
            ) : nameValid ? (
              <span style={{ color: colors.green }}>
                # 推送时将创建 {buildBookmarkFileName(newName)}
              </span>
            ) : (
              '# 输入英文名后，推送时将创建 bookmarks-[name].json'
            )}
          </p>
        </div>
      )}

      {error && (
        <p style={{ fontSize: '11px', color: colors.orange, margin: '0.375rem 0 0', fontFamily: 'inherit' }}>
          # {error}（点 ⟳ 重试）
        </p>
      )}
    </div>
  )
}
