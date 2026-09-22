// ---- 根级文件夹 ID ----
export const BOOKMARKS_BAR_ID = '1'
export const OTHER_BOOKMARKS_ID = '2'
export const MOBILE_BOOKMARKS_ID = '3'

// ---- Jev 备选目录 ----
/** 建议行下方展示的备选目录数量上限 */
export const MAX_FOLDER_ALTERNATIVES = 3

// ---- 根级文件夹元信息 ----
export const ROOT_FOLDER_META: Record<string, string> = {
  [OTHER_BOOKMARKS_ID]: '其他书签',
  [MOBILE_BOOKMARKS_ID]: '移动设备书签',
}

// ---- 差异标签 ----
export const DIFF_LABEL: Record<string, string> = { added: '新增', deleted: '删除', modified: '修改' }
export const DIFF_COLOR: Record<string, string> = { added: '#3fb950', deleted: '#f85149', modified: '#d29922' }
