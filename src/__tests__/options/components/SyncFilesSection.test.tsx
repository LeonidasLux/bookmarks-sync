import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SyncFilesSection } from '../../../extension/options/components/SyncFilesSection'
import { palettes } from '../../../extension/options/palette'
import { DEFAULT_CONFIG } from '../../../shared/types'
import type { AppConfig } from '../../../shared/types'
import type { RemoteFilesState } from '../../../extension/options/hooks/useRemoteFiles'
import type { UpdateField } from '../../../extension/options/types'

const FILES = ['bookmarks-chrome.json', 'bookmarks-edge.json']

function filesState(overrides: Partial<RemoteFilesState> = {}): RemoteFilesState {
  return {
    files: FILES,
    loading: false,
    error: null,
    ready: true,
    refresh: vi.fn(),
    ...overrides,
  }
}

function renderSection(config: Partial<AppConfig> = {}, updateField: UpdateField = vi.fn()) {
  return render(
    <SyncFilesSection
      config={{ ...DEFAULT_CONFIG, ...config }}
      updateField={updateField}
      syncFiles={filesState()}
      pullFiles={filesState()}
      colors={palettes.dark}
    />,
  )
}

describe('SyncFilesSection', () => {
  it('同卡片内渲染推送与拉取两个文件选择器', () => {
    renderSection()

    expect(screen.getByText('同步文件')).toBeTruthy()
    expect(screen.getByText('SYNC_FILE')).toBeTruthy()
    expect(screen.getByText('PULL_FILE')).toBeTruthy()
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })

  it('选择推送文件时写入 syncFileName', () => {
    const updateField = vi.fn() as unknown as UpdateField
    renderSection({}, updateField)

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'bookmarks-edge.json' } })
    expect(updateField).toHaveBeenCalledWith('syncFileName', 'bookmarks-edge.json')
  })

  it('选择拉取文件时写入 pullFileName', () => {
    const updateField = vi.fn() as unknown as UpdateField
    renderSection({}, updateField)

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'bookmarks-chrome.json' } })
    expect(updateField).toHaveBeenCalledWith('pullFileName', 'bookmarks-chrome.json')
  })

  it('远程文件为空时展示空列表提示', () => {
    render(
      <SyncFilesSection
        config={{ ...DEFAULT_CONFIG }}
        updateField={vi.fn() as unknown as UpdateField}
        syncFiles={filesState({ files: [] })}
        pullFiles={filesState({ files: [] })}
        colors={palettes.dark}
      />,
    )

    expect(screen.getByText(/远程暂无 bookmarks 文件，可直接新建/)).toBeTruthy()
  })
})
