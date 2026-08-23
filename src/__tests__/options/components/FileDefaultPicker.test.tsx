import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileDefaultPicker } from '../../../extension/options/components/FileDefaultPicker'
import { palettes } from '../../../extension/options/palette'

const FILES = ['bookmarks-chrome.json', 'bookmarks-edge.json', 'bookmarks.json']

function renderPicker(overrides: Partial<React.ComponentProps<typeof FileDefaultPicker>> = {}) {
  const props: React.ComponentProps<typeof FileDefaultPicker> = {
    label: 'SYNC_FILE',
    value: '',
    onChange: vi.fn(),
    files: FILES,
    loading: false,
    error: null,
    onRefresh: vi.fn(),
    colors: palettes.dark,
    ...overrides,
  }
  return render(<FileDefaultPicker {...props} />)
}

describe('FileDefaultPicker', () => {
  it('应列出远程文件并显示默认选项', () => {
    renderPicker()

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.options.length).toBe(FILES.length + 2) // 未配置 + 文件 + 新建
    for (const f of FILES) {
      expect(screen.getByRole('option', { name: f })).toBeTruthy()
    }
  })

  it('选择已有文件时回调完整文件名', () => {
    const onChange = vi.fn()
    renderPicker({ onChange })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bookmarks-edge.json' } })
    expect(onChange).toHaveBeenCalledWith('bookmarks-edge.json')
  })

  it('新建模式输入合法英文名时生成 bookmarks-[name].json', () => {
    const onChange = vi.fn()
    renderPicker({ onChange })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '__new__' } })
    const input = screen.getByPlaceholderText(/英文名/) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'firefox' } })

    expect(onChange).toHaveBeenCalledWith('bookmarks-firefox.json')
    expect(screen.getByText(/推送时将创建 bookmarks-firefox\.json/)).toBeTruthy()
  })

  it('新建模式非法名时回调空字符串并提示错误', () => {
    const onChange = vi.fn()
    renderPicker({ onChange })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '__new__' } })
    const input = screen.getByPlaceholderText(/英文名/) as HTMLInputElement
    fireEvent.change(input, { target: { value: '中文' } })

    expect(onChange).toHaveBeenCalledWith('')
    expect(screen.getByText(/仅限英文/)).toBeTruthy()
  })

  it('默认值为新文件且不在列表时预填新建输入', () => {
    renderPicker({ value: 'bookmarks-safari.json' })

    const input = screen.getByPlaceholderText(/英文名/) as HTMLInputElement
    expect(input.value).toBe('safari')
  })

  it('未推送的新建文件应显示为独立选项并回显', () => {
    renderPicker({ value: 'bookmarks-safari.json' })

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('bookmarks-safari.json')
    expect(screen.getByRole('option', { name: 'bookmarks-safari.json（未推送）' })).toBeTruthy()
    const input = screen.getByPlaceholderText(/英文名/) as HTMLInputElement
    expect(input.value).toBe('safari')
  })

  it('重新选中未推送选项时保持新建编辑模式', () => {
    renderPicker({ value: 'bookmarks-safari.json' })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bookmarks-safari.json' } })
    expect(screen.getByPlaceholderText(/英文名/)).toBeTruthy()
  })

  it('切换到已有文件后未推送选项消失', () => {
    const onChange = vi.fn()
    const { rerender } = renderPicker({ value: 'bookmarks-safari.json', onChange })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bookmarks-edge.json' } })
    expect(onChange).toHaveBeenCalledWith('bookmarks-edge.json')

    rerender(<FileDefaultPicker
      label="SYNC_FILE"
      value="bookmarks-edge.json"
      onChange={onChange}
      files={FILES}
      loading={false}
      error={null}
      onRefresh={vi.fn()}
      colors={palettes.dark}
    />)
    expect(screen.queryByRole('option', { name: 'bookmarks-safari.json（未推送）' })).toBeNull()
  })

  it('拉取失败时显示错误信息', () => {
    renderPicker({ error: 'GitHub API error' })
    expect(screen.getByText(/GitHub API error/)).toBeTruthy()
  })

  it('点击刷新按钮触发 onRefresh', () => {
    const onRefresh = vi.fn()
    renderPicker({ onRefresh })

    fireEvent.click(screen.getByText('⟳'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
