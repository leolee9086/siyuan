import type { D5MeshModel } from './types'
import { parseD5Mesh } from './d5mesh'
import type { ParseMeshRequest, ParseMeshResponse } from '../workers/protocol'

export interface WorkerParseResult {
  model: D5MeshModel
  elapsedMs: number
}

export function parseD5MeshInWorker(buffer: ArrayBuffer, signal?: AbortSignal): Promise<WorkerParseResult> {
  if (typeof Worker === 'undefined') return parseD5MeshInline(buffer, signal)
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/d5mesh.worker.ts', import.meta.url), { type: 'module' })
    let settled = false

    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      worker.terminate()
      action()
    }
    const onAbort = () => finish(() => reject(new DOMException('加载已取消', 'AbortError')))

    worker.onmessage = (event: MessageEvent<ParseMeshResponse>) => {
      const response = event.data
      if (response.type === 'result') {
        finish(() => resolve({ model: response.model, elapsedMs: response.elapsedMs }))
      } else {
        finish(() => reject(new Error(response.message)))
      }
    }
    worker.onerror = (event) => finish(() => reject(new Error(event.message || '模型解析 Worker 异常')))
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) {
      onAbort()
      return
    }
    const request: ParseMeshRequest = { type: 'parse', buffer }
    worker.postMessage(request, [buffer])
  })
}

async function parseD5MeshInline(buffer: ArrayBuffer, signal?: AbortSignal): Promise<WorkerParseResult> {
  throwIfAborted(signal)
  const started = performance.now()
  await Promise.resolve()
  throwIfAborted(signal)
  return { model: parseD5Mesh(buffer), elapsedMs: performance.now() - started }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('加载已取消', 'AbortError')
}
