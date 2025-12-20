/**
 * fetch 包装器，支持超时、重试、错误处理
 */

import type { FetchOptions, FetchWithRetryParams } from './types'
import { FetchError } from './FetchError.class'
import {
  DEFAULT_TIMEOUT,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY,
  CONTENT_TYPE_JSON,
  ERROR_CODE_TIMEOUT,
  ERROR_CODE_SERVER_ERROR,
  ERROR_CODE_NETWORK_ERROR,
  HEADER_AUTHORIZATION,
  HEADER_CONTENT_TYPE,
  ABORT_ERROR_NAME,
} from './constants'
import {
  TIMEOUT_MESSAGE,
  SERVER_ERROR_MESSAGE,
  HTTP_ERROR_MESSAGE,
  UNKNOWN_NETWORK_ERROR,
  BEARER_TOKEN,
} from './templates'

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof DOMException && error.name === ABORT_ERROR_NAME) {
      throw new FetchError({
        message: TIMEOUT_MESSAGE(timeout),
        status: 408,
        code: ERROR_CODE_TIMEOUT,
      })
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 带指数退避的重试机制
 */
async function fetchWithRetry(params: FetchWithRetryParams): Promise<Response> {
  const { url, options, retries = DEFAULT_MAX_RETRIES, retryDelay = DEFAULT_RETRY_DELAY } = params
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options)
      // 如果状态码是 5xx 或 429，重试
      if (response.status >= 500 || response.status === 429) {
        throw new FetchError({
          message: SERVER_ERROR_MESSAGE(response.status),
          status: response.status,
          code: ERROR_CODE_SERVER_ERROR,
          response,
        })
      }
      return response
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt) // 指数退避
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
    }
  }

  // 如果 lastError 是 FetchError，直接抛出
  if (lastError instanceof FetchError) {
    throw lastError
  }
  // 否则包装为网络错误
  throw new FetchError({
    message: lastError instanceof Error ? lastError.message : UNKNOWN_NETWORK_ERROR,
    code: ERROR_CODE_NETWORK_ERROR,
  })
}

import { guardJsonResponse, guardTextResponse } from './fetchWrapper.guard'

/**
 * 处理响应，解析 JSON 或抛出错误
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get(HEADER_CONTENT_TYPE)
  if (!response.ok) {
    const errorData = await (contentType?.includes(CONTENT_TYPE_JSON)
      ? response.json()
      : response.text())
    throw new FetchError({
      message: errorData.message || HTTP_ERROR_MESSAGE(response.status),
      status: response.status,
      code: errorData.code,
      response,
    })
  }

  if (contentType?.includes(CONTENT_TYPE_JSON)) {
    return guardJsonResponse<T>(response)
  }
  return guardTextResponse<T>(response)
}

/**
 * 主 fetch 函数
 */
export async function robustFetch<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await fetchWithRetry({ url, options })
  return handleResponse<T>(response)
}

/**
 * 创建带认证头的 fetch 选项
 */
export function createAuthHeaders(apiKey: string): Record<string, string> {
  return {
    [HEADER_AUTHORIZATION]: BEARER_TOKEN(apiKey),
    [HEADER_CONTENT_TYPE]: CONTENT_TYPE_JSON,
  }
}