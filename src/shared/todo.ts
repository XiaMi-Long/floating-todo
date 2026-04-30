// 支持的优先级常量列表
export const TODO_PRIORITIES = ['high', 'medium', 'low'] as const

// 任务优先级联合类型
export type TodoPriority = (typeof TODO_PRIORITIES)[number]

// 单条任务数据结构
export interface TodoItem {
  id: string
  title: string
  priority: TodoPriority
  completed: boolean
  createdAt: string
  completedAt?: string
}

// 新增任务的请求参数
export interface AddTodoPayload {
  title: string
  priority: TodoPriority
}

// 更新任务的可选字段
export type UpdateTodoPayload = Partial<Pick<TodoItem, 'title' | 'priority' | 'completed'>>

// 渲染进程与主进程之间的 API 契约
export interface TodoApi {
  listTodos: () => Promise<TodoItem[]>
  addTodo: (payload: AddTodoPayload) => Promise<TodoItem>
  updateTodo: (id: string, patch: UpdateTodoPayload) => Promise<TodoItem[]>
  deleteTodo: (id: string) => Promise<TodoItem[]>
  clearCompleted: () => Promise<TodoItem[]>
  startWidget: () => Promise<void>
  closeCurrentWindow: () => Promise<void>
  onTodosChanged: (callback: (todos: TodoItem[]) => void) => () => void
}

/**
 * 判断输入是否为合法优先级。
 * @param value - 需要判断的输入值
 * @changeLog
 * - Created
 * @returns 输入是否属于 TodoPriority
 */
export function isTodoPriority(value: unknown): value is TodoPriority {
  return TODO_PRIORITIES.includes(value as TodoPriority)
}
