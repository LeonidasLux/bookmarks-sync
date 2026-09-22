import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GithubSection } from '../../../extension/options/components/GithubSection'
import { palettes } from '../../../extension/options/palette'
import { DEFAULT_CONFIG } from '../../../shared/types'
import type { AppConfig } from '../../../shared/types'
import type { UpdateField } from '../../../extension/options/types'

function renderSection(config: Partial<AppConfig> = {}, updateField: UpdateField = vi.fn()) {
  return render(
    <GithubSection
      config={{ ...DEFAULT_CONFIG, ...config }}
      updateField={updateField}
      colors={palettes.dark}
    />,
  )
}

describe('GithubSection', () => {
  it('渲染 Token / Owner / Name 三个字段', () => {
    renderSection()

    expect(screen.getByText('GitHub 仓库')).toBeTruthy()
    expect(screen.getByLabelText('GITHUB_TOKEN')).toBeTruthy()
    expect(screen.getByLabelText('REPO_OWNER')).toBeTruthy()
    expect(screen.getByLabelText('REPO_NAME')).toBeTruthy()
  })

  it('修改字段时通过 updateField 写回', () => {
    const updateField = vi.fn() as unknown as UpdateField
    renderSection({}, updateField)

    fireEvent.change(screen.getByLabelText('REPO_OWNER'), { target: { value: 'alice' } })
    expect(updateField).toHaveBeenCalledWith('repoOwner', 'alice')

    fireEvent.change(screen.getByLabelText('GITHUB_TOKEN'), { target: { value: 'ghp_x' } })
    expect(updateField).toHaveBeenCalledWith('githubToken', 'ghp_x')
  })

  it('填写 owner 后展示仓库地址链接', () => {
    renderSection({ repoOwner: 'alice', repoName: '' })

    expect(screen.getByText(/https:\/\/github\.com\/alice\/my-bookmarks/)).toBeTruthy()
  })

  it('未填写 owner 时不展示仓库地址', () => {
    renderSection({ repoOwner: '' })

    expect(screen.queryByText(/# 仓库地址/)).toBeNull()
  })
})
