import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionCard } from '../../../extension/options/components/SectionCard'
import { SuggestSection } from '../../../extension/options/components/SuggestSection'
import { SyncOptionsSection } from '../../../extension/options/components/SyncOptionsSection'
import { AutoSyncSection } from '../../../extension/options/components/AutoSyncSection'
import { ShortcutsSection } from '../../../extension/options/components/ShortcutsSection'
import { SaveBar } from '../../../extension/options/components/SaveBar'
import { palettes } from '../../../extension/options/palette'
import { DEFAULT_AUTO_SYNC_INTERVAL, DEFAULT_CONFIG } from '../../../shared/types'
import type { UpdateField } from '../../../extension/options/types'

const colors = palettes.dark

describe('SectionCard', () => {
  it('渲染标题与内容', () => {
    render(<SectionCard title="同步文件" icon="🗂" colors={colors}><span>内容</span></SectionCard>)

    expect(screen.getByRole('heading', { name: /同步文件/ })).toBeTruthy()
    expect(screen.getByText('内容')).toBeTruthy()
  })
})

describe('SuggestSection', () => {
  it('渲染 TypeSafe Key 输入框', () => {
    render(<SuggestSection config={{ ...DEFAULT_CONFIG }} updateField={vi.fn()} colors={colors} />)

    expect(screen.getByText('书签智能推荐')).toBeTruthy()
    expect(screen.getByLabelText('TYPESAFE_API_KEY')).toBeTruthy()
  })

  it('输入 Key 时写回 typesafeApiKey', () => {
    const updateField = vi.fn() as unknown as UpdateField
    render(<SuggestSection config={{ ...DEFAULT_CONFIG }} updateField={updateField} colors={colors} />)

    fireEvent.change(screen.getByLabelText('TYPESAFE_API_KEY'), { target: { value: 'ts_1' } })
    expect(updateField).toHaveBeenCalledWith('typesafeApiKey', 'ts_1')
  })
})

describe('SyncOptionsSection', () => {
  it('切换空文件夹清理开关', () => {
    const updateField = vi.fn() as unknown as UpdateField
    render(
      <SyncOptionsSection
        config={{ ...DEFAULT_CONFIG, cleanEmptyFolders: true }}
        updateField={updateField}
        colors={colors}
      />,
    )

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)

    fireEvent.click(checkbox)
    expect(updateField).toHaveBeenCalledWith('cleanEmptyFolders', false)
  })
})

describe('AutoSyncSection', () => {
  it('未启用时不展示间隔输入', () => {
    render(
      <AutoSyncSection config={{ ...DEFAULT_CONFIG, autoSyncInterval: 0 }} updateField={vi.fn()} colors={colors} />,
    )

    expect(screen.getByText('定时同步')).toBeTruthy()
    expect(screen.queryByLabelText('同步间隔（分钟）')).toBeNull()
  })

  it('勾选后写入默认间隔 360 分钟', () => {
    const updateField = vi.fn() as unknown as UpdateField
    render(
      <AutoSyncSection config={{ ...DEFAULT_CONFIG, autoSyncInterval: 0 }} updateField={updateField} colors={colors} />,
    )

    fireEvent.click(screen.getByRole('checkbox'))
    expect(updateField).toHaveBeenCalledWith('autoSyncInterval', DEFAULT_AUTO_SYNC_INTERVAL)
    expect(DEFAULT_AUTO_SYNC_INTERVAL).toBe(360)
  })

  it('启用后展示间隔输入并写回数值', () => {
    const updateField = vi.fn() as unknown as UpdateField
    render(
      <AutoSyncSection config={{ ...DEFAULT_CONFIG, autoSyncInterval: 30 }} updateField={updateField} colors={colors} />,
    )

    const input = screen.getByLabelText('同步间隔（分钟）') as HTMLInputElement
    expect(input.value).toBe('30')

    fireEvent.change(input, { target: { value: '60' } })
    expect(updateField).toHaveBeenCalledWith('autoSyncInterval', 60)
  })

  it('输入非法间隔时回落为 1 分钟', () => {
    const updateField = vi.fn() as unknown as UpdateField
    render(
      <AutoSyncSection config={{ ...DEFAULT_CONFIG, autoSyncInterval: 30 }} updateField={updateField} colors={colors} />,
    )

    fireEvent.change(screen.getByLabelText('同步间隔（分钟）'), { target: { value: '0' } })
    expect(updateField).toHaveBeenCalledWith('autoSyncInterval', 1)
  })

  it('清空间隔输入时回落到默认间隔 360 分钟', () => {
    const updateField = vi.fn() as unknown as UpdateField
    render(
      <AutoSyncSection config={{ ...DEFAULT_CONFIG, autoSyncInterval: 360 }} updateField={updateField} colors={colors} />,
    )

    fireEvent.change(screen.getByLabelText('同步间隔（分钟）'), { target: { value: '' } })
    expect(updateField).toHaveBeenCalledWith('autoSyncInterval', DEFAULT_AUTO_SYNC_INTERVAL)
  })
})

describe('ShortcutsSection', () => {
  it('按功能与快捷键展示命令列表', () => {
    render(
      <ShortcutsSection
        commands={[
          { name: 'save-bookmark', description: '保存当前页面到书签', shortcut: 'Alt+B' },
          { name: 'no-shortcut', description: '未绑定功能', shortcut: '' },
        ]}
        colors={colors}
      />,
    )

    expect(screen.getByText('保存当前页面到书签')).toBeTruthy()
    expect(screen.getByText('Alt+B')).toBeTruthy()
    expect(screen.getByText('未设置')).toBeTruthy()
  })
})

describe('SaveBar', () => {
  it('点击保存按钮触发 onSave', () => {
    const onSave = vi.fn()
    render(<SaveBar saved={false} onSave={onSave} colors={colors} />)

    fireEvent.click(screen.getByRole('button', { name: '$ save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('saved 为 true 时展示已保存提示', () => {
    render(<SaveBar saved onSave={vi.fn()} colors={colors} />)

    expect(screen.getByText(/已保存/)).toBeTruthy()
  })

  it('saved 为 false 时不展示已保存提示', () => {
    render(<SaveBar saved={false} onSave={vi.fn()} colors={colors} />)

    expect(screen.queryByText(/已保存/)).toBeNull()
  })
})
