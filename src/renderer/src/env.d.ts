/// <reference types="vite/client" />

import type { TodoApi } from '@shared/todo'

// 扩展 Window 类型，声明 preload 暴露的 todoApi
declare global {
  interface Window {
    todoApi: TodoApi
  }
}
