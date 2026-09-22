/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GitHub Personal Access Token（本地开发用，见 .env.example） */
  readonly VITE_GITHUB_TOKEN?: string
  readonly VITE_REPO_OWNER?: string
  readonly VITE_REPO_NAME?: string
  readonly VITE_SYNC_FILE_NAME?: string
  readonly VITE_PULL_FILE_NAME?: string
  readonly VITE_CLEAN_EMPTY_FOLDERS?: string
  readonly VITE_AUTO_SYNC_INTERVAL?: string
  /** TypeSafe Jev API Key（本地开发用；由 vite.config.ts 从 TYPESAFE_API_KEY 注入） */
  readonly VITE_TYPESAFE_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
