import { contextBridge, ipcRenderer } from 'electron'
import type { AddTodoPayload, TodoApi, TodoItem, UpdateTodoPayload } from '@shared/todo'

// 通过 contextBridge 向渲染进程暴露的 API 实现
const todoApi: TodoApi = {
  // 获取所有任务列表
  listTodos: () => ipcRenderer.invoke('todos:list'),

  // 新增任务
  addTodo: (payload: AddTodoPayload) => ipcRenderer.invoke('todos:add', payload),

  // 更新任务字段
  updateTodo: (id: string, patch: UpdateTodoPayload) => ipcRenderer.invoke('todos:update', id, patch),

  // 删除指定任务
  deleteTodo: (id: string) => ipcRenderer.invoke('todos:delete', id),

  // 清空所有已完成任务
  clearCompleted: () => ipcRenderer.invoke('todos:clearCompleted'),

  // 启动悬浮窗并最小化主窗口
  startWidget: () => ipcRenderer.invoke('window:startWidget'),

  // 关闭当前所在窗口
  closeCurrentWindow: () => ipcRenderer.invoke('window:closeCurrent'),

  // 注册任务变更监听，返回取消监听的函数
  onTodosChanged: (callback: (todos: TodoItem[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, todos: TodoItem[]): void => {
      callback(todos)
    }

    ipcRenderer.on('todos:changed', listener)

    // 返回取消订阅函数，供 Vue 组件 onUnmounted 时调用
    return () => {
      ipcRenderer.removeListener('todos:changed', listener)
    }
  }
}

contextBridge.exposeInMainWorld('todoApi', todoApi)
