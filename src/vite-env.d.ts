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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
