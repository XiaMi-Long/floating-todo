<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { TodoItem, TodoPriority } from '@shared/todo'

const PRIORITY_META: Record<TodoPriority, { label: string; weight: number }> = {
  high: { label: '高', weight: 3 },
  medium: { label: '中', weight: 2 },
  low: { label: '低', weight: 1 }
}

const todos = ref<TodoItem[]>([])
const newTitle = ref('')
const selectedPriority = ref<TodoPriority>('medium')
const errorMessage = ref('')
const isWidget = ref(window.location.hash.includes('widget'))

const activeTodos = computed(() => sortTodos(todos.value.filter((todo) => !todo.completed)))
const completedTodos = computed(() =>
  todos.value
    .filter((todo) => todo.completed)
    .sort((left, right) => Date.parse(right.completedAt ?? right.createdAt) - Date.parse(left.completedAt ?? left.createdAt))
)
const completedCount = computed(() => completedTodos.value.length)
const canClearCompleted = computed(() => completedCount.value > 0)

let removeTodosChangedListener: (() => void) | undefined

/**
 * 同步当前窗口类型。
 * @changeLog
 * - Created
 * @returns 无返回值
 */
function syncWindowMode(): void {
  isWidget.value = window.location.hash.includes('widget')
}

/**
 * 加载本地任务列表。
 * @changeLog
 * - Created
 * @returns 无返回值
 */
async function loadTodos(): Promise<void> {
  todos.value = await window.todoApi.listTodos()
}

/**
 * 新增任务。
 * @changeLog
 * - Created
 * @returns 无返回值
 */
async function addTodo(): Promise<void> {
  const title = newTitle.value.trim()

  if (!title) {
    errorMessage.value = '先写下一个任务吧'

    return
  }

  try {
    await window.todoApi.addTodo({
      title,
      priority: selectedPriority.value
    })

    newTitle.value = ''
    selectedPriority.value = 'medium'
    errorMessage.value = ''
    await loadTodos()
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  }
}

/**
 * 切换任务完成状态。
 * @param todo - 当前任务
 * @changeLog
 * - Created
 * @returns 无返回值
 */
async function toggleTodo(todo: TodoItem): Promise<void> {
  try {
    todos.value = await window.todoApi.updateTodo(todo.id, {
      completed: !todo.completed
    })
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  }
}

/**
 * 删除任务。
 * @param todo - 当前任务
 * @changeLog
 * - Created
 * @returns 无返回值
 */
async function deleteTodo(todo: TodoItem): Promise<void> {
  try {
    todos.value = await window.todoApi.deleteTodo(todo.id)
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  }
}

/**
 * 清空已完成任务。
 * @changeLog
 * - Created
 * @returns 无返回值
 */
async function clearCompleted(): Promise<void> {
  if (!canClearCompleted.value) return

  try {
    todos.value = await window.todoApi.clearCompleted()
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  }
}

/**
 * 打开置顶悬浮窗并最小化主窗口。
 * @changeLog
 * - Created
 * @returns 无返回值
 */
async function startWidget(): Promise<void> {
  try {
    await window.todoApi.startWidget()
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  }
}

/**
 * 关闭当前悬浮窗。
 * @changeLog
 * - Created
 * @returns 无返回值
 */
async function closeCurrentWindow(): Promise<void> {
  await window.todoApi.closeCurrentWindow()
}

/**
 * 获取优先级中文标签。
 * @param priority - 任务优先级
 * @changeLog
 * - Created
 * @returns 中文标签
 */
function getPriorityLabel(priority: TodoPriority): string {
  return PRIORITY_META[priority].label
}

/**
 * 格式化任务创建时间。
 * @param value - ISO 时间字符串
 * @changeLog
 * - Created
 * @returns 适合界面展示的时间
 */
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

/**
 * 按优先级和创建时间排序任务。
 * @param list - 待排序任务列表
 * @changeLog
 * - Created
 * @returns 排序后的任务列表
 */
function sortTodos(list: TodoItem[]): TodoItem[] {
  return [...list].sort((left, right) => {
    const priorityDiff = PRIORITY_META[right.priority].weight - PRIORITY_META[left.priority].weight

    if (priorityDiff !== 0) return priorityDiff

    return Date.parse(right.createdAt) - Date.parse(left.createdAt)
  })
}

