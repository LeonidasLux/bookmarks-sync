import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import {
  AUTO_SYNC_ALARM,
  canAutoSync,
  scheduleAutoSync,
} from '../../extension/background/auto-sync'
import { DEFAULT_CONFIG, type AppConfig } from '../../shared/types'

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...DEFAULT_CONFIG, ...overrides }
}

const alarmsMock = {
  create: vi.fn(),
  clear: vi.fn(() => Promise.resolve(true)),
  onAlarm: { addListener: vi.fn() },
}
// setup.ts 的 mock chrome 不含 alarms，此处挂载（scheduleAutoSync 与 service-worker 均依赖）
;(globalThis as any).chrome.alarms = alarmsMock

function mockFetchResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response
}

describe('canAutoSync', () => {
  it('间隔 >= 1 且凭据完整时返回 true', () => {
    expect(canAutoSync(makeConfig({ autoSyncInterval: 30, githubToken: 't', repoOwner: 'o', repoName: 'r' }))).toBe(true)
  })

  it('间隔为 0（禁用）时返回 false', () => {
    expect(canAutoSync(makeConfig({ autoSyncInterval: 0, githubToken: 't', repoOwner: 'o', repoName: 'r' }))).toBe(false)
  })

  it('缺少任一凭据时返回 false', () => {
    expect(canAutoSync(makeConfig({ autoSyncInterval: 30, githubToken: '', repoOwner: 'o', repoName: 'r' }))).toBe(false)
  })
})

describe('scheduleAutoSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('启用时按配置周期创建 alarm', () => {
    scheduleAutoSync(makeConfig({ autoSyncInterval: 30, githubToken: 't', repoOwner: 'o', repoName: 'r' }))

    expect(alarmsMock.create).toHaveBeenCalledWith(AUTO_SYNC_ALARM, { delayInMinutes: 30, periodInMinutes: 30 })
    expect(alarmsMock.clear).not.toHaveBeenCalled()
  })

  it('禁用时清除 alarm 且不创建', () => {
    scheduleAutoSync(makeConfig({ autoSyncInterval: 0, githubToken: 't', repoOwner: 'o', repoName: 'r' }))

    expect(alarmsMock.clear).toHaveBeenCalledWith(AUTO_SYNC_ALARM)
    expect(alarmsMock.create).not.toHaveBeenCalled()
  })

  it('凭据不完整时不创建 alarm（避免空转报错）', () => {
    scheduleAutoSync(makeConfig({ autoSyncInterval: 30 }))

    expect(alarmsMock.clear).toHaveBeenCalledWith(AUTO_SYNC_ALARM)
    expect(alarmsMock.create).not.toHaveBeenCalled()
  })
})

describe('定时同步集成（service-worker）', () => {
  let runAutoSync: () => Promise<void>
  let handleAutoSyncAlarm: (alarm: chrome.alarms.Alarm) => void

  beforeAll(async () => {
    const mod = await import('../../extension/background/service-worker')
    runAutoSync = mod.runAutoSync
    handleAutoSyncAlarm = mod.handleAutoSyncAlarm
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** 让 storage 返回指定配置，并捕获写入调用 */
  function stubStorage(config: AppConfig) {
    vi.spyOn(chrome.storage.local, 'get').mockImplementation((_keys, cb) => {
      cb({ config })
    })
    return vi.spyOn(chrome.storage.local, 'set').mockImplementation((_items, cb) => {
      if (cb) cb()
      return Promise.resolve()
    })
  }

  it('定时推送成功：推送到配置的同步文件并写入成功日志', async () => {
    const setSpy = stubStorage(makeConfig({ autoSyncInterval: 30, githubToken: 't', repoOwner: 'o', repoName: 'r' }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse(404, {})) // getRemoteSha：文件不存在
      .mockResolvedValueOnce(mockFetchResponse(200, {})) // PUT 成功
    vi.stubGlobal('fetch', fetchMock)

    await runAutoSync()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const putCall = fetchMock.mock.calls[1]
    expect(putCall[0]).toBe('https://api.github.com/repos/o/r/contents/bookmarks.json')
    expect((putCall[1] as RequestInit).method).toBe('PUT')

    const successLog = setSpy.mock.calls.find(c => {
      const log = (c[0] as Record<string, unknown>).syncLog as { success?: boolean } | undefined
      return log?.success === true
    })
    expect(successLog).toBeTruthy()
  })

  it('定时推送失败时写入失败日志', async () => {
    const setSpy = stubStorage(makeConfig({ autoSyncInterval: 30, githubToken: 't', repoOwner: 'o', repoName: 'r' }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(500, {})))

    await runAutoSync()

    const failLog = setSpy.mock.calls.find(c => {
      const log = (c[0] as Record<string, unknown>).syncLog as { success?: boolean } | undefined
      return log?.success === false
    })
    expect(failLog).toBeTruthy()
  })

  it('凭据不完整时定时同步不发起请求并记录失败', async () => {
    const setSpy = stubStorage(makeConfig({ autoSyncInterval: 30, githubToken: '', repoOwner: 'o', repoName: 'r' }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await runAutoSync()

    expect(fetchMock).not.toHaveBeenCalled()
    const failLog = setSpy.mock.calls.find(c => {
      const log = (c[0] as Record<string, unknown>).syncLog as { success?: boolean } | undefined
      return log?.success === false
    })
    expect(failLog).toBeTruthy()
  })

  it('alarm 监听仅响应 auto-sync alarm', async () => {
    stubStorage(makeConfig({ autoSyncInterval: 30, githubToken: 't', repoOwner: 'o', repoName: 'r' }))
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    // 其他 alarm 不触发同步
    handleAutoSyncAlarm({ name: 'other-alarm', scheduledTime: Date.now() })
    await new Promise(r => setTimeout(r, 20))
    expect(fetchMock).not.toHaveBeenCalled()

    // auto-sync alarm 触发推送（getRemoteSha 200 + PUT 200）
    fetchMock.mockClear()
    fetchMock
      .mockResolvedValueOnce(mockFetchResponse(200, { sha: 'abc' }))
      .mockResolvedValueOnce(mockFetchResponse(200, {}))
    handleAutoSyncAlarm({ name: AUTO_SYNC_ALARM, scheduledTime: Date.now() })
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})
