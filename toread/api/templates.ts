/**
 * API 相关模板字符串
 */
/**
 * 构建代理 URL
 */
export function buildProxyUrl(targetUrl: string,proxyUrl:string): string {
  const encoded = encodeURIComponent(targetUrl)
  return `${proxyUrl}?target=${encoded}`
}
export const TIMEOUT_MESSAGE = (timeout: number): string => `请求超时 (${timeout}ms)`
export const SERVER_ERROR_MESSAGE = (status: number): string => `服务器错误 ${status}`
export const HTTP_ERROR_MESSAGE = (status: number): string => `HTTP ${status}`
export const UNKNOWN_NETWORK_ERROR = '未知网络错误'
export const BEARER_TOKEN = (apiKey: string): string => `Bearer ${apiKey}`

// ModelScope API 模板
export const IMAGE_GENERATION_URL = (proxyUrl: string, endpoint: string): string => `${proxyUrl}/${endpoint}`
export const TASK_STATUS_URL = (proxyUrl: string, endpoint: string, taskId: string): string => `${proxyUrl}/${endpoint}/${taskId}`