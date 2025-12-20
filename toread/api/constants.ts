/**
 * API 相关常量
 */

export const MODEL_SCOPE_BASE_URL = 'https://api-inference.modelscope.cn'

// 请求头常量
export const HEADER_AUTHORIZATION = 'Authorization'
export const HEADER_CONTENT_TYPE = 'Content-Type'
export const HEADER_ASYNC_MODE = 'X-ModelScope-Async-Mode'
export const HEADER_TASK_TYPE = 'X-ModelScope-Task-Type'

// 内容类型
export const CONTENT_TYPE_JSON = 'application/json'

// 任务类型
export const TASK_TYPE_IMAGE_GENERATION = 'image_generation'

// 模型 ID
export const MODEL_Z_IMAGE_TURBO = 'Tongyi-MAI/Z-Image-Turbo'
export const MODEL_QWEN_IMAGE = 'Qwen/Qwen-Image'

// 默认参数
export const DEFAULT_SIZE = '1024×1024'
export const DEFAULT_N = 1
export const DEFAULT_NUM_INFERENCE_STEPS = 4

// Fetch 包装器常量
export const DEFAULT_TIMEOUT = 30000 // 30秒
export const DEFAULT_MAX_RETRIES = 3
export const DEFAULT_RETRY_DELAY = 1000 // 1秒

// 错误代码
export const ERROR_CODE_TIMEOUT = 'TIMEOUT'
export const ERROR_CODE_SERVER_ERROR = 'SERVER_ERROR'
export const ERROR_CODE_NETWORK_ERROR = 'NETWORK_ERROR'

// DOMException 名称
export const ABORT_ERROR_NAME = 'AbortError'

// API 端点路径
export const ENDPOINT_IMAGE_GENERATIONS = '/v1/images/generations'
export const ENDPOINT_TASK_STATUS = '/v1/tasks'

// 错误消息模板
export const ERROR_POLL_TIMEOUT = (taskId: string): string => `轮询超时，任务 ${taskId} 未在预期时间内完成`

// SiYuan Proxy Constants
export const SIYUAN_PROXY_ENDPOINT = '/api/network/forwardProxy'
export const SIYUAN_TOKEN_PREFIX = 'Token '
export const REQUEST_TIMEOUT_MS = 60000
export const METHOD_POST = 'POST'
export const METHOD_GET = 'GET'