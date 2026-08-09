import { describe, expect, it } from 'vitest'
import { runTaskQueue, type TaskQueueItem } from './queue'

describe('budgeted task queue', () => {
  it('honors both concurrency and memory limits while preserving result order', async () => {
    let active = 0
    let activeBytes = 0
    let observedCount = 0
    let observedBytes = 0
    const items: TaskQueueItem<string>[] = [
      task('a', 60),
      task('b', 60),
      task('c', 40),
    ]

    const promise = runTaskQueue(items, {
      concurrency: 2,
      memoryBudgetBytes: 100,
    })
    const result = await promise

    expect(result.status).toBe('pass')
    expect(result.items.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(observedCount).toBe(2)
    expect(observedBytes).toBeLessThanOrEqual(100)
    expect(result.peakActiveBytes).toBe(100)

    function task(id: string, estimatedBytes: number): TaskQueueItem<string> {
      return {
        id,
        estimatedBytes,
        async run() {
          active += 1
          activeBytes += estimatedBytes
          observedCount = Math.max(observedCount, active)
          observedBytes = Math.max(observedBytes, activeBytes)
          await new Promise((resolve) => setTimeout(resolve, 5))
          active -= 1
          activeBytes -= estimatedBytes
          return { result: id }
        },
      }
    }
  })

  it('continues after a failure and reports warnings separately', async () => {
    const result = await runTaskQueue([
      { id: 'pass', estimatedBytes: 1, run: async () => ({ result: 1 }) },
      { id: 'fail', estimatedBytes: 1, run: async () => { throw new Error('broken') } },
      { id: 'warn', estimatedBytes: 1, run: async () => ({ status: 'warning', result: 3 }) },
    ], { concurrency: 2, memoryBudgetBytes: 2 })

    expect(result.status).toBe('fail')
    expect(result.items.map((item) => item.status)).toEqual(['passed', 'failed', 'warning'])
    expect(result.items[1]?.error).toBe('broken')
  })

  it('stops launching pending work after cancellation', async () => {
    const abort = new AbortController()
    const started: string[] = []
    const result = await runTaskQueue([
      {
        id: 'active',
        estimatedBytes: 1,
        async run(signal) {
          abort.abort()
          if (signal?.aborted) throw new DOMException('cancelled', 'AbortError')
          return { result: 1 }
        },
      },
      { id: 'pending', estimatedBytes: 1, run: async () => ({ result: 2 }) },
    ], {
      concurrency: 1,
      memoryBudgetBytes: 1,
      signal: abort.signal,
      onEvent(event) {
        if (event.type === 'started') started.push(event.id)
      },
    })

    expect(started).toEqual(['active'])
    expect(result.status).toBe('cancelled')
    expect(result.items.map((item) => item.status)).toEqual(['cancelled', 'cancelled'])
  })

  it('runs dependencies in order and blocks descendants of failed work', async () => {
    const order: string[] = []
    const result = await runTaskQueue([
      {
        id: 'source',
        estimatedBytes: 1,
        async run() {
          order.push('source')
          throw new Error('source failed')
        },
      },
      {
        id: 'dependent',
        estimatedBytes: 1,
        dependsOn: ['source'],
        async run() {
          order.push('dependent')
          return { result: 2 }
        },
      },
      {
        id: 'independent',
        estimatedBytes: 1,
        async run() {
          order.push('independent')
          return { result: 3 }
        },
      },
    ], { concurrency: 2, memoryBudgetBytes: 2 })

    expect(order).toContain('source')
    expect(order).toContain('independent')
    expect(order).not.toContain('dependent')
    expect(result.items.map((item) => item.status)).toEqual(['failed', 'blocked', 'passed'])
  })

  it('rejects missing and cyclic dependencies', async () => {
    await expect(runTaskQueue([
      { id: 'a', estimatedBytes: 1, dependsOn: ['missing'], run: async () => ({ result: 1 }) },
    ], { concurrency: 1, memoryBudgetBytes: 1 })).rejects.toThrow('缺失依赖')

    await expect(runTaskQueue([
      { id: 'a', estimatedBytes: 1, dependsOn: ['b'], run: async () => ({ result: 1 }) },
      { id: 'b', estimatedBytes: 1, dependsOn: ['a'], run: async () => ({ result: 2 }) },
    ], { concurrency: 1, memoryBudgetBytes: 1 })).rejects.toThrow('循环')
  })
})
