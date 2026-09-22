import { useEffect, useState } from 'react'
import type { AppConfig } from '../../../shared/types'
import type { Palette } from '../palette'

export type ResolvedTheme = 'dark' | 'light'

/**
 * 根据配置解析实际生效的主题；theme 为 system / 未设置时跟随系统偏好。
 */
export function useResolvedTheme(theme: AppConfig['theme'] | undefined): ResolvedTheme {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  if (theme === 'dark' || theme === 'light') return theme
  return systemDark ? 'dark' : 'light'
}

/**
 * 把当前调色板同步到 body 与滚动条变量，
 * 保证页面留白区域、滚动条颜色与设置页主题一致。
 */
export function usePageTheme(colors: Pick<Palette, 'bg' | 'text' | 'scrollbar' | 'scrollbarHover'>) {
  const { bg, text, scrollbar, scrollbarHover } = colors

  useEffect(() => {
    document.body.style.background = bg
    document.body.style.color = text
    document.body.style.transition = 'background 0.2s, color 0.2s'

    const root = document.documentElement
    root.style.setProperty('--scrollbar-thumb', scrollbar)
    root.style.setProperty('--scrollbar-thumb-hover', scrollbarHover)
  }, [bg, text, scrollbar, scrollbarHover])
}
