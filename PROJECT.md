# Floating Todo — 项目全面介绍

## 一、项目概述

Floating Todo 是一个基于 **Electron + Vue 3 + TypeScript** 的桌面任务管理工具。核心功能是：在主窗口中管理任务列表，点击按钮后生成一个**置顶悬浮窗**，将未完成任务始终悬浮在桌面最上层，方便随时查看和完成。

---

## 二、文件目录结构

```
floating-todo/
├── package.json                  # 项目元数据、依赖、构建脚本
├── electron.vite.config.ts       # electron-vite 构建配置
├── tsconfig.json                 # TypeScript 编译配置
├── CLAUDE.md                     # AI 辅助编码规则
│
├── src/
│   ├── shared/                   # 【共享层】类型定义，主进程 & 渲染进程共用
│   │   └── todo.ts               # TodoItem / TodoApi 类型、优先级校验
│   │
│   ├── main/                     # 【主进程】Node.js 环境，文件 I/O + 窗口管理
│   │   ├── index.ts              # 入口：创建窗口、注册 IPC、广播数据变更
│   │   └── todo-store.ts         # 数据仓库：JSON 文件的读写与 CRUD
│   │
│   ├── preload/                  # 【预加载层】安全桥接主进程与渲染进程
│   │   └── index.ts              # contextBridge 暴露 window.todoApi
│   │
│   └── renderer/                 # 【渲染进程】Vue 3 SPA，纯前端 UI
│       ├── index.html            # HTML 壳（单 div + 模块脚本入口）
│       └── src/
│           ├── main.ts           # Vue 应用入口
│           ├── App.vue           # 唯一组件，包含全部 UI（主窗口 + 悬浮窗）
│           ├── styles.css        # 全部样式（488 行 → 精简后约 380 行）
│           └── env.d.ts          # Window.todoApi 类型声明
│
└── .github/                      # GitHub Actions CI/CD 配置
```

### 目录设计原则

项目采用 Electron 经典的 **三层架构**：

```
主进程 (main)  ←→  预加载 (preload)  ←→  渲染进程 (renderer)
  Node.js              contextBridge           Vue 3 浏览器环境
  文件 I/O             安全暴露 API            UI 交互
  窗口管理
```

`shared/` 目录提供跨层共享的类型定义，确保所有层使用同一份 TypeScript 类型合约。

---

## 三、核心逻辑

### 3.1 主进程（`src/main/index.ts`）

**职责：** 窗口生命周期管理 + IPC 请求路由 + 数据变更广播。

#### 双窗口模式

| 窗口 | 尺寸 | 特征 |
|---|---|---|
| **主窗口** | 740×520 | 标准窗口，有标题栏，可最小化到任务栏 |
| **悬浮窗** | 300×400 | 无边框、透明背景、始终置顶（`alwaysOnTop: 'floating'`）、不在任务栏显示 |

两个窗口加载**同一份 HTML**（`src/renderer/index.html`），通过 URL hash 区分：
- `#main`（或无 hash）→ 渲染主窗口 UI
- `#widget` → 渲染悬浮窗 UI

#### IPC 通道一览

| 通道 | 方向 | 功能 |
|---|---|---|
| `todos:list` | 渲染 → 主 | 获取全部任务 |
| `todos:add` | 渲染 → 主 | 新增任务 |
| `todos:update` | 渲染 → 主 | 更新任务字段（标题/优先级/完成状态） |
| `todos:delete` | 渲染 → 主 | 删除指定任务 |
| `todos:clearCompleted` | 渲染 → 主 | 清空所有已完成任务 |
| `window:startWidget` | 渲染 → 主 | 打开悬浮窗 + 最小化主窗口 |
| `window:closeCurrent` | 渲染 → 主 | 关闭发送请求的窗口 |
| `todos:changed` | 主 → 渲染（广播） | 数据变更后推送到所有窗口 |

### 3.2 数据仓库（`src/main/todo-store.ts`）

**职责：** 任务数据的持久化存储，封装所有 CRUD 操作。

- **存储方式：** 同步读写 JSON 文件（`readFileSync` / `writeFileSync`）
- **存储位置：** `{Electron userData 目录}/todos.json`
- **数据量假设：** 个人任务列表通常在百条以内，同步 I/O 不会阻塞，且避免引入数据库依赖
- **容错策略：**
  - 文件不存在 → 返回空数组
  - JSON 解析失败 → 返回空数组
  - 历史数据中非法优先级 → 回退为 `medium`
  - 历史数据格式校验 → 通过 `isStoredTodo` 类型守卫过滤

### 3.3 预加载脚本（`src/preload/index.ts`）

**职责：** 使用 `contextBridge.exposeInMainWorld` 安全地在渲染进程的 `window` 对象上暴露 `todoApi`。

