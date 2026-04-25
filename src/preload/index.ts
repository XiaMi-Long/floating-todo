import { contextBridge, ipcRenderer } from 'electron'
import type { AddTodoPayload, TodoApi, TodoItem, UpdateTodoPayload } from '@shared/todo'

const todoApi: TodoApi = {
  listTodos: () => ipcRenderer.invoke('todos:list'),
  addTodo: (payload: AddTodoPayload) => ipcRenderer.invoke('todos:add', payload),
  updateTodo: (id: string, patch: UpdateTodoPayload) => ipcRenderer.invoke('todos:update', id, patch),
  deleteTodo: (id: string) => ipcRenderer.invoke('todos:delete', id),
  clearCompleted: () => ipcRenderer.invoke('todos:clearCompleted'),
  startWidget: () => ipcRenderer.invoke('window:startWidget'),
  closeCurrentWindow: () => ipcRenderer.invoke('window:closeCurrent'),
  onTodosChanged: (callback: (todos: TodoItem[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, todos: TodoItem[]): void => {
      callback(todos)
    }

    ipcRenderer.on('todos:changed', listener)

    return () => {
      ipcRenderer.removeListener('todos:changed', listener)
    }
  }
}

contextBridge.exposeInMainWorld('todoApi', todoApi)
