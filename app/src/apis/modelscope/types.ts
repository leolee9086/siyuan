/**
 * 魔搭社区 (ModelScope) 文生图 API 类型定义
 */

/** Auth 配置数据 */
export interface ModelScopeAuthData {
    apiToken: string;
}

/** 生成参数 */
export interface 生成参数 {
    /** 模型 ID */
    model: string;
    /** 提示词 */
    prompt: string;
    /** 负面提示词 */
    negative_prompt?: string;
    /** 图片尺寸 (如 "1024x1024") */
    size?: string;
    /** 宽度 */
    width?: number;
    /** 高度 */
    height?: number;
    /** 随机种子 */
    seed?: number;
    /** 推理步数 */
    steps?: number;
    /** 引导强度 */
    guidance?: number;
    /** 图生图输入图片 URL */
    image_url?: string;
    /** LoRA 配置 */
    loras?: string | Record<string, number>;
    /** 生成数量 */
    n?: number;
}

/** 任务响应 (提交任务后返回) */
export interface 任务响应 {
    task_id: string;
    request_id: string;
}

/** 任务状态响应 (轮询任务状态) */
export interface 任务状态响应 {
    task_id: string;
    task_status: "PENDING" | "RUNNING" | "SUCCEED" | "FAILED";
    request_id: string;
    output_images?: string[];
    input?: {
        guidanceScale: number;
        height: number;
        negativePrompt: string;
        numInferenceSteps: number;
        outputs: Record<string, unknown>;
        prompt: string;
        sampler: string;
        seed: number;
        timeTaken: number;
        width: number;
    };
    time_taken?: number;
    error?: {
        code: string;
        message: string;
    };
}

/** API 错误 */
export interface API错误 {
    code: string;
    message: string;
    status?: number;
}

/** 思源代理响应数据 (来自 /api/network/forwardProxy) */
export interface 思源代理响应 {
    /** 请求的目标 URL */
    url: string;
    /** 目标服务器返回的 HTTP 状态码 */
    status: number;
    /** 目标服务器返回的 Content-Type */
    contentType: string;
    /** 响应体内容 */
    body: string;
    /** 响应体编码方式 */
    bodyEncoding: "text" | "base64" | "base64-std" | "base64-url" | "base32" | "base32-std" | "base32-hex" | "hex";
    /** HTTP 响应头 */
    headers: Record<string, string[]>;
    /** 请求耗时 (毫秒) */
    elapsed: number;
}

/** 提交生成任务参数 */
export interface 提交生成任务参数 {
    apiToken: string;
    prompt: string;
    params?: Partial<Omit<生成参数, "prompt">>;
}

/** 获取任务状态参数 */
export interface 获取任务状态参数 {
    apiToken: string;
    taskId: string;
}

/** 轮询任务参数 */
export interface 轮询任务参数 {
    apiToken: string;
    taskId: string;
    /** 轮询间隔 (毫秒) */
    interval?: number;
    /** 最大尝试次数 */
    maxAttempts?: number;
}

/** 获取图片参数 */
export interface 获取图片参数 {
    imageUrl: string;
}

/** 英文别名导出 */
export type GenerationParams = 生成参数;
/** 英文别名导出 */
export type TaskResponse = 任务响应;
/* 英文别名导出 */
export type TaskStatusResponse = 任务状态响应;
/** 英文别名导出 */
export type ApiError = API错误;
/** 英文别名导出 */
export type SiyuanProxyData = 思源代理响应;
/** 英文别名导出 */
export type SubmitGenerationTaskParams = 提交生成任务参数;
/** 英文别名导出 */
export type GetTaskStatusParams = 获取任务状态参数;
/** 英文别名导出 */
export type PollTaskParams = 轮询任务参数;
/** 英文别名导出 */
export type FetchImageParams = 获取图片参数;