**安全设计：**
- `contextIsolation: true` — 渲染进程无法直接访问 Node.js API
- `nodeIntegration: false` — 渲染进程不加载 Node 模块
- 所有主进程通信通过 `ipcRenderer.invoke`（异步 Promise 模式）
- 数据同步通过 `ipcRenderer.on` 监听广播

### 3.4 渲染进程（`src/renderer/src/App.vue`）

**职责：** 全部 UI 交互，单一 Vue 3 组件通过 URL hash 切换两种视图。

**视图切换逻辑：**
```ts
const isWidget = ref(window.location.hash.includes('widget'))
```

- `isWidget = true` → 渲染悬浮窗视图（紧凑任务列表）
- `isWidget = false` → 渲染主窗口视图（顶栏 + 输入表单 + 双栏面板）

**响应式数据流：**
```
todos (ref)  →  activeTodos (computed)  →  模板渲染
             →  completedTodos (computed)
             →  completedCount (computed)
             →  canClearCompleted (computed)
```

---

## 四、实现方式

### 4.1 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 28+ |
| 前端框架 | Vue 3（Composition API + `<script setup>`） |
| 构建工具 | electron-vite（Vite 7） |
| 类型系统 | TypeScript 5（strict 模式） |
| 样式方案 | 纯 CSS（CSS 自定义属性 + 毛玻璃效果） |
| 打包工具 | electron-builder（NSIS Windows 安装包） |

### 4.2 双窗口同一组件方案

不创建两套独立页面，而是利用 **URL hash** 在同一组件内做条件渲染：

```
index.html#main    →  App.vue 渲染主窗口 UI
index.html#widget  →  App.vue 渲染悬浮窗 UI
```

优点：
- 共享全部状态逻辑，无需重复代码
- 两个窗口可接收同一份 `todos:changed` 广播，天然保持数据同步

### 4.3 数据同步机制

采用 **推模式（Push）** — 任何窗口修改数据后，主进程立即广播到所有窗口：

```
渲染进程 A（主窗口）
  ↓ ipcRenderer.invoke('todos:add', payload)
主进程
  ↓ todoStore.addTodo(payload) → 写文件
  ↓ broadcastTodos()
  ↓ webContents.send('todos:changed', todos)
渲染进程 A + 渲染进程 B（悬浮窗）
  ↓ onTodosChanged 回调
  ↓ todos.value = nextTodos
  ↓ Vue 响应式系统自动更新 DOM
```

### 4.4 悬浮窗特殊处理

- **无边框（`frame: false`）：** 窗口没有系统标题栏
- **透明背景（`transparent: true`）：** 圆角卡片视觉，CSS 负责绘制边框和背景
- **拖拽区域（`-webkit-app-region: drag`）：** 悬浮窗头部可拖拽移动
- **交互区域（`no-drag`）：** 按钮和列表区域排除拖拽行为
- **始终置顶（`alwaysOnTop: 'floating'`）：** 悬浮在所有窗口之上
- **跳过任务栏（`skipTaskbar: true`）：** 不在任务栏显示图标

---

## 五、逻辑链

### 5.1 应用启动流程

```
1. Electron app.whenReady()
2. todoStore = new TodoStore(path)    → 读取或创建 todos.json
3. registerIpcHandlers()             → 注册所有 IPC 通道
4. createMainWindow()                → 创建主窗口 740×520，加载 #main
5. 用户看到主窗口界面
```

### 5.2 添加任务流程

```
用户输入标题 + 选择优先级 → 点击「添加任务」
  ↓
App.vue: addTodo()
  ↓ 校验标题非空
  ↓ window.todoApi.addTodo(payload)
preload: ipcRenderer.invoke('todos:add', payload)
  ↓
主进程: todoStore.addTodo(payload)
  ↓ normalizeTitle() → 裁剪空白 + 限长 120 字符
  ↓ 构建 TodoItem（UUID + 时间戳 + 优先级回退）
  ↓ 写入文件
  ↓ broadcastTodos()
  ↓
所有窗口收到 todos:changed → todos.value 更新 → DOM 自动刷新
```

### 5.3 启动悬浮窗流程

```
用户点击「启动悬浮窗」
  ↓
App.vue: startWidget()
  ↓ window.todoApi.startWidget()
preload: ipcRenderer.invoke('window:startWidget')
  ↓
主进程: createWidgetWindow()
  ↓ 检查悬浮窗是否已存在（复用）
  ↓ 创建悬浮窗 300×400，加载 #widget
  ↓ mainWindow.minimize()
  ↓
主窗口最小化，悬浮窗置顶显示
```

### 5.4 跨窗口同步流程

```
悬浮窗中点击任务 → 标记完成
  ↓
App.vue: toggleTodo(todo)
  ↓ window.todoApi.updateTodo(id, { completed: true })
  ↓
主进程: todoStore.updateTodo()
  ↓ 设置 completedAt = 当前时间
  ↓ 写入文件
  ↓ broadcastTodos()
  ↓
主窗口 + 悬浮窗 同时收到更新
  ↓
主窗口「已完成」面板出现该任务
悬浮窗列表中该任务消失
```

