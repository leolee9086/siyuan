/**
 * 图像获取器常量
 */

// 轮询配置
export const POLLING_INTERVAL_MS = 2000 // 2 秒
export const MAX_POLLING_ATTEMPTS = 30 // 最多尝试 30 次（60 秒）

// 日志消息模板
export const LOG_MESSAGES = {
  CACHE_HIT: (url: string): string => `[fetchImageAsBase64] 缓存命中 URL: ${url}`,
  CACHE_MISS: (url: string): string => `[fetchImageAsBase64] 缓存未命中，开始轮询 URL: ${url}`,
  POLL_ATTEMPT: (attempt: number, status?: number): string =>
    `[pollImageUrl] 尝试 ${attempt}: 响应状态 ${status}, 等待重试...`,
  POLL_NETWORK_ERROR: (attempt: number, error: unknown): string =>
    `[pollImageUrl] 尝试 ${attempt}: 网络错误 ${error}, 等待重试...`,
  FETCH_SUCCESS: '[fetchImageAsBase64] 获取成功，开始缓存',
  CACHE_VALIDATION_SUCCESS: '[fetchImageAsBase64] 缓存验证成功',
} as const

// 错误消息
export const ERROR_MESSAGES = {
  TIMEOUT: (attempts: number): string => `图片获取超时（${attempts} 次尝试后）`,
  CACHE_FAILED: '图片没有正确缓存',
  READ_ERROR: '无法读取图像数据',
  FILE_READER_ERROR: 'FileReader 错误',
} as const