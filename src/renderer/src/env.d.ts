/// <reference types="vite/client" />

import type { TodoApi } from '@shared/todo'

declare global {
  interface Window {
    todoApi: TodoApi
  }
}
