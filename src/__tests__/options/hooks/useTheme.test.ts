import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBodyTheme, useResolvedTheme } from '../../../extension/options/hooks/useTheme'

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

describe('useBodyTheme', () => {
  it('把背景与文字色同步到 body', () => {
    renderHook(() => useBodyTheme('#0d1117', '#e6edf3'))

    const firstBackground = document.body.style.background
    expect(firstBackground).not.toBe('')
    expect(document.body.style.color).not.toBe('')

    renderHook(() => useBodyTheme('#ffffff', '#1f2328'))
    expect(document.body.style.background).not.toBe(firstBackground)
    expect(document.body.style.transition).toContain('background')
  })
})