/**
 * 读取错误信息。
 * @param error - 未知错误
 * @changeLog
 * - Created
 * @returns 可展示错误文本
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后再试'
}

onMounted(() => {
  loadTodos()

  removeTodosChangedListener = window.todoApi.onTodosChanged((nextTodos) => {
    todos.value = nextTodos
  })

  window.addEventListener('hashchange', syncWindowMode)
})

onUnmounted(() => {
  removeTodosChangedListener?.()
  window.removeEventListener('hashchange', syncWindowMode)
})
</script>

<template>
  <section
    v-if="isWidget"
    class="widget-shell"
  >
    <header class="widget-header drag-region">
      <div>
        <p class="eyebrow">Floating Todo</p>
        <h1>{{ activeTodos.length }} 个待办</h1>
      </div>
      <button
        class="icon-button no-drag"
        aria-label="关闭悬浮窗"
        type="button"
        @click="closeCurrentWindow"
      >
        ×
      </button>
    </header>

    <main class="widget-list no-drag">
      <article
        v-if="activeTodos.length === 0"
        class="empty-card"
      >
        <strong>今天很清爽</strong>
        <span>没有未完成任务。</span>
      </article>

      <button
        v-for="todo in activeTodos"
        :key="todo.id"
        class="widget-todo"
        type="button"
        @click="toggleTodo(todo)"
      >
        <span :class="['priority-dot', `priority-${todo.priority}`]"></span>
        <span class="widget-todo-title">{{ todo.title }}</span>
        <span class="widget-check">完成</span>
      </button>
    </main>
  </section>

  <main
    v-else
    class="app-shell"
  >
    <header class="top-bar">
      <span class="top-bar-title">Floating Todo</span>
      <button
        class="launch-button"
        type="button"
        @click="startWidget"
      >
        启动悬浮窗
      </button>
    </header>

    <form
      class="composer-card"
      @submit.prevent="addTodo"
    >
      <label
        class="sr-only"
        for="todo-title"
      >
        任务内容
      </label>
      <input
        id="todo-title"
        v-model="newTitle"
        maxlength="120"
        placeholder="输入一个任务，例如：整理 Electron 发布流程"
        autocomplete="off"
      />

      <label
        class="sr-only"
        for="todo-priority"
      >
        优先级
      </label>
      <select
        id="todo-priority"
        v-model="selectedPriority"
      >
        <option value="high">高优先级</option>
        <option value="medium">中优先级</option>
        <option value="low">低优先级</option>
      </select>

      <button type="submit">添加任务</button>
    </form>

    <p
      v-if="errorMessage"
      class="error-message"
    >
      {{ errorMessage }}
    </p>

    <section class="dashboard-grid">
      <section class="task-panel">
        <header class="panel-header">
          <div>
            <p class="eyebrow">未完成</p>
            <h2>{{ activeTodos.length }} 个任务</h2>
          </div>
        </header>

        <article
          v-if="activeTodos.length === 0"
          class="empty-card"
        >
          <strong>没有待办任务</strong>
          <span>添加一个任务，再点击「启动悬浮窗」打开悬浮窗。</span>
        </article>

        <ul
          v-else
          class="task-list"
        >
          <li
            v-for="todo in activeTodos"
            :key="todo.id"
            class="task-item"
          >
            <button
              class="check-button"
              type="button"
              aria-label="标记完成"
              @click="toggleTodo(todo)"
            ></button>

            <div class="task-content">
              <strong>{{ todo.title }}</strong>
              <span>{{ formatDate(todo.createdAt) }}</span>
            </div>

            <span :class="['priority-badge', `priority-${todo.priority}`]">
              {{ getPriorityLabel(todo.priority) }}
            </span>

            <button
              class="ghost-button"
              type="button"
              @click="deleteTodo(todo)"
            >
              删除
            </button>
          </li>
        </ul>
      </section>

      <section class="task-panel muted-panel">
        <header class="panel-header">
          <div>
            <p class="eyebrow">已完成</p>
            <h2>{{ completedCount }} 个任务</h2>
          </div>

          <button
            class="ghost-button"
            type="button"
            :disabled="!canClearCompleted"
            @click="clearCompleted"
          >
            清空
          </button>
        </header>

        <article
          v-if="completedTodos.length === 0"
          class="empty-card"
        >
          <strong>完成的任务会出现在这里</strong>
          <span>悬浮窗中勾选完成后也会同步到主窗口。</span>
        </article>

        <ul
          v-else
          class="task-list completed-list"
        >
          <li
            v-for="todo in completedTodos"
            :key="todo.id"
            class="task-item completed"
          >
            <button
              class="check-button checked"
              type="button"
              aria-label="恢复为未完成"
              @click="toggleTodo(todo)"
            >
              ✓
            </button>

            <div class="task-content">
              <strong>{{ todo.title }}</strong>
              <span>{{ formatDate(todo.completedAt ?? todo.createdAt) }}</span>
            </div>

            <button
              class="ghost-button"
              type="button"
              @click="deleteTodo(todo)"
            >
              删除
            </button>
          </li>
        </ul>
      </section>
    </section>
  </main>
</template>