---

## 六、操作链

### 6.1 用户操作 → 系统响应对照表

| 用户操作 | 触发位置 | IPC 调用 | 主进程动作 | UI 结果 |
|---|---|---|---|---|
| 输入任务并提交 | 主窗口输入表单 | `todos:add` | 写文件 + 广播 | 未完成列表新增一条 |
| 点击任务左侧圆圈 | 主窗口未完成列表 | `todos:update` | 写文件 + 广播 | 任务移到已完成列表 |
| 点击已完成任务的 ✓ | 主窗口已完成列表 | `todos:update` | 写文件 + 广播 | 任务恢复到未完成列表 |
| 点击「删除」 | 主窗口任务项 | `todos:delete` | 写文件 + 广播 | 任务从列表中移除 |
| 点击「清空」 | 主窗口已完成面板 | `todos:clearCompleted` | 写文件 + 广播 | 全部已完成任务移除 |
| 点击「启动悬浮窗」 | 主窗口顶栏 | `window:startWidget` | 创建/显示悬浮窗 + 最小化主窗口 | 悬浮窗出现 |
| 点击悬浮窗任务 | 悬浮窗列表 | `todos:update` | 写文件 + 广播 | 任务标记完成，两窗口同步 |
| 点击 × 按钮 | 悬浮窗头部 | `window:closeCurrent` | 关闭悬浮窗 | 悬浮窗消失 |
| 从任务栏恢复主窗口 | 任务栏图标 | 无 | 系统级窗口恢复 | 主窗口显示，数据已是最新 |

### 6.2 典型用户场景

**场景：开始一天的工作**
1. 打开应用 → 看到主窗口
2. 输入今日待办任务（如"整理 Electron 发布流程"）
3. 点击「启动悬浮窗」→ 主窗口最小化，悬浮窗出现在桌面
4. 工作时随时看到悬浮窗中的任务列表
5. 完成一项 → 点击该项 → 自动从悬浮窗消失，主窗口同步更新
6. 需要添加新任务 → 从任务栏恢复主窗口 → 添加 → 再次启动悬浮窗

---

## 七、本地存储

### 7.1 存储位置

```
Windows:  %APPDATA%/floating-todo/todos.json
macOS:    ~/Library/Application Support/floating-todo/todos.json
Linux:    ~/.config/floating-todo/todos.json
```

由 Electron 的 `app.getPath('userData')` 自动决定路径。

### 7.2 数据格式

```json
[
  {
    "id": "a1b2c3d4-...",
    "title": "整理 Electron 发布流程",
    "priority": "high",
    "completed": false,
    "createdAt": "2026-04-30T08:15:00.000Z"
  },
  {
    "id": "e5f6g7h8-...",
    "title": "更新项目文档",
    "priority": "medium",
    "completed": true,
    "createdAt": "2026-04-30T07:30:00.000Z",
    "completedAt": "2026-04-30T09:00:00.000Z"
  }
]
```

### 7.3 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | UUID v4，创建时由 `crypto.randomUUID()` 生成 |
| `title` | `string` | 任务标题，存储时自动 trim 并截断到 120 字符 |
| `priority` | `'high' \| 'medium' \| 'low'` | 优先级，非法值自动回退为 `medium` |
| `completed` | `boolean` | 是否已完成 |
| `createdAt` | `string` | ISO 8601 创建时间戳 |
| `completedAt` | `string?` | ISO 8601 完成时间戳，仅已完成任务有此字段 |

### 7.4 读写策略

- **读取：** 应用启动时一次性读取全部数据到内存（`this.todos` 数组）
- **写入：** 每次 CRUD 操作后**全量覆写**文件（`JSON.stringify` + `writeFileSync`）
- **格式化：** 写入时带 2 空格缩进，末尾换行，方便手动查看和编辑
- **目录创建：** 写入前自动递归创建父目录（`mkdirSync({ recursive: true })`）
- **线程安全：** Electron 主进程为单线程模型，同步 I/O 不存在竞态条件
- **多窗口安全：** 所有数据修改都经过主进程的 TodoStore，不存在多个渲染进程直接写文件的问题

### 7.5 容错机制

| 异常情况 | 处理方式 |
|---|---|
| 文件不存在（首次启动） | 返回空数组 `[]` |
| JSON 解析失败（文件损坏） | catch 后返回空数组 `[]` |
| 数据不是数组 | 返回空数组 `[]` |
| 数组元素格式不符合 TodoItem | `isStoredTodo` 类型守卫过滤掉 |
| 标题为空字符串 | `normalizeTitle` 返回空串 → `addTodo` 抛出错误 |
| 优先级为非法值 | 读取时回退为 `medium`；新增时回退为 `medium` |
