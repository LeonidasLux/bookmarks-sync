# Bookmarks Sync

浏览器书签管理器——Chrome/Edge 扩展，以 GitHub 仓库为后端存储和同步个人书签。

## Language

**Bookmark**:
一个浏览器书签条目，包含标题、URL、文件夹、标签和时间戳。
_Avoid_: 收藏夹、链接

**Extension**:
运行在 Chrome/Edge 浏览器中的 Manifest V3 扩展，是用户与书签交互的前端。基于 TypeScript + React + Vite + crxjs 构建。
_Avoid_: 插件、应用

**Sync**:
扩展与 GitHub 仓库之间双向同步书签数据的过程。
_Avoid_: 备份、上传

**Bookmark File**:
远程仓库中书签数据的载体，统一命名为 `bookmarks-[name].json`（`name` 仅限英文，字母开头，可含数字/中划线/下划线，最长 50 字符）。不同浏览器/设备可使用独立文件，互不干扰；旧版单文件格式 `bookmarks.json` 仍受支持。
_Avoid_: 收藏夹文件

**GitHub Backend**:
以 Git 仓库为存储后端的同步机制，扩展通过 GitHub API 读写 `bookmarks-[name].json` 文件。同一仓库可存放多个书签文件。
_Avoid_: 服务器、云存储

**PAT (Personal Access Token)**:
用于扩展访问 GitHub API 的认证凭证，由用户在 GitHub 设置中生成后填入扩展配置。
_Avoid_: 密码、API 密钥

**Sync Strategy**:
推送为**强制覆盖**指定书签文件（远程已有变更将被丢弃，文件不存在时自动新建）；拉取为从指定文件读取后与本地差异对比，**选择性应用**。触发方式为手动：在扩展弹窗中选择目标文件后触发推送/拉取。
_Avoid_: 单向同步

**Default Sync File**:
设置页中配置的推送默认文件（`syncFileName`），推送时自动预选，不在远程列表时以「未推送」标记显示。
_Avoid_: 默认路径

**Manual Sync**:
用户在扩展弹窗中点击推送/拉取按钮，选择远程书签文件后手动触发的同步。
_Avoid_: 刷新

**Folder Suggestion**:
保存书签时由 TypeSafe Jev 模型根据页面标题与链接，在本地**全部**已有目录中选出并推荐的保存目录（目录数 ≤ 255 时一次 Choice，超过则等分分块并行提问后按概率合并）；同时给出置信度与置信度最高的前 3 个备选目录。「其他书签」这类系统目录本身不作为目标（其子目录仍参与推荐）。它仅作为预选项，用户可在保存前手动改选，未配置 API Key 或调用失败时退回手动选择。
_Avoid_: 自动归档、智能分类

## Project Structure

```
bookmarks-sync/
├── src/
│   ├── extension/
│   │   ├── popup/          # 弹窗 UI：书签浏览、文件选择、推送/拉取
│   │   ├── options/        # 设置页：GitHub 配置、默认文件设置
│   │   ├── background/     # Service Worker：消息路由 + GitHub API + Jev 目录推荐
│   │   └── manifest.json
│   └── shared/
│       ├── types.ts        # Bookmark / AppConfig 类型定义
│       ├── sync.ts         # SyncEngine：多书签文件同步核心
│       └── jev.ts          # TypeSafe Jev：目录推荐（Choice + 分层选择）
├── vite.config.ts
├── package.json
└── tsconfig.json
```
