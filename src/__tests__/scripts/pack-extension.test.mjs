import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectExtensionFiles, packExtension, parseArgs } from '../../../scripts/pack-extension.mjs'
import { extensionIdFromPublicKey, publicKeyDerFrom } from '../../../scripts/lib/crx.mjs'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SCRIPT = join(PROJECT_ROOT, 'scripts/pack-extension.mjs')

let workspace
let distDir
let outDir

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'bs-pack-'))
  distDir = join(workspace, 'dist')
  outDir = join(workspace, 'release')

  mkdirSync(join(distDir, 'assets'), { recursive: true })
  writeFileSync(
    join(distDir, 'manifest.json'),
    JSON.stringify({ manifest_version: 3, name: 'demo', version: '9.9.9' }),
  )
  writeFileSync(join(distDir, 'assets', 'app.js'), 'console.log(1)')
  writeFileSync(join(distDir, '.DS_Store'), 'junk')
})

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('parseArgs', () => {
  it('默认值：dist / release / 全部打包', () => {
    expect(parseArgs([])).toEqual({ dist: 'dist', out: 'release', key: '', name: '', only: 'all' })
  })

  it('支持空格与等号两种取值写法', () => {
    expect(parseArgs(['--dist', 'build', '--out=release2', '--only', 'zip'])).toMatchObject({
      dist: 'build',
      out: 'release2',
      only: 'zip',
    })
  })

  it('非法参数直接报错', () => {
    expect(() => parseArgs(['--only', 'tar'])).toThrow(/只支持 zip 或 crx/)
    expect(() => parseArgs(['--unknown'])).toThrow(/未知参数/)
    expect(() => parseArgs(['--dist'])).toThrow(/缺少取值/)
  })
})

describe('collectExtensionFiles', () => {
  it('递归收集文件、忽略系统垃圾文件并按名称排序', async () => {
    const files = await collectExtensionFiles(distDir)

    expect(files.map(file => file.name)).toEqual(['assets/app.js', 'manifest.json'])
  })
})

describe('packExtension', () => {
  it('产物版本取 manifest.version，与 package.json 不一致时给出提示', async () => {
    const logs = []
    const result = await packExtension({
      distDir,
      outDir: join(workspace, 'version-note'),
      name: 'demo',
      only: 'zip',
      log: message => logs.push(message),
    })

    expect(result.version).toBe('9.9.9')
    expect(result.packageVersion).not.toBe('9.9.9')
    expect(logs.some(message => message.includes('不一致'))).toBe(true)
  })

  it('生成 zip 与 crx，并自动创建 600 权限的签名私钥', async () => {
    const keyPath = join(workspace, 'keys', 'demo.pem')
    const result = await packExtension({ distDir, outDir, keyPath, name: 'demo' })

    const zipPath = join(outDir, 'demo-9.9.9.zip')
    const crxPath = join(outDir, 'demo-9.9.9.crx')
    expect(result.zipPath).toBe(zipPath)
    expect(result.crxPath).toBe(crxPath)
    expect(existsSync(zipPath)).toBe(true)
    expect(existsSync(crxPath)).toBe(true)

    // zip 以 PK 开头，crx 以 Cr24 + 版本 3 开头
    expect(readFileSync(zipPath).subarray(0, 2).toString('latin1')).toBe('PK')
    const crx = readFileSync(crxPath)
    expect(crx.subarray(0, 4).toString('latin1')).toBe('Cr24')
    expect(crx.readUInt32LE(4)).toBe(3)

    // 扩展 ID 由私钥决定，可与私钥重新推导的结果对上
    expect(result.extensionId).toBe(
      extensionIdFromPublicKey(publicKeyDerFrom(readFileSync(keyPath, 'utf8'))),
    )
    expect(statSync(keyPath).mode & 0o777).toBe(0o600)
  })

  it('复用已有私钥，保证扩展 ID 稳定', async () => {
    const keyPath = join(workspace, 'keys', 'demo.pem')
    const first = await packExtension({ distDir, outDir, keyPath, name: 'demo' })
    const second = await packExtension({ distDir, outDir, keyPath, name: 'demo' })

    expect(second.extensionId).toBe(first.extensionId)
  })

  it('--only zip 时不生成 crx 与私钥', async () => {
    const onlyZipOut = join(workspace, 'zip-only')
    const keyPath = join(workspace, 'zip-only-keys', 'demo.pem')
    const result = await packExtension({ distDir, outDir: onlyZipOut, keyPath, name: 'demo', only: 'zip' })

    expect(existsSync(result.zipPath)).toBe(true)
    expect(result.crxPath).toBeUndefined()
    expect(existsSync(keyPath)).toBe(false)
  })

  it('缺少 manifest.json 时给出可读错误', async () => {
    const emptyDir = join(workspace, 'empty')
    mkdirSync(emptyDir, { recursive: true })

    await expect(packExtension({ distDir: emptyDir, outDir, name: 'demo' }))
      .rejects.toThrow(/manifest\.json/)
    await expect(packExtension({ distDir: join(workspace, 'nope'), outDir, name: 'demo' }))
      .rejects.toThrow(/pnpm build/)
  })
})

describe('命令行入口', () => {
  it('可通过 node 直接执行并输出产物', () => {
    const cliOut = join(workspace, 'cli')
    const stdout = execFileSync(process.execPath, [
      SCRIPT,
      '--dist', distDir,
      '--out', cliOut,
      '--key', join(workspace, 'cli-keys', 'demo.pem'),
      '--name', 'cli-demo',
    ], { encoding: 'utf8' })

    expect(stdout).toContain('扩展 ID')
    expect(existsSync(join(cliOut, 'cli-demo-9.9.9.zip'))).toBe(true)
    expect(existsSync(join(cliOut, 'cli-demo-9.9.9.crx'))).toBe(true)
  })

  it('--help 输出用法说明', () => {
    const stdout = execFileSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8' })
    expect(stdout).toContain('--only <类型>')
  })
})
