import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '../../../extension/popup/theme'
import { FilePickModal } from '../../../extension/popup/components/FilePickModal'

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider themeMode="dark">{ui}</ThemeProvider>)
}

const FILES = ['bookmarks-chrome.json', 'bookmarks-edge.json', 'bookmarks.json']

describe('FilePickModal', () => {
  it('加载中显示提示', () => {
    renderWithTheme(
      <FilePickModal mode="push" files={null} defaultFile="" error={null} onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(screen.getByText(/正在获取远程书签文件/)).toBeTruthy()
  })

  it('默认文件在列表时应预选，并显示默认标记', () => {
    renderWithTheme(
      <FilePickModal mode="push" files={FILES} defaultFile="bookmarks-edge.json" error={null} onConfirm={vi.fn()} onCancel={vi.fn()} />
    )

    const radios = screen.getAllByRole('radio')
    const checked = radios.find(r => (r as HTMLInputElement).checked) as HTMLInputElement
    expect(checked.value).toBe('bookmarks-edge.json')
    expect(screen.getAllByText('★ 默认').length).toBeGreaterThan(0)
  })

  it('默认文件是新格式但不在列表时，预填新建输入', () => {
    renderWithTheme(
      <FilePickModal mode="push" files={FILES} defaultFile="bookmarks-firefox.json" error={null} onConfirm={vi.fn()} onCancel={vi.fn()} />
    )

    const input = screen.getByPlaceholderText(/英文名/) as HTMLInputElement
    expect(input.value).toBe('firefox')
    expect(screen.getByText(/将新建 bookmarks-firefox\.json 并推送/)).toBeTruthy()
  })

  it('push 模式输入合法名后可确认新建', () => {
    const onConfirm = vi.fn()
    renderWithTheme(
      <FilePickModal mode="push" files={FILES} defaultFile="" error={null} onConfirm={onConfirm} onCancel={vi.fn()} />
    )

    fireEvent.click(screen.getByText('＋ 新建文件'))
    const input = screen.getByPlaceholderText(/英文名/) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'safari' } })
    fireEvent.click(screen.getByText('✓ 下一步'))

    expect(onConfirm).toHaveBeenCalledWith('bookmarks-safari.json')
  })

  it('push 模式非法名时确认按钮禁用', () => {
    renderWithTheme(
      <FilePickModal mode="push" files={FILES} defaultFile="" error={null} onConfirm={vi.fn()} onCancel={vi.fn()} />
    )

    fireEvent.click(screen.getByText('＋ 新建文件'))
    const input = screen.getByPlaceholderText(/英文名/) as HTMLInputElement
    fireEvent.change(input, { target: { value: '中文名' } })

    const confirm = screen.getByText('✓ 下一步') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(screen.getByText(/仅限英文/)).toBeTruthy()
  })

  it('pull 模式只有文件列表，选中后确认拉取', () => {
    const onConfirm = vi.fn()
    renderWithTheme(
      <FilePickModal mode="pull" files={FILES} defaultFile="bookmarks-chrome.json" error={null} onConfirm={onConfirm} onCancel={vi.fn()} />
    )

    expect(screen.queryByText('＋ 新建文件')).toBeNull()
    fireEvent.click(screen.getByText('✓ 拉取'))

    expect(onConfirm).toHaveBeenCalledWith('bookmarks-chrome.json')
  })

  it('pull 模式无文件时确认按钮禁用', () => {
    renderWithTheme(
      <FilePickModal mode="pull" files={[]} defaultFile="" error={null} onConfirm={vi.fn()} onCancel={vi.fn()} />
    )

    const confirm = screen.getByText('✓ 拉取') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
  })

  it('拉取失败时显示错误信息', () => {
    renderWithTheme(
      <FilePickModal mode="pull" files={[]} defaultFile="" error="GitHub API error" onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(screen.getByText(/GitHub API error/)).toBeTruthy()
  })
})
