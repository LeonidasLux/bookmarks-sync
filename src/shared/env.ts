import type { AppConfig } from './types'

/**
 * 从项目根 .env 读取本地开发扩展配置。
 * 仅 development 模式（`pnpm dev`）生效；测试（test 模式）与正式构建（production 模式）返回空对象，
 * 保证 Token 等敏感值不会打进构建产物。
 */
export function devEnvConfig(): Partial<AppConfig> {
  if (import.meta.env.MODE !== 'development') return {}

  const env = import.meta.env
  const nonEmpty = (v: string | undefined): string | undefined => (v?.trim() ? v : undefined)

  const config: Partial<AppConfig> = {}

  const githubToken = nonEmpty(env.VITE_GITHUB_TOKEN)
  const repoOwner = nonEmpty(env.VITE_REPO_OWNER)
  const repoName = nonEmpty(env.VITE_REPO_NAME)
  const syncFileName = nonEmpty(env.VITE_SYNC_FILE_NAME)
  const pullFileName = nonEmpty(env.VITE_PULL_FILE_NAME)
  const cleanEmptyFolders = nonEmpty(env.VITE_CLEAN_EMPTY_FOLDERS)
  const autoSyncInterval = nonEmpty(env.VITE_AUTO_SYNC_INTERVAL)
  // define 只替换字面量成员表达式，这里保持 import.meta.env.X 的直写形式
  const typesafeApiKey = nonEmpty(import.meta.env.VITE_TYPESAFE_API_KEY ?? env.VITE_TYPESAFE_API_KEY)

  if (githubToken) config.githubToken = githubToken
  if (repoOwner) config.repoOwner = repoOwner
  if (repoName) config.repoName = repoName
  if (syncFileName) config.syncFileName = syncFileName
  if (pullFileName) config.pullFileName = pullFileName
  if (cleanEmptyFolders) config.cleanEmptyFolders = cleanEmptyFolders === 'true'
  if (typesafeApiKey) config.typesafeApiKey = typesafeApiKey
  if (autoSyncInterval) {
    const minutes = Number(autoSyncInterval)
    if (!Number.isNaN(minutes)) config.autoSyncInterval = minutes
  }

  return config
}

/**
 * 在 development 模式下用 .env 中的配置覆盖已保存配置（本地开发固定配置优先），
 * 其他模式原样返回。
 */
export function applyDevEnv<T extends AppConfig>(config: T): T {
  return { ...config, ...devEnvConfig() }
}
