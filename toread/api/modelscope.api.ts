/**
 * ModelScope 文生图 API 客户端
 */

import type {
  GenerationParams,
  TaskResponse,
  TaskStatusResponse,
  ApiError,
  PollTaskUntilCompleteParams,
  SubmitGenerationTaskParams,
  GetTaskStatusParams,
  PerformFetchContext,
  SiyuanConfig,
  SiyuanProxyData
} from './types'
import { robustFetch, createAuthHeaders } from './fetchWrapper.api'
import {
  MODEL_SCOPE_BASE_URL,
  HEADER_ASYNC_MODE,
  HEADER_TASK_TYPE,
  TASK_TYPE_IMAGE_GENERATION,
  MODEL_Z_IMAGE_TURBO,
  DEFAULT_N,
  ENDPOINT_IMAGE_GENERATIONS,
  ENDPOINT_TASK_STATUS,
  ERROR_POLL_TIMEOUT,
  SIYUAN_PROXY_ENDPOINT,
  SIYUAN_TOKEN_PREFIX,
  REQUEST_TIMEOUT_MS,
  METHOD_POST,
  METHOD_GET
} from './constants'
import {
  buildProxyUrl,
  IMAGE_GENERATION_URL,
  TASK_STATUS_URL,
} from './templates'

/**
 * 使用 SiYuan 代理发起请求，带重试逻辑
 */
