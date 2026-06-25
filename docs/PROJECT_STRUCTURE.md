# Joyly 项目文件结构指南

**目的**: 为 AI agent 提供清晰的项目组织规则，确保新代码遵循现有架构。

---

## 🏗️ 核心架构（4层）

```
src/                  → 平台 + 房间核心代码（React + TypeScript）
  ├── components/    → UI 组件（platform/, player/, ui/)
  ├── pages/         → 页面（platform/, player/)
  ├── stores/        → 状态管理（authStore, roomStore, playerStore）
  ├── hooks/         → 可复用逻辑（useSSE, usePairing 等）
  ├── types/         → 类型定义
  └── styles/        → 全局样式

server/               → 平台 + 房间服务器代码（Node.js）
  ├── platform/      → API 路由（游戏列表、用户信息）
  ├── games/         → 游戏注册表 + 核心玩家管理
  └── players/       → 玩家状态管理

games/                → 游戏包（每个游戏完全自包含）
  ├── cosmic-trivia/
  │   ├── manifest.ts        → 游戏元数据
  │   ├── client/            → 前端代码
  │   │   ├── BigScreenPage.tsx
  │   │   ├── PhonePage.tsx
  │   │   ├── components/
  │   │   ├── hooks/
  │   │   ├── lib/          → 游戏特定工具库
  │   │   └── __tests__/
  │   ├── server/            → 后端逻辑
  │   ├── shared/            → 类型定义
  │   └── assets/            → 音频、图片
  └── werewolf/
      └── [相同结构]

dev-tools/            → 开发工具（不部署到生产）
  ├── voice-library/
  ├── demos/
  ├── scripts/
  ├── tests/
  └── content/

public/               → 静态资源（Vite 直接服务）
  ├── assets/
  ├── games/*/audio/
  └── [其他静态文件]
```

---

## 📋 文件添加规则

### 添加新页面
```
IF 页面属于平台核心（注册、支付等）:
  → src/pages/platform/PageName.tsx
  → imports: src/components/platform/*, src/stores/*, src/types/*

IF 页面属于房间（大厅、配对等）:
  → src/pages/player/PageName.tsx
  → imports: src/components/player/*, src/stores/*, src/hooks/*

IF 页面属于某个游戏:
  → games/{game-name}/client/PageName.tsx
  → imports: 仅 games/{game-name}/* 和 src/types/*, src/components/player/*
```

### 添加新组件
```
IF 组件被多个游戏使用（ConfettiRain, PhoneLayout等）:
  → src/components/{category}/ComponentName.tsx
  → category: ui/, platform/, player/

IF 组件仅被单个游戏使用:
  → games/{game-name}/client/components/ComponentName.tsx
```

### 添加新游戏
```
1. 创建 games/{game-name}/ 目录
2. 创建 manifest.ts:
   {
     id: 'game-name',
     title: '游戏名',
     playerRange: { min: 2, max: 10 },
     serverModule: './server/index.js'
   }
3. 创建子目录: client/, server/, shared/, assets/
4. 实现 client/BigScreenPage.tsx 和 client/PhonePage.tsx
5. 实现 server/index.js（导出 game 对象）
6. 在 server/games/registry.js 中注册
7. 不需要改 src/ 或其他游戏代码
```

---

## 🔌 导入规则（按优先级）

**禁止的导入**（编译会失败或破坏架构）：
```
❌ 游戏导入其他游戏：  import from 'games/another-game'
❌ 游戏改变平台：    import from 'src/pages/platform'
❌ 循环导入：        A → B, B → A
❌ 开发工具导入源代码  import from '../src' (from dev-tools/)
```

**允许的导入**：
```
✓ 平台 → 房间：      src/pages/platform → src/pages/player (共享玩家类型)
✓ 房间 → 游戏：      src/pages/player → games/*/client (InRoomPage → 游戏页面)
✓ 游戏 → 平台类型：  games/* → src/types/room, src/types/player
✓ 游戏 → 共享组件：  games/* → src/components/player, src/components/ui
✓ 所有 → src/types/* (类型定义可被任何地方导入)
```

---

## 🔧 TypeScript 路径别名

```
// vite.config.ts 中定义：
@platform  → src/components/platform
@room      → src/pages/player
@types     → src/types
@ui        → src/components/ui
@stores    → src/stores
@hooks     → src/hooks

// 使用示例：
import { Button } from '@ui/Button'
import { useSSE } from '@hooks/useSSE'
import type { Room } from '@types/room'
```

---

## 🏗️ 构建流程

```
npm run build:
  1. TypeScript 编译（tsc --noEmit 检查）
  2. Vite 编译 src/ + games/*/client/ → build/
  3. 输出: build/index.html, build/assets/*

npm start:
  1. Node.js 启动 server.js
  2. 动态加载 games/*/server/index.js
  3. 若 build/index.html 存在，服务 React 应用
  4. 若不存在，启动 Vite dev server

npm run dev:
  1. 并行运行 server.js 和 vite dev server
```

---

## 📦 .gitignore 规则

```
提交到 git:
  ✓ src/, server/, games/, public/, docs/
  ✓ package.json, vite.config.ts, tsconfig.json
  ✓ 所有源代码

不提交：
  ❌ node_modules/
  ❌ build/  dist/  (构建产物，每次 npm run build 重新生成)
  ❌ dev-tools/  (开发工具、demo、脚本)
  ❌ .design-sync/, .ds-sync/, ds-bundle/  (设计工具产物)
  ❌ *.log, *.sqlite-shm, *.sqlite-wal
```

---

## 🎯 快速参考：文件放在哪里

| 文件类型 | 位置 | 理由 |
|---------|------|------|
| 平台页面 | `src/pages/platform/` | 平台核心 |
| 房间页面 | `src/pages/player/` | 房间核心 |
| 游戏页面 | `games/{game}/client/` | 游戏独立 |
| 跨平台 UI 组件 | `src/components/ui/` | 可复用 |
| 平台特定组件 | `src/components/platform/` | 平台相关 |
| 游戏特定组件 | `games/{game}/client/components/` | 游戏独立 |
| 平台 hook | `src/hooks/` | 可复用 |
| 游戏 hook | `games/{game}/client/hooks/` | 游戏独立 |
| 状态管理 | `src/stores/` | 平台 + 房间共享 |
| 游戏状态 | `games/{game}/client/lib/` | 游戏内部 |
| 类型定义 | `src/types/` | 所有地方都能用 |
| 游戏类型 | `games/{game}/shared/types.ts` | 游戏内部 |
| 平台 API | `server/platform/` | 服务器端点 |
| 游戏逻辑 | `games/{game}/server/` | 游戏独立 |
| 开发工具 | `dev-tools/` | 不部署 |
| 音频资源 | `public/games/{game}/audio/` | 静态服务 |
| 游戏源资源 | `games/{game}/assets/` | 构建时处理 |

---

## ⚡ 黄金规则

1. **游戏包是原子单位** — 一个游戏的改动不影响其他游戏
2. **层级不倒流** — 游戏不导入平台实现，只导入类型
3. **src/types 是公共API** — 任何地方都能导入类型定义
4. **构建产物不提交** — build/, dist/ 在 .gitignore，每次构建重新生成
5. **开发工具隔离** — dev-tools/ 中的代码永不上生产

---

**最后更新**: 2026-06-25
**版本**: 1.0
