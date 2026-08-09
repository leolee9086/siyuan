export type TaskQueueItemStatus = 'passed' | 'warning' | 'failed' | 'blocked' | 'cancelled'

export interface TaskQueueItem<Result> {
  id: string
  estimatedBytes: number
  dependsOn?: string[]
  run(signal?: AbortSignal): Promise<{ status?: 'pass' | 'warning'; result: Result }>
}

export interface TaskQueueEvent<Result> {
  type: 'started' | 'completed'
  id: string
  index: number
  activeCount: number
  activeBytes: number
  estimatedBytes: number
  elapsedMs?: number
  status?: TaskQueueItemStatus
  result?: Result
  error?: string
}

export interface TaskQueueItemResult<Result> {
  id: string
  index: number
  status: TaskQueueItemStatus
  estimatedBytes: number
  elapsedMs: number
  result?: Result
  error?: string
}

export interface TaskQueueResult<Result> {
  status: 'pass' | 'warning' | 'fail' | 'cancelled'
  elapsedMs: number
  peakActiveCount: number
  peakActiveBytes: number
  items: TaskQueueItemResult<Result>[]
}

export interface TaskQueueOptions<Result> {
  concurrency: number
  memoryBudgetBytes: number
  signal?: AbortSignal
  onEvent?: (event: TaskQueueEvent<Result>) => void | Promise<void>
}

interface ActiveTask<Result> {
  item: TaskQueueItem<Result>
  index: number
  estimatedBytes: number
  promise: Promise<TaskQueueItemResult<Result>>
}

export async function runTaskQueue<Result>(
  items: TaskQueueItem<Result>[],
  options: TaskQueueOptions<Result>,
): Promise<TaskQueueResult<Result>> {
  const concurrency = positiveInteger(options.concurrency, '并发数')
  const memoryBudgetBytes = positiveInteger(options.memoryBudgetBytes, '内存预算')
  const startedAt = performance.now()
  const pending = items.map((item, index) => ({ item, index }))
  const active = new Map<string, ActiveTask<Result>>()
  const completed: TaskQueueItemResult<Result>[] = []
  const completedById = new Map<string, TaskQueueItemResult<Result>>()
  let activeBytes = 0
  let peakActiveBytes = 0
  let peakActiveCount = 0

  assertDependencies(items)
  while (pending.length > 0 || active.size > 0) {
    if (!options.signal?.aborted) {
      let blockedIndex = findBlockedIndex(pending, completedById)
      while (blockedIndex >= 0) {
        const next = pending.splice(blockedIndex, 1)[0]
        if (!next) throw new Error('任务队列内部状态缺少被阻止任务')
        const dependency = next.item.dependsOn?.find((id) => {
          const result = completedById.get(id)
          return result && !isSuccessful(result.status)
        })
        const result: TaskQueueItemResult<Result> = {
          id: next.item.id,
          index: next.index,
          status: 'blocked',
          estimatedBytes: normalizeEstimatedBytes(next.item.estimatedBytes),
          elapsedMs: 0,
          error: `依赖任务 ${dependency ?? ''} 未通过`,
        }
        completed.push(result)
        completedById.set(result.id, result)
        await options.onEvent?.({
          type: 'completed',
          id: result.id,
          index: result.index,
          activeCount: active.size,
          activeBytes,
          estimatedBytes: result.estimatedBytes,
          elapsedMs: 0,
          status: result.status,
          error: result.error,
        })
        blockedIndex = findBlockedIndex(pending, completedById)
      }
    }
    while (!options.signal?.aborted && active.size < concurrency && pending.length > 0) {
      const pendingIndex = findRunnableIndex(
        pending,
        completedById,
        activeBytes,
        memoryBudgetBytes,
        active.size === 0,
      )
      if (pendingIndex < 0) break
      const next = pending.splice(pendingIndex, 1)[0]
      if (!next) throw new Error('任务队列内部状态缺少待启动任务')
      const { item, index } = next
      const estimatedBytes = normalizeEstimatedBytes(item.estimatedBytes)
      activeBytes += estimatedBytes
      peakActiveBytes = Math.max(peakActiveBytes, activeBytes)
      peakActiveCount = Math.max(peakActiveCount, active.size + 1)
      await options.onEvent?.({
        type: 'started',
        id: item.id,
        index,
        activeCount: active.size + 1,
        activeBytes,
        estimatedBytes,
      })
      const task: ActiveTask<Result> = {
        item,
        index,
        estimatedBytes,
        promise: runItem(item, index, estimatedBytes, options.signal),
      }
      active.set(item.id, task)
    }

    if (active.size === 0) {
      if (pending.length > 0 && !options.signal?.aborted) {
        throw new Error(`任务依赖未形成可运行顺序: ${pending.map(({ item }) => item.id).join(', ')}`)
      }
      break
    }
    const result = await Promise.race([...active.values()].map((task) => task.promise))
    const task = active.get(result.id)
    if (!task) throw new Error(`任务队列内部状态缺少 ${result.id}`)
    active.delete(result.id)
    activeBytes -= task.estimatedBytes
    completed.push(result)
    completedById.set(result.id, result)
    await options.onEvent?.({
      type: 'completed',
      id: result.id,
      index: result.index,
      activeCount: active.size,
      activeBytes,
      estimatedBytes: result.estimatedBytes,
      elapsedMs: result.elapsedMs,
      status: result.status,
      result: result.result,
      error: result.error,
    })
  }

  if (pending.length > 0) {
    for (const { item, index } of pending) {
      completed.push({
        id: item.id,
        index,
        status: 'cancelled',
        estimatedBytes: normalizeEstimatedBytes(item.estimatedBytes),
        elapsedMs: 0,
        error: '批处理已取消，任务尚未启动',
      })
    }
  }
  completed.sort((left, right) => left.index - right.index)
  return {
    status: aggregateStatus(completed, options.signal?.aborted ?? false),
    elapsedMs: performance.now() - startedAt,
    peakActiveCount,
    peakActiveBytes,
    items: completed,
  }
}

