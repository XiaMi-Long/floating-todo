import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import type { AddTodoPayload, UpdateTodoPayload } from '@shared/todo'
import { TodoStore } from './todo-store'

// 主应用窗口实例
let mainWindow: BrowserWindow | null = null
// 置顶悬浮窗实例
let widgetWindow: BrowserWindow | null = null
// 任务数据仓库实例（在 app.whenReady 中初始化）
let todoStore: TodoStore | null = null

/**
 * 获取 preload 文件路径。
 * @changeLog
 * - Created
 * @returns preload 输出文件路径
 */
function getPreloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

/**
 * 加载渲染页面。
 * @param window - 目标窗口
 * @param hash - 页面 hash
 * @changeLog
 * - Created
 * @returns 无返回值
 */
function loadRenderer(window: BrowserWindow, hash = 'main'): void {
  // 开发环境使用 Vite dev server URL
  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`)

    return
  }

  // 生产环境加载打包后的静态文件
  window.loadFile(join(__dirname, '../renderer/index.html'), { hash })
}

/**
 * 创建主应用窗口。
 * @changeLog
 * - Created
 * @returns 主窗口实例
 */
function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 740,
    height: 520,
    minWidth: 560,
    minHeight: 420,
    title: 'Floating Todo',
    autoHideMenuBar: true,
    backgroundColor: '#f2f2f7',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  loadRenderer(mainWindow)

  return mainWindow
}

/**
 * 创建置顶悬浮任务窗口。
 * @changeLog
 * - Created
 * @returns 悬浮窗口实例
 */
function createWidgetWindow(): BrowserWindow {
  // 如果悬浮窗已存在且未销毁，直接复用
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.show()
    widgetWindow.focus()

    return widgetWindow
  }

  widgetWindow = new BrowserWindow({
    width: 300,
    height: 400,
    minWidth: 260,
    minHeight: 300,
    title: 'Floating Todo Widget',
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  widgetWindow.setAlwaysOnTop(true, 'floating')

  widgetWindow.on('closed', () => {
    widgetWindow = null
  })

  loadRenderer(widgetWindow, 'widget')

  return widgetWindow
}

/**
 * 获取已初始化的任务仓库。
 * @changeLog
 * - Created
 * @returns 任务仓库实例
 */
function getTodoStore(): TodoStore {
  if (!todoStore) {
    throw new Error('Todo 数据仓库尚未初始化')
  }

  return todoStore
}

/**
 * 广播最新任务列表到所有窗口。
 * @changeLog
 * - Created
 * @returns 无返回值
 */
function broadcastTodos(): void {
  const todos = getTodoStore().getTodos()

  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.webContents.isDestroyed()) {
      window.webContents.send('todos:changed', todos)
    }
  })
}

/**
 * 注册 Todo 和窗口控制 IPC。
 * @changeLog
 * - Created
 * @returns 无返回值
 */
function registerIpcHandlers(): void {
  ipcMain.handle('todos:list', () => getTodoStore().getTodos())

  ipcMain.handle('todos:add', (_event, payload: AddTodoPayload) => {
    const todo = getTodoStore().addTodo(payload)

    broadcastTodos()

    return todo
  })

  ipcMain.handle('todos:update', (_event, id: string, patch: UpdateTodoPayload) => {
    const todos = getTodoStore().updateTodo(id, patch)

    broadcastTodos()

    return todos
  })

  ipcMain.handle('todos:delete', (_event, id: string) => {
    const todos = getTodoStore().deleteTodo(id)

    broadcastTodos()

    return todos
  })

  ipcMain.handle('todos:clearCompleted', () => {
    const todos = getTodoStore().clearCompleted()

    broadcastTodos()

    return todos
  })

  ipcMain.handle('window:startWidget', () => {
    createWidgetWindow()

    // 悬浮窗打开后最小化主窗口
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize()
    }
  })

  ipcMain.handle('window:closeCurrent', (event) => {
    // 根据发送 IPC 的 webContents 定位到对应窗口并关闭
    const window = BrowserWindow.fromWebContents(event.sender)

    window?.close()
  })
}

app.whenReady().then(() => {
  todoStore = new TodoStore(join(app.getPath('userData'), 'todos.json'))
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
