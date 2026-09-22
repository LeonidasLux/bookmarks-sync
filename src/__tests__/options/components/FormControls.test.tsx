import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FieldLabel } from '../../../extension/options/components/FieldLabel'
import { TextInput } from '../../../extension/options/components/TextInput'
import { SecretInput } from '../../../extension/options/components/SecretInput'
import { ThemeSelector } from '../../../extension/options/components/ThemeSelector'
import { palettes } from '../../../extension/options/palette'

const colors = palettes.dark

describe('FieldLabel', () => {
  it('渲染字段名与可选说明', () => {
    render(<FieldLabel name="REPO_OWNER" hint="(可选)" colors={colors} />)

    expect(screen.getByText('REPO_OWNER')).toBeTruthy()
    expect(screen.getByText('(可选)')).toBeTruthy()
  })

  it('必填时显示星号标记', () => {
    const { container } = render(<FieldLabel name="GITHUB_TOKEN" required colors={colors} />)

    expect(container.textContent).toContain('*')
  })
})

describe('TextInput', () => {
  it('渲染初始值并在输入时回调', () => {
    const onChange = vi.fn()
    render(<TextInput value="alice" onChange={onChange} colors={colors} ariaLabel="REPO_OWNER" />)

    const input = screen.getByLabelText('REPO_OWNER') as HTMLInputElement
    expect(input.value).toBe('alice')

    fireEvent.change(input, { target: { value: 'bob' } })
    expect(onChange).toHaveBeenCalledWith('bob')
  })

  it('支持 number 类型', () => {
    render(<TextInput type="number" value="30" onChange={vi.fn()} colors={colors} ariaLabel="间隔" />)

    expect((screen.getByLabelText('间隔') as HTMLInputElement).type).toBe('number')
  })
})

describe('SecretInput', () => {
  it('默认隐藏内容，可通过按钮切换明文', () => {
    render(<SecretInput value="ghp_secret" onChange={vi.fn()} colors={colors} ariaLabel="GITHUB_TOKEN" label="Token" />)

    const input = screen.getByLabelText('GITHUB_TOKEN') as HTMLInputElement
    expect(input.type).toBe('password')

    fireEvent.click(screen.getByTitle('显示 Token'))
    expect(input.type).toBe('text')
    expect(screen.getByTitle('隐藏 Token')).toBeTruthy()
  })

  it('输入时回调最新值', () => {
    const onChange = vi.fn()
    render(<SecretInput value="" onChange={onChange} colors={colors} ariaLabel="TYPESAFE_API_KEY" label="Key" />)

    fireEvent.change(screen.getByLabelText('TYPESAFE_API_KEY'), { target: { value: 'ts_abc' } })
    expect(onChange).toHaveBeenCalledWith('ts_abc')
  })
})

describe('ThemeSelector', () => {
  it('列出三种主题并回显当前值', () => {
    render(<ThemeSelector value="dark" onChange={vi.fn()} colors={colors} />)

    const select = screen.getByLabelText('主题') as HTMLSelectElement
    expect(select.value).toBe('dark')
    expect(screen.getByRole('option', { name: '🌓 跟随系统' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '☀️ 亮色' })).toBeTruthy()
  })

  it('切换主题时回调新值', () => {
    const onChange = vi.fn()
    render(<ThemeSelector value="system" onChange={onChange} colors={colors} />)

    fireEvent.change(screen.getByLabelText('主题'), { target: { value: 'light' } })
    expect(onChange).toHaveBeenCalledWith('light')
  })

  it('标签使用 normal 行高，避免与下拉框垂直中心错位', () => {
    render(<ThemeSelector value="system" onChange={vi.fn()} colors={colors} />)

    const label = screen.getByText(/主题/, { selector: 'span' })
    expect(label.style.lineHeight).toBe('normal')
  })
})
