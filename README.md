# Floating Todo

一个使用 Electron、Vue 3 和 TypeScript 构建的桌面端 Todo 应用。主窗口用于添加和管理任务，点击 `Start` 后会打开一个小型置顶悬浮 Todo 窗口，方便把待办任务放在桌面任意位置。

## 功能

- 新增任务并设置高/中/低优先级
- 勾选完成、删除任务、清空已完成任务
- 任务数据持久化到本机 Electron `userData` 目录
- `Start` 后主窗口最小化，小型 Todo 悬浮窗置顶展示未完成任务
- 悬浮窗支持拖动，并可直接勾选完成任务

## 开发

```bash
npm install
npm run dev
```

## 检查

```bash
npm run typecheck
```

## Windows 发布

```bash
npm run build:win
```

也可以通过 GitHub Actions 手动触发或推送 `v*.*.*` tag 来构建 Release。
