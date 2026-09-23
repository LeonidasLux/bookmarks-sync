#!/usr/bin/env node
/**
 * 打包扩展：把 `dist/` 打成可直接分发的 `.zip` 与可安装的 `.crx`（CRX3 签名）。
 *
 * 用法：
 *   node scripts/pack-extension.mjs [选项]
 *   pnpm package:ext            # 先 pnpm build，再打包 zip + crx
 *
 * 选项：
 *   --dist <目录>   构建产物目录，默认 dist
 *   --out <目录>    输出目录，默认 release
 *   --key <文件>    签名私钥（PEM），默认 .keys/<包名>.pem，不存在时自动生成
 *   --name <名称>   产物文件名前缀，默认取 package.json 的 name
 *   --only <类型>   只打包 zip 或 crx（zip | crx）
 *   --help          查看帮助
 */
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createZip } from './lib/zip.mjs'
import { generateKeyPair, packCrx } from './lib/crx.mjs'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** 打包时忽略的系统垃圾文件 */
const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db'])

export const DEFAULT_OPTIONS = {
  dist: 'dist',
  out: 'release',
  key: '',
  name: '',
  only: 'all',
}

/** 解析命令行参数 */
export function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    const [flag, inlineValue] = arg.split('=')
    const takeValue = () => {
      const value = inlineValue ?? argv[++i]
      if (!value) throw new Error(`参数 ${flag} 缺少取值`)
      return value
    }

    switch (flag) {
      case '--dist':
        options.dist = takeValue()
        break
      case '--out':
        options.out = takeValue()
        break
      case '--key':
        options.key = takeValue()
        break
      case '--name':
        options.name = takeValue()
        break
      case '--only': {
        const value = takeValue()
        if (value !== 'zip' && value !== 'crx') {
          throw new Error(`--only 只支持 zip 或 crx，收到: ${value}`)
        }
        options.only = value
        break
      }
      default:
        throw new Error(`未知参数: ${arg}`)
    }
  }

  return options
}

/** 递归收集扩展文件，返回 ZIP 条目（相对路径用 `/` 分隔，按名称排序） */
export async function collectExtensionFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolute = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectExtensionFiles(rootDir, absolute))
    } else if (entry.isFile() && !IGNORED_FILES.has(entry.name)) {
      files.push({
        name: relative(rootDir, absolute).split(/[\\/]/).join('/'),
        data: await readFile(absolute),
      })
    }
  }

  return files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

/** 读取（必要时生成）CRX 签名私钥，返回 PEM 内容 */
export async function loadOrCreateKey(keyPath, log = () => {}) {
  if (existsSync(keyPath)) {
    return readFile(keyPath, 'utf8')
  }

  const { privateKey } = generateKeyPair()
  await mkdir(dirname(keyPath), { recursive: true })
  await writeFile(keyPath, privateKey, { mode: 0o600 })
  await chmod(keyPath, 0o600)
  log(`🔑 已生成新的签名私钥：${keyPath}（扩展 ID 由它决定，请妥善保管）`)
  return privateKey
}

function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

/** 项目内路径显示为相对路径，项目外保持绝对路径 */
function displayPath(target) {
  const relativePath = relative(PROJECT_ROOT, target)
  return relativePath.startsWith('..') ? target : relativePath
}

/**
 * 打包扩展，返回产物路径。
 * @param {{ distDir?: string, outDir?: string, keyPath?: string, name?: string, only?: 'all' | 'zip' | 'crx', log?: (msg: string) => void }} params
 */
export async function packExtension(params = {}) {
  const {
    distDir = resolve(PROJECT_ROOT, DEFAULT_OPTIONS.dist),
    outDir = resolve(PROJECT_ROOT, DEFAULT_OPTIONS.out),
    only = 'all',
    log = () => {},
  } = params

  const pkg = JSON.parse(await readFile(join(PROJECT_ROOT, 'package.json'), 'utf8'))
  const name = params.name || pkg.name
  const keyPath = params.keyPath || resolve(PROJECT_ROOT, '.keys', `${name}.pem`)

  if (!existsSync(distDir)) {
    throw new Error(`未找到构建产物目录 ${distDir}，请先执行 pnpm build`)
  }
  const files = await collectExtensionFiles(distDir)
  const manifestEntry = files.find(file => file.name === 'manifest.json')
  if (!manifestEntry) {
    throw new Error(`${distDir} 缺少 manifest.json，请先执行 pnpm build`)
  }
  const manifest = JSON.parse(manifestEntry.data.toString('utf8'))

  log(`📦 待打包文件：${files.length} 个（manifest v${manifest.manifest_version}）`)
  const zip = createZip(files)
  await mkdir(outDir, { recursive: true })

  // 产物版本以 manifest.version 为准（Chrome 用它判断更新），并提示与 package.json 的差异
  const manifestVersion = typeof manifest.version === 'string' ? manifest.version : ''
  const version = manifestVersion || pkg.version
  if (manifestVersion && manifestVersion !== pkg.version) {
    log(`⚠️  manifest.version(${manifestVersion}) 与 package.json(${pkg.version}) 不一致，产物按 manifest 版本命名`)
  }

  const result = { files: files.length, version, packageVersion: pkg.version }

  if (only !== 'crx') {
    const zipPath = join(outDir, `${name}-${version}.zip`)
    await writeFile(zipPath, zip)
    result.zipPath = zipPath
    log(`🗜  zip: ${displayPath(zipPath)} (${formatSize(zip.length)})`)
  }

  if (only !== 'zip') {
    const privateKeyPem = await loadOrCreateKey(keyPath, log)
    const { crx, extensionId } = packCrx({ zip, privateKeyPem })
    const crxPath = join(outDir, `${name}-${version}.crx`)
    await writeFile(crxPath, crx)
    result.crxPath = crxPath
    result.extensionId = extensionId
    log(`📦 crx: ${displayPath(crxPath)} (${formatSize(crx.length)})`)
    log(`🆔 扩展 ID: ${extensionId}`)
  }

  return result
}

function printUsage() {
  console.log(`用法: node scripts/pack-extension.mjs [选项]

选项:
  --dist <目录>   构建产物目录，默认 dist
  --out <目录>    输出目录，默认 release
  --key <文件>    签名私钥（PEM），默认 .keys/<包名>.pem，不存在时自动生成
  --name <名称>   产物文件名前缀，默认取 package.json 的 name
  --only <类型>   只打包 zip 或 crx
  --help          查看帮助`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  await packExtension({
    distDir: resolve(PROJECT_ROOT, options.dist),
    outDir: resolve(PROJECT_ROOT, options.out),
    keyPath: options.key ? resolve(PROJECT_ROOT, options.key) : undefined,
    name: options.name || undefined,
    only: options.only,
    log: msg => console.log(msg),
  })
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch(error => {
    console.error(`❌ 打包失败：${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
  })
}
