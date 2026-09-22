import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { darkColors, lightColors, fonts, createStyles, type ColorScheme } from './styles'

type ThemeMode = 'dark' | 'light' | 'system'

interface ThemeValue {
  colors: ColorScheme
  fonts: typeof fonts
  styles: ReturnType<typeof createStyles>
}

const ThemeContext = createContext<ThemeValue | null>(null)

/** 解析主题模式：'system' → 跟随系统偏好 */
function resolveTheme(mode: ThemeMode, systemDark: boolean): 'dark' | 'light' {
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode
}

export function ThemeProvider({
  themeMode,
  children,
}: {
  themeMode: ThemeMode
  children: ReactNode
}) {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolved = resolveTheme(themeMode, systemDark)
  const colors = resolved === 'dark' ? darkColors : lightColors

  const value = useMemo(
    () => ({ colors, fonts, styles: createStyles(colors) }),
    [colors],
  )

  // 同步 body 背景色与滚动条颜色（避免 HTML 中写死暗色）
  useEffect(() => {
    document.body.style.background = colors.bg
    document.body.style.color = colors.text
    const root = document.documentElement
    root.style.setProperty('--scrollbar-thumb', colors.scrollbar)
    root.style.setProperty('--scrollbar-thumb-hover', colors.scrollbarHover)
    return () => {
      document.body.style.background = ''
      document.body.style.color = ''
    }
  }, [colors])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme() must be used inside <ThemeProvider>')
  }
  return ctx
}
