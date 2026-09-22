import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'

export default defineConfig(({ mode }) => {
  // 本地开发时可复用 shell（如 ~/.zshrc）里的 TYPESAFE_API_KEY，避免把 Key 写进配置文件。
  // 仅 development 模式注入，测试与正式构建不会带上该值。
  const typesafeApiKey = mode === 'development' ? (process.env.TYPESAFE_API_KEY ?? '') : ''

  return {
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5173,
      },
    },
    plugins: [
      react(),
      crx({
        manifest: {
          manifest_version: 3,
          name: '书签远程同步',
          version: '1.3.1',
          description: 'Browser bookmarks sync with GitHub',
          permissions: ['storage', 'bookmarks', 'activeTab', 'favicon', 'history', 'alarms'],
          host_permissions: ['https://api.github.com/*', 'https://api.typesafe.ai/*'],
          action: {
            default_popup: 'src/extension/popup/index.html',
            default_title: 'Bookmarks Sync',
            default_icon: {
              '16': 'icon16.png',
              '32': 'icon32.png',
              '48': 'icon48.png',
              '128': 'icon128.png',
            },
          },
          options_ui: {
            page: 'src/extension/options/index.html',
            open_in_tab: true,
          },
          commands: {
            'save-bookmark': {
              suggested_key: {
                default: 'Alt+B',
                mac: 'Command+Shift+B',
              },
              description: '保存当前页面到书签',
            },
          },
          background: {
            service_worker: 'src/extension/background/service-worker.ts',
            type: 'module',
          },
          icons: {
            '16': 'icon16.png',
            '32': 'icon32.png',
            '48': 'icon48.png',
            '128': 'icon128.png',
          },
        },
      }),
    ],
    // 仅在 development 模式注入 Key，避免进入正式构建产物
    ...(typesafeApiKey
      ? { define: { 'import.meta.env.VITE_TYPESAFE_API_KEY': JSON.stringify(typesafeApiKey) } }
      : {}),
  }
})