async function fetchWithSiyuan<T>(
  siyuanConfig: SiyuanConfig,
  targetUrl: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<T> {
  // 规范化 URL：移除协议后的多余连续斜杠 (保留 :// 中的双斜杠)
  const normalizedTargetUrl = targetUrl.replace(/([^:])\/+/g, '$1/')
  const baseUrl = siyuanConfig.url.replace(/\/+$/, '')
  const siyuanUrl = `${baseUrl}${SIYUAN_PROXY_ENDPOINT}`

  const headers = transformHeaders(options.headers)
  const siyuanHeaders = Object.entries(headers).map(([key, value]) => ({ [key]: value }))

  const payload = {
    url: normalizedTargetUrl,
    method: options.method || METHOD_GET,
    headers: siyuanHeaders,
    timeout: REQUEST_TIMEOUT_MS,
    payload: (typeof options.body === 'string') ? JSON.parse(options.body) : undefined
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await robustFetch<{ code: number; msg: string; data: SiyuanProxyData | null }>(siyuanUrl, {
      method: METHOD_POST,
      headers: {
        Authorization: `${SIYUAN_TOKEN_PREFIX}${siyuanConfig.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (response.code !== 0) throw new Error(`SiYuan Proxy Error: ${response.msg}`)

    // 如果 data 为 null，等待后重试
    if (!response.data) {
      lastError = new Error('SiYuan Proxy Error: No data returned')
      console.warn(`[SiYuan Proxy] data is null, retrying (${attempt + 1}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      continue
    }

    return handleSiyuanResponse<T>(response.data)
  }

  throw lastError || new Error('SiYuan Proxy Error: Max retries exceeded')
}

function transformHeaders(headersInit?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = {}
  if (!headersInit) return headers

  if (Array.isArray(headersInit) || typeof (headersInit as any)[Symbol.iterator] === 'function') {
    for (const [key, value] of (headersInit as Iterable<[string, string]>)) {
      headers[key] = value
    }
    return headers
  }

  return Object.assign(headers, headersInit)
}

function getErrorMessage(data: { statusCode: number; body?: string }): string {
  let msg = `HTTP ${data.statusCode}`
  if (!data.body) return msg

  try {
    msg += `: ${atob(data.body)}`
  } catch {
    /* ignore */
  }
  return msg
}

function handleSiyuanResponse<T>(innerData: unknown): T {
  const data = innerData as SiyuanProxyData
  if (data.statusCode < 200 || data.statusCode >= 300) {
    throw new Error(getErrorMessage(data))
  }

  if (!data.body) {
    return {} as T
  }

  // 根据 bodyEncoding 决定如何解码
  const isTextEncoding = data.bodyEncoding === 'text'
  const bodyContent = isTextEncoding ? data.body : decodeBase64(data.body)

  try {
    return JSON.parse(bodyContent)
  } catch {
    const preview = bodyContent.substring(0, 200)
    throw new Error(`Failed to parse response body. Preview: ${preview}`)
  }
}

/**
 * @简洁函数 Base64 解码工具函数
 */
function decodeBase64(str: string): string {
  try {
    return atob(str)
  } catch {
    throw new Error('Failed to decode Base64 response body')
  }
}

/**
 * 提交文生图任务
 */
export async function submitGenerationTask(
  params: SubmitGenerationTaskParams
): Promise<string[]> {
  const { apiKey, prompt, params: generationParams = {}, proxyUrl, batchInterval = 0, siyuanConfig } = params
  const proxiedUrl = (!siyuanConfig && proxyUrl) ? buildProxyUrl(MODEL_SCOPE_BASE_URL, proxyUrl) : MODEL_SCOPE_BASE_URL
  const url = IMAGE_GENERATION_URL(proxiedUrl, ENDPOINT_IMAGE_GENERATIONS)
  const n = generationParams.n ?? DEFAULT_N

  const basePayload: Omit<GenerationParams, 'n'> = {
    model: generationParams.model || MODEL_Z_IMAGE_TURBO,
    prompt,
    ...(generationParams.size && { size: generationParams.size }),
    ...(generationParams.seed !== undefined && { seed: generationParams.seed }),
    ...(generationParams.steps !== undefined && { steps: generationParams.steps }),
    ...(generationParams.guidance !== undefined && { guidance: generationParams.guidance }),
    ...(generationParams.negative_prompt && { negative_prompt: generationParams.negative_prompt }),
    ...(generationParams.image_url && { image_url: generationParams.image_url }),
    ...(generationParams.loras && { loras: generationParams.loras }),
  }

  if (n === 1) {
    const response = await performGenerationFetch({ payload: basePayload, apiKey, url, siyuanConfig })
    return [response.task_id]
  }

  const requestIds: string[] = []
  for (let i = 0; i < n; i++) {
    if (batchInterval > 0 && i > 0) await new Promise(resolve => setTimeout(resolve, batchInterval))
    const payload = {
      ...basePayload,
      ...(basePayload.seed === undefined && { seed: Math.floor(Math.random() * 2147483647) }),
    }
    const response = await performGenerationFetch({ payload, apiKey, url, siyuanConfig })
    requestIds.push(response.task_id)
  }
  return requestIds
}

async function performGenerationFetch(ctx: PerformFetchContext): Promise<TaskResponse> {
  const { payload, apiKey, url, siyuanConfig } = ctx
  const headers = { ...createAuthHeaders(apiKey), [HEADER_ASYNC_MODE]: 'true' }
  const body = JSON.stringify(payload)
  const options = { method: METHOD_POST, headers, body }

  if (siyuanConfig) return fetchWithSiyuan<TaskResponse>(siyuanConfig, url, options)
  return robustFetch<TaskResponse>(url, options)
}

/**
 * 获取任务状态
 */
export async function getTaskStatus(
  params: GetTaskStatusParams
): Promise<TaskStatusResponse> {
  const { apiKey, taskId, proxyUrl, siyuanConfig } = params

  const url = TASK_STATUS_URL(MODEL_SCOPE_BASE_URL, ENDPOINT_TASK_STATUS, taskId)
  const proxiedUrl = (!siyuanConfig && proxyUrl) ? buildProxyUrl(url, proxyUrl) : url

  if (siyuanConfig) {
    return fetchWithSiyuan<TaskStatusResponse>(siyuanConfig, proxiedUrl, {
      headers: {
        ...createAuthHeaders(apiKey),
        [HEADER_TASK_TYPE]: TASK_TYPE_IMAGE_GENERATION,
      },
    })
  }

  const response = await robustFetch<TaskStatusResponse>(proxiedUrl, {
    headers: {
      ...createAuthHeaders(apiKey),
      [HEADER_TASK_TYPE]: TASK_TYPE_IMAGE_GENERATION,
    },
  })
  return response
}

/**
 * 轮询任务直到完成或失败
 */
export async function pollTaskUntilComplete(
  params: PollTaskUntilCompleteParams
): Promise<TaskStatusResponse> {
  const { apiKey, taskId, interval = 2000, maxAttempts = 60, proxyUrl, siyuanConfig } = params
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getTaskStatus({ apiKey, taskId, proxyUrl, siyuanConfig })
    if (status.task_status === 'SUCCEED' || status.task_status === 'FAILED') {
      return status
    }
    // 等待 interval 毫秒
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  throw new Error(ERROR_POLL_TIMEOUT(taskId))
}

/**
 * 从成功响应中提取图片 URL
 */
export function extractImageUrl(status: TaskStatusResponse): string | undefined {
  return status.output_images?.[0]
}

/**
 * 处理 API 错误
 */
export function handleApiError(error: unknown): ApiError {
  if (error instanceof Error) {
    return {
      code: 'UNKNOWN',
      message: error.message,
    }
  }
  return {
    code: 'UNKNOWN',
    message: '未知错误',
  }
}

interface FetchImageParams {
  imageUrl: string
  proxyUrl?: string
  siyuanConfig?: SiyuanConfig
}

/**
 * 通过代理（思源代理或传统代理）获取图片并返回 Base64
 */
export async function fetchImageWithProxy(params: FetchImageParams): Promise<string> {
  const { imageUrl, proxyUrl, siyuanConfig } = params

  // 使用思源代理
  if (siyuanConfig) {
    const normalizedUrl = imageUrl.replace(/([^:])\/+/g, '$1/')
    const baseUrl = siyuanConfig.url.replace(/\/+$/, '')
    const siyuanUrl = `${baseUrl}${SIYUAN_PROXY_ENDPOINT}`

    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await robustFetch<{ code: number; msg: string; data: SiyuanProxyData | null }>(siyuanUrl, {
        method: METHOD_POST,
        headers: {
          Authorization: `${SIYUAN_TOKEN_PREFIX}${siyuanConfig.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: normalizedUrl,
          method: METHOD_GET,
          headers: [],
          timeout: REQUEST_TIMEOUT_MS,
          responseEncoding: 'base64'
        })
      })

      if (response.code !== 0) throw new Error(`SiYuan Proxy Error: ${response.msg}`)

      // 如果 data 为 null，等待后重试
      if (!response.data) {
        lastError = new Error('SiYuan Proxy Error: No data returned')
        console.warn(`[fetchImageWithProxy] data is null, retrying (${attempt + 1}/${maxRetries})...`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }

      if (!response.data.body) throw new Error('SiYuan Proxy Error: Empty image body')

      // 思源代理返回的图片数据是 Base64 编码的
      const isTextEncoding = response.data.bodyEncoding === 'text'
      const base64Data = isTextEncoding ? btoa(response.data.body) : response.data.body

      // 获取 Content-Type
      const headers = response.data.headers || {}
      const contentTypeArr = headers['Content-Type'] || headers['content-type'] || ['image/png']
      const contentType = contentTypeArr[0] || 'image/png'

      return `data:${contentType};base64,${base64Data}`
    }

    throw lastError || new Error('SiYuan Proxy Error: Max retries exceeded')
  }

  // 使用传统代理
  const finalUrl = proxyUrl ? buildProxyUrl(imageUrl, proxyUrl) : imageUrl
  const response = await fetch(finalUrl)

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }

  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}