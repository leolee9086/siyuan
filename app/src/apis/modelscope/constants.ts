/**
 * 魔搭社区 (ModelScope) API 常量
 */

/** 魔搭社区 API 基础 URL */
export const 魔搭API基础URL = "https://api-inference.modelscope.cn";

/** 请求头键名 */
export const 请求头 = {
    Authorization: "Authorization",
    ContentType: "Content-Type",
    AsyncMode: "X-ModelScope-Async-Mode",
    TaskType: "X-ModelScope-Task-Type"
} as const;

/** 内容类型 */
export const 内容类型JSON = "application/json";

/** 任务类型 */
export const 任务类型图片生成 = "image_generation";

/** 默认模型 */
export const 默认模型 = "Tongyi-MAI/Z-Image-Turbo";

/** API 端点 */
export const 端点 = {
    图片生成: "/v1/images/generations",
    任务状态: "/v1/tasks"
} as const;

/** 默认参数 */
export const 默认参数 = {
    超时毫秒: 60000,
    轮询间隔毫秒: 2000,
    最大轮询次数: 60,
    最大重试次数: 3
} as const;

/** 思源代理端点 */
export const 思源代理端点 = "/api/network/forwardProxy";

// 英文别名导出
export const MODEL_SCOPE_BASE_URL = 魔搭API基础URL;
export const HEADERS = 请求头;
export const CONTENT_TYPE_JSON = 内容类型JSON;
export const TASK_TYPE_IMAGE_GENERATION = 任务类型图片生成;
export const DEFAULT_MODEL = 默认模型;
export const ENDPOINTS = 端点;
export const DEFAULT_PARAMS = 默认参数;
export const SIYUAN_PROXY_ENDPOINT = 思源代理端点;
