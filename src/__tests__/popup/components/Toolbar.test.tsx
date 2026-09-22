import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithTheme } from '../test-utils'
import { Toolbar } from '../../../extension/popup/components/Toolbar'

describe('Toolbar', () => {
  const defaultProps = {
    pushLoading: false,
    pullLoading: false,
    onSaveCurrent: vi.fn(),
    onPush: vi.fn(),
    onPull: vi.fn(),
    onOpenOptions: vi.fn(),
  }

  it('应渲染工具栏标题', () => {
    renderWithTheme(<Toolbar {...defaultProps} />)
    expect(screen.getByText('bookmarks')).toBeInTheDocument()
  })

  it('应渲染所有功能按钮', () => {
    renderWithTheme(<Toolbar {...defaultProps} />)
    expect(screen.getByTitle('保存当前标签页到书签')).toBeInTheDocument()
    expect(screen.getByTitle('推送到 GitHub（强制覆盖远程）')).toBeInTheDocument()
    expect(screen.getByTitle('从 GitHub 拉取（对比差异后手动合并）')).toBeInTheDocument()
    expect(screen.getByTitle('设置')).toBeInTheDocument()
  })

  it('push 按钮应在 pushLoading 时为 disabled', () => {
    renderWithTheme(<Toolbar {...defaultProps} pushLoading={true} />)
    const pushBtn = screen.getByTitle('推送到 GitHub（强制覆盖远程）')
    expect(pushBtn).toBeDisabled()
  })

  it('pull 按钮应在 pullLoading 时为 disabled', () => {
    renderWithTheme(<Toolbar {...defaultProps} pullLoading={true} />)
    const pullBtn = screen.getByTitle('从 GitHub 拉取（对比差异后手动合并）')
    expect(pullBtn).toBeDisabled()
  })

  it('点击 push 按钮应触发 onPush', () => {
    const onPush = vi.fn()
    renderWithTheme(<Toolbar {...defaultProps} onPush={onPush} />)
    fireEvent.click(screen.getByTitle('推送到 GitHub（强制覆盖远程）'))
    expect(onPush).toHaveBeenCalledTimes(1)
  })

  it('syncDisabled 时应禁用 push / pull，但保留保存与设置', () => {
    const onPush = vi.fn()
    const onPull = vi.fn()
    renderWithTheme(<Toolbar {...defaultProps} syncDisabled onPush={onPush} onPull={onPull} />)

    expect(screen.getByTitle(/推送到 GitHub/)).toBeDisabled()
    expect(screen.getByTitle(/从 GitHub 拉取/)).toBeDisabled()
    expect(screen.getByTitle('保存当前标签页到书签')).not.toBeDisabled()
    expect(screen.getByTitle('设置')).not.toBeDisabled()

    fireEvent.click(screen.getByTitle(/推送到 GitHub/))
    fireEvent.click(screen.getByTitle(/从 GitHub 拉取/))
    expect(onPush).not.toHaveBeenCalled()
    expect(onPull).not.toHaveBeenCalled()
  })
})
