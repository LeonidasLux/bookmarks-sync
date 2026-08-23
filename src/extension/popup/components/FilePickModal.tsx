import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../theme'
import { buildBookmarkFileName, extractBookmarkName, isValidBookmarkName } from '../../../shared/sync'

interface FilePickModalProps {
  mode: 'push' | 'pull'
  /** null 表示加载中 */
  files: string[] | null
  defaultFile: string
  error: string | null
  onConfirm: (fileName: string) => void
  onCancel: () => void
}

/**
 * 同步 / 拉取前的远程书签文件选择弹窗
 * push：远程文件列表 + 新建输入；pull：仅远程文件列表
 */
export function FilePickModal({ mode, files, defaultFile, error, onConfirm, onCancel }: FilePickModalProps) {
  const { styles, colors } = useTheme()
  const [selected, setSelected] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [newName, setNewName] = useState('')

  const fileList = files ?? []
  const nameValid = isValidBookmarkName(newName)
  const isPull = mode === 'pull'

  // 文件列表加载完成后初始化默认选中：
  // 默认文件在列表 → 选中它；否则若是新格式名 → 预填到新建输入
  useEffect(() => {
    if (files === null || selected !== null) return
    if (defaultFile && fileList.includes(defaultFile)) {
      setSelected(defaultFile)
    } else if (defaultFile && extractBookmarkName(defaultFile)) {
      setIsNew(true)
      setNewName(extractBookmarkName(defaultFile) ?? '')
    } else {
      setSelected(fileList[0] ?? null)
    }
  }, [files, defaultFile, fileList, selected])

  const confirmDisabled = useMemo(() => {
    if (isPull) return selected === null
    if (isNew) return !nameValid
    return selected === null
  }, [isPull, isNew, nameValid, selected])

  const handleConfirm = () => {
    if (isPull) {
      if (selected) onConfirm(selected)
      return
    }
    if (isNew) {
      if (nameValid) onConfirm(buildBookmarkFileName(newName))
      return
    }
    if (selected) onConfirm(selected)
  }

  const title = isPull ? '选择拉取文件' : '选择同步文件'
  const confirmLabel = isPull ? '✓ 拉取' : '✓ 下一步'

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modalContainer} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          ...styles.modalHeader,
          fontSize: '14px',
          padding: '16px 16px 10px',
        }}>
          <span style={{ color: colors.accent, marginRight: 6 }}>$</span>
          {title}
          {defaultFile && (
            <span style={{ color: colors.textDim, fontSize: '11px', marginLeft: 8 }}>
              ★ 默认: {defaultFile}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '4px 16px 12px' }}>
          {files === null ? (
            <div style={{ fontSize: '12px', color: colors.textMuted, padding: '12px 0' }}>
              ⟳ 正在获取远程书签文件...
            </div>
          ) : error ? (
            <div style={{
              background: `${colors.orange}12`,
              border: `1px solid ${colors.orange}30`,
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '11px',
              color: colors.orange,
              lineHeight: 1.5,
              fontFamily: 'inherit',
            }}>
              ❌ {error}
            </div>
          ) : fileList.length === 0 && !isPull ? (
            <div style={{ fontSize: '12px', color: colors.textMuted, padding: '4px 0 8px' }}>
              远程仓库暂无书签文件，可新建一个：
            </div>
          ) : fileList.length === 0 ? (
            <div style={{ fontSize: '12px', color: colors.textMuted, padding: '12px 0' }}>
              ∅ 远程仓库暂无书签文件
            </div>
          ) : (
            <div style={{
              background: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              overflow: 'hidden',
            }}>
              {fileList.map((f, i) => (
                <label
                  key={f}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    borderBottom: i < fileList.length - 1 ? `1px solid ${colors.borderLight}` : 'none',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: selected === f ? `${colors.accent}10` : 'transparent',
                    fontFamily: 'inherit',
                  }}
                >
                  <input
                    type="radio"
                    name="bookmark-file"
                    value={f}
                    checked={!isNew && selected === f}
                    onChange={() => { setSelected(f); setIsNew(false) }}
                    style={{ accentColor: colors.accent, margin: 0 }}
                  />
                  <span style={{ color: colors.text, flex: 1 }}>{f}</span>
                  {f === defaultFile && (
                    <span style={{ color: colors.orange, fontSize: '10px' }}>★ 默认</span>
                  )}
                </label>
              ))}
            </div>
          )}

          {!isPull && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => setIsNew(prev => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isNew ? colors.orange : colors.accent,
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                {isNew ? '✕ 取消新建' : '＋ 新建文件'}
              </button>
              {isNew && (
                <div style={{ marginTop: 6 }}>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="英文名，如 chrome / edge / firefox"
                    autoFocus
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      border: `1px solid ${newName && !nameValid ? colors.orange : colors.border}`,
                      borderRadius: '6px',
                      background: colors.bg,
                      color: colors.text,
                      fontSize: '12px',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <p style={{ fontSize: '11px', color: colors.textDim, margin: '0.375rem 0 0', fontFamily: 'inherit' }}>
                    {newName && !nameValid ? (
                      <span style={{ color: colors.orange }}>
                        # name 仅限英文（字母开头，可含数字 / 中划线 / 下划线，最长 50 字符）
                      </span>
                    ) : nameValid ? (
                      <span style={{ color: colors.green }}># 将新建 {buildBookmarkFileName(newName)} 并推送</span>
                    ) : (
                      '# 将创建 bookmarks-[name].json'
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          ...styles.modalActions,
          borderTop: `1px solid ${colors.borderLight}`,
        }}>
          <button
            onClick={onCancel}
            style={styles.btnSecondary}
            onMouseEnter={e => { e.currentTarget.style.borderColor = colors.textMuted }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border }}
          >
            ✕ 取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirmDisabled}
            style={{
              ...styles.btnPrimary,
              ...(confirmDisabled ? { opacity: 0.5, cursor: 'default' } : {}),
            }}
            onMouseEnter={e => { if (!confirmDisabled) e.currentTarget.style.background = `${colors.accent}25` }}
            onMouseLeave={e => { e.currentTarget.style.background = `${colors.accent}15` }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
