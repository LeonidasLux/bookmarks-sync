import type { ReactNode } from 'react'
import type { Palette } from '../palette'
import { font } from '../styles'

interface SectionCardProps {
  title: string
  icon: string
  colors: Palette
  children: ReactNode
}

/** 设置区块卡片：标题 + 内容，两列布局中的统一容器 */
export function SectionCard({ title, icon, colors, children }: SectionCardProps) {
  return (
    <section
      style={{
        background: colors.surface,
        borderRadius: '8px',
        border: `1px solid ${colors.border}`,
        padding: '1rem 1.125rem',
      }}
    >
      <h2
        style={{
          fontSize: '13px',
          fontWeight: 600,
          margin: '0 0 0.875rem',
          fontFamily: font,
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
        }}
      >
        <span style={{ color: colors.accent }}>{icon}</span> {title}
      </h2>
      {children}
    </section>
  )
}
