import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AddTodoPayload, TodoItem, UpdateTodoPayload } from '@shared/todo'
import { isTodoPriority } from '@shared/todo'

// 任务标题最大字符数
const MAX_TITLE_LENGTH = 120

/**
 * 持久化管理本地 Todo 数据。
 * @reasoning 数据量很小，使用同步文件读写可以保持主进程逻辑简单，同时避免引入数据库依赖。
 * @changeLog
 * - Created
 * @returns TodoStore 实例
 */
export class TodoStore {
  private todos: TodoItem[]

  constructor(private readonly filePath: string) {
    this.todos = this.readTodos()
  }

  /**
   * 获取当前所有任务。
   * @changeLog
   * - Created
   * @returns 任务列表副本
   */
  getTodos(): TodoItem[] {
    return this.todos.map((todo) => ({ ...todo }))
  }

  /**
   * 新增任务。
   * @param payload - 任务标题和优先级
   * @changeLog
   * - Created
   * @returns 新创建的任务
   */
  addTodo(payload: AddTodoPayload): TodoItem {
    const title = normalizeTitle(payload.title)

    // 标题为空时拒绝创建
    if (!title) {
      throw new Error('任务内容不能为空')
    }

    const todo: TodoItem = {
      id: randomUUID(),
      title,
      // 非法优先级自动回退为 medium
      priority: isTodoPriority(payload.priority) ? payload.priority : 'medium',
      completed: false,
      createdAt: new Date().toISOString()
    }

    // 新任务插入到列表最前
    this.todos = [todo, ...this.todos]
    this.saveTodos()

    return { ...todo }
  }

  /**
   * 更新任务字段。
   * @param id - 任务 ID
   * @param patch - 需要更新的字段
   * @changeLog
   * - Created
   * @returns 更新后的完整任务列表
   */
  updateTodo(id: string, patch: UpdateTodoPayload): TodoItem[] {
    let found = false

    this.todos = this.todos.map((todo) => {
      // 非目标任务原样返回
      if (todo.id !== id) return todo

      found = true
      const nextTodo: TodoItem = { ...todo }

      // 更新标题（如果提供）
      if (typeof patch.title === 'string') {
        const title = normalizeTitle(patch.title)

        if (!title) {
          throw new Error('任务内容不能为空')
        }

        nextTodo.title = title
      }

      // 更新优先级（如果合法）
      if (isTodoPriority(patch.priority)) {
        nextTodo.priority = patch.priority
      }

      // 切换完成状态
      if (typeof patch.completed === 'boolean' && patch.completed !== todo.completed) {
        nextTodo.completed = patch.completed

        // 标记完成时记录时间，取消完成时清除时间戳
        if (patch.completed) {
          nextTodo.completedAt = new Date().toISOString()
        } else {
          delete nextTodo.completedAt
        }
      }

      return nextTodo
    })

    if (!found) {
      throw new Error('任务不存在')
    }

    this.saveTodos()

    return this.getTodos()
  }

  /**
   * 删除任务。
   * @param id - 任务 ID
   * @changeLog
   * - Created
   * @returns 删除后的完整任务列表
   */
  deleteTodo(id: string): TodoItem[] {
    this.todos = this.todos.filter((todo) => todo.id !== id)
    this.saveTodos()

    return this.getTodos()
  }

  /**
   * 清空已完成任务。
   * @changeLog
   * - Created
   * @returns 清空后的完整任务列表
   */
  clearCompleted(): TodoItem[] {
    this.todos = this.todos.filter((todo) => !todo.completed)
    this.saveTodos()

    return this.getTodos()
  }

  /**
   * 从本地文件读取任务。
   * @changeLog
   * - Created
   * @returns 可用任务列表
   */
  private readTodos(): TodoItem[] {
    // 文件不存在时返回空列表
    if (!existsSync(this.filePath)) return []

    try {
      const fileContent = readFileSync(this.filePath, 'utf-8')
      const parsedData: unknown = JSON.parse(fileContent)

      // 数据格式不正确时返回空列表
      if (!Array.isArray(parsedData)) return []

      // 过滤并规范化历史数据
      return parsedData.filter(isStoredTodo).map((todo) => ({
        ...todo,
        title: normalizeTitle(todo.title),
        // 非法优先级回退为 medium
        priority: isTodoPriority(todo.priority) ? todo.priority : 'medium'
      }))
    } catch {
      // JSON 解析失败时返回空列表
      return []
    }
  }

  /**
   * 写入任务文件。
   * @changeLog
   * - Created
   * @returns 无返回值
   */
  private saveTodos(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, `${JSON.stringify(this.todos, null, 2)}\n`, 'utf-8')
  }
}

/**
 * 规范化任务标题。
 * @param title - 原始任务标题
 * @changeLog
 * - Created
 * @returns 清理后的任务标题
 */
function normalizeTitle(title: string): string {
  return title.trim().slice(0, MAX_TITLE_LENGTH)
}

/**
 * 判断持久化数据是否像一个 TodoItem。
 * @param value - 待判断的数据
 * @changeLog
 * - Created
 * @returns 是否可作为任务读取
 */
function isStoredTodo(value: unknown): value is TodoItem {
  if (!value || typeof value !== 'object') return false

  const todo = value as TodoItem

  return (
    typeof todo.id === 'string' &&
    typeof todo.title === 'string' &&
    typeof todo.completed === 'boolean' &&
    typeof todo.createdAt === 'string'
  )
}
