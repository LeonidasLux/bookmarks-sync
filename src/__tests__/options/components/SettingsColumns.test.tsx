import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsColumns } from '../../../extension/options/components/SettingsColumns'

describe('SettingsColumns', () => {
  it('并排渲染左右两列内容', () => {
    render(<SettingsColumns left={<div>左侧内容</div>} right={<div>右侧内容</div>} />)

    expect(screen.getByText('左侧内容')).toBeTruthy()
    expect(screen.getByText('右侧内容')).toBeTruthy()
  })

  it('容器为可换行的横向 flex，两列均为等宽纵列', () => {
    render(<SettingsColumns left={<span>L</span>} right={<span>R</span>} />)

    const container = screen.getByTestId('settings-columns')
    expect(container.style.display).toBe('flex')
    expect(container.style.flexWrap).toBe('wrap')

    for (const id of ['settings-column-left', 'settings-column-right']) {
      const column = screen.getByTestId(id)
      expect(column.style.display).toBe('flex')
      expect(column.style.flexDirection).toBe('column')
      expect(column.style.flexGrow).toBe('1')
      expect(column.style.flexShrink).toBe('1')
      expect(column.style.flexBasis).toBe('380px')
    }
  })
})