async function runItem<Result>(
  item: TaskQueueItem<Result>,
  index: number,
  estimatedBytes: number,
  signal?: AbortSignal,
): Promise<TaskQueueItemResult<Result>> {
  const startedAt = performance.now()
  try {
    throwIfAborted(signal)
    const output = await item.run(signal)
    return {
      id: item.id,
      index,
      status: output.status === 'warning' ? 'warning' : 'passed',
      estimatedBytes,
      elapsedMs: performance.now() - startedAt,
      result: output.result,
    }
  } catch (error) {
    return {
      id: item.id,
      index,
      status: isAbortError(error) || signal?.aborted ? 'cancelled' : 'failed',
      estimatedBytes,
      elapsedMs: performance.now() - startedAt,
      error: normalizeError(error),
    }
  }
}

function findRunnableIndex<Result>(
  pending: Array<{ item: TaskQueueItem<Result>; index: number }>,
  completed: Map<string, TaskQueueItemResult<Result>>,
  activeBytes: number,
  memoryBudgetBytes: number,
  allowOversized: boolean,
): number {
  const ready = pending
    .map(({ item }, index) => ({ item, index }))
    .filter(({ item }) => (item.dependsOn ?? []).every((id) => {
      const result = completed.get(id)
      return result && isSuccessful(result.status)
    }))
  const fitting = ready.find(({ item }) =>
    activeBytes + normalizeEstimatedBytes(item.estimatedBytes) <= memoryBudgetBytes)
  return fitting?.index ?? (allowOversized ? ready[0]?.index ?? -1 : -1)
}

function findBlockedIndex<Result>(
  pending: Array<{ item: TaskQueueItem<Result>; index: number }>,
  completed: Map<string, TaskQueueItemResult<Result>>,
): number {
  return pending.findIndex(({ item }) => (item.dependsOn ?? []).some((id) => {
    const result = completed.get(id)
    return result && !isSuccessful(result.status)
  }))
}

function assertDependencies<Result>(items: TaskQueueItem<Result>[]): void {
  const seen = new Set<string>()
  for (const item of items) {
    if (!item.id.trim()) throw new Error('任务 ID 不能为空')
    if (seen.has(item.id)) throw new Error(`任务 ID 重复: ${item.id}`)
    seen.add(item.id)
  }
  for (const item of items) {
    const dependencies = new Set(item.dependsOn ?? [])
    if (dependencies.has(item.id)) throw new Error(`任务 ${item.id} 不能依赖自身`)
    if (dependencies.size !== (item.dependsOn?.length ?? 0)) throw new Error(`任务 ${item.id} 的依赖重复`)
    for (const dependency of dependencies) {
      if (!seen.has(dependency)) throw new Error(`任务 ${item.id} 引用了缺失依赖 ${dependency}`)
    }
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const byId = new Map(items.map((item) => [item.id, item]))
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`任务依赖存在循环: ${id}`)
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const item of items) visit(item.id)
}

function normalizeEstimatedBytes(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 1
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label}必须是正整数`)
  return value
}

function aggregateStatus<Result>(
  items: TaskQueueItemResult<Result>[],
  aborted: boolean,
): TaskQueueResult<Result>['status'] {
  if (aborted || items.some((item) => item.status === 'cancelled')) return 'cancelled'
  if (items.some((item) => item.status === 'failed' || item.status === 'blocked')) return 'fail'
  if (items.some((item) => item.status === 'warning')) return 'warning'
  return 'pass'
}

function isSuccessful(status: TaskQueueItemStatus): boolean {
  return status === 'passed' || status === 'warning'
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('任务已取消', 'AbortError')
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
