import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePageTheme, useResolvedTheme } from '../../../extension/options/hooks/useTheme'
import { palettes } from '../../../extension/options/palette'

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
  return listeners
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useResolvedTheme', () => {
  it('显式指定 dark / light 时直接返回对应主题', () => {
    mockMatchMedia(false)

    expect(renderHook(() => useResolvedTheme('dark')).result.current).toBe('dark')
    expect(renderHook(() => useResolvedTheme('light')).result.current).toBe('light')
  })

  it('system 时跟随系统浅色偏好', () => {
    mockMatchMedia(false)

    expect(renderHook(() => useResolvedTheme('system')).result.current).toBe('light')
  })

  it('system 时跟随系统深色偏好', () => {
    mockMatchMedia(true)

    expect(renderHook(() => useResolvedTheme('system')).result.current).toBe('dark')
  })

  it('theme 未设置时按 system 处理', () => {
    mockMatchMedia(true)

    expect(renderHook(() => useResolvedTheme(undefined)).result.current).toBe('dark')
  })
})

describe('usePageTheme', () => {
  it('把背景、文字色与滚动条颜色同步到页面', () => {
    renderHook(() => usePageTheme(palettes.dark))

    const firstBackground = document.body.style.background
    expect(firstBackground).not.toBe('')
    expect(document.body.style.color).not.toBe('')
    expect(document.documentElement.style.getPropertyValue('--scrollbar-thumb'))
      .toBe(palettes.dark.scrollbar)

    renderHook(() => usePageTheme(palettes.light))

    expect(document.body.style.background).not.toBe(firstBackground)
    expect(document.body.style.transition).toContain('background')
    // 滚动条颜色跟随主题切换，避免亮色主题下出现发黑的滚动条
    expect(document.documentElement.style.getPropertyValue('--scrollbar-thumb'))
      .toBe(palettes.light.scrollbar)
    expect(document.documentElement.style.getPropertyValue('--scrollbar-thumb-hover'))
      .toBe(palettes.light.scrollbarHover)
    expect(palettes.light.scrollbar).not.toBe(palettes.dark.scrollbar)
  })
})
