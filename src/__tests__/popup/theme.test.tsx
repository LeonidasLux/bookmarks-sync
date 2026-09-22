import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '../../extension/popup/theme'
import { darkColors, lightColors } from '../../extension/popup/styles'

function scrollbarVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name)
}

describe('ThemeProvider', () => {
  it('按暗色主题注入 body 背景与滚动条颜色', () => {
    render(
      <ThemeProvider themeMode="dark">
        <span>内容</span>
      </ThemeProvider>,
    )

    expect(screen.getByText('内容')).toBeInTheDocument()
    expect(document.body.style.background).not.toBe('')
    expect(scrollbarVar('--scrollbar-thumb')).toBe(darkColors.scrollbar)
    expect(scrollbarVar('--scrollbar-thumb-hover')).toBe(darkColors.scrollbarHover)
  })

  it('亮色主题下滚动条颜色变浅，不再发黑', () => {
    render(
      <ThemeProvider themeMode="light">
        <span>内容</span>
      </ThemeProvider>,
    )

    expect(scrollbarVar('--scrollbar-thumb')).toBe(lightColors.scrollbar)
    expect(scrollbarVar('--scrollbar-thumb-hover')).toBe(lightColors.scrollbarHover)
    expect(lightColors.scrollbar).not.toBe(darkColors.scrollbar)
    // 注入的是 CSS 变量，index.html 里的 ::-webkit-scrollbar-thumb 会读取它
    expect(scrollbarVar('--scrollbar-thumb')).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
