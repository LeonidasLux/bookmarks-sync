import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../../extension/options/App'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('设置页 App', () => {
  it('标题与主题选择器位于顶部', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /Bookmarks Sync 设置/ })).toBeTruthy()
    expect(screen.getByLabelText('主题')).toBeTruthy()
  })

  it('以两列排布全部设置区块', () => {
    render(<App />)

    const left = screen.getByTestId('settings-column-left')
    const right = screen.getByTestId('settings-column-right')

    // 左列：仓库连接 + 同步文件
    expect(left.textContent).toContain('GitHub 仓库')
    expect(left.textContent).toContain('同步文件')

    // 右列：智能推荐 + 同步行为 + 定时同步 + 快捷键
    for (const title of ['书签智能推荐', '同步行为', '定时同步', '快捷键']) {
      expect(right.textContent).toContain(title)
    }
  })

  it('点击保存时向后台发送 SAVE_CONFIG', () => {
    const sendMessage = vi.fn()
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(sendMessage as never)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '$ save' }))

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage.mock.calls[0][0]).toMatchObject({ type: 'SAVE_CONFIG' })
  })
})
