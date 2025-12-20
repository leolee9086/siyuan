/**
 * ModelScope 文生图 API 类型定义
 */

export interface GenerationParams {
  model: string
  prompt: string
  negative_prompt?: string
  size?: string
  seed?: number
  steps?: number
  guidance?: number
  image_url?: string
  loras?: string | Record<string, number>
  n?: number
}

export interface Task {
  localId: string
  remoteTaskId?: string
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  prompt: string
  resultUrl?: string
  createdAt: number
  progress?: number
  error?: string
}

export interface TaskResponse {
  task_id: string
  request_id: string
}

export interface TaskStatusResponse {
  task_id: string
  task_status: 'PENDING' | 'RUNNING' | 'SUCCEED' | 'FAILED'
  request_id: string
  output_images?: string[]
  input?: {
    guidanceScale: number
    height: number
    negativePrompt: string
    numInferenceSteps: number
    outputs: Record<string, unknown>
    prompt: string
    sampler: string
    seed: number
    timeTaken: number
    weight: number
  }
  time_taken?: number
  error?: {
    code: string
    message: string
  }
}

export interface ApiError {
  code: string
  message: string
  status?: number
}

export interface ApiClientOptions {
  baseUrl: string
  apiKey: string
  timeout?: number
  maxRetries?: number
  retryDelay?: number
}

export interface FetchOptions extends RequestInit {
  timeout?: number
  retries?: number
}

export interface FetchWithRetryParams {
  url: string
  options: FetchOptions
  retries?: number
  retryDelay?: number
}

export interface SiyuanConfig {
  url: string
  token: string
}

export type ApiProxyType = 'default' | 'custom' | 'siyuan'

export interface PerformFetchContext {
  payload: Record<string, any>
  apiKey: string
  url: string
  siyuanConfig?: SiyuanConfig
}

export interface GetTaskStatusParams {
  apiKey: string
  taskId: string
  proxyUrl?: string
  proxyType?: ApiProxyType
  siyuanConfig?: SiyuanConfig
}

export interface PollTaskUntilCompleteParams {
  apiKey: string
  taskId: string
  interval?: number
  maxAttempts?: number
  proxyUrl?: string
  proxyType?: ApiProxyType
  siyuanConfig?: SiyuanConfig
}

export interface SubmitGenerationTaskParams {
  apiKey: string
  prompt: string
  params?: Partial<Omit<GenerationParams, 'prompt'>>
  proxyUrl?: string
  batchInterval?: number
  proxyType?: ApiProxyType
  siyuanConfig?: SiyuanConfig
}

export interface SiyuanProxyData {
  statusCode: number
  body?: string
  bodyEncoding?: string
  headers?: Record<string, string[]>
}