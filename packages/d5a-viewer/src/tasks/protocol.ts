export type AssetDocumentKind = 'scene' | 'material'

export type AssetTaskOperation =
  | 'inspect'
  | 'view'
  | 'convert'
  | 'batch'
  | 'validate'
  | 'extract'
  | 'serve'
  | 'create'
  | 'edit'

export type AssetTaskEventType = 'started' | 'progress' | 'warning' | 'completed'

export interface AssetTaskEvent {
  schemaVersion: 1
  taskId: string
  sequence: number
  timestamp: number
  type: AssetTaskEventType
  operation: AssetTaskOperation
  documentKind: AssetDocumentKind
  format: string
  phase: string
  message: string
  completed?: number
  total?: number
}

export interface AssetTaskContext {
  taskId?: string
  signal?: AbortSignal
  onEvent?: (event: AssetTaskEvent) => void
}

export interface AssetTaskReporter {
  readonly taskId: string
  readonly signal?: AbortSignal
  emit(
    type: AssetTaskEventType,
    phase: string,
    message: string,
    progress?: { completed: number; total: number },
  ): void
  throwIfAborted(message?: string): void
}

export function createAssetTaskReporter(
  operation: AssetTaskOperation,
  documentKind: AssetDocumentKind,
  format: string,
  context: AssetTaskContext = {},
): AssetTaskReporter {
  const taskId = context.taskId ?? crypto.randomUUID()
  let sequence = 0
  return {
    taskId,
    signal: context.signal,
    emit(type, phase, message, progress) {
      context.onEvent?.({
        schemaVersion: 1,
        taskId,
        sequence: sequence++,
        timestamp: Date.now(),
        type,
        operation,
        documentKind,
        format,
        phase,
        message,
        ...(progress ? { completed: progress.completed, total: progress.total } : {}),
      })
    },
    throwIfAborted(message = '任务已取消') {
      if (context.signal?.aborted) throw new DOMException(message, 'AbortError')
    },
  }
}
