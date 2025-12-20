/**
 * 魔搭社区 (ModelScope) 文生图 API 客户端
 *
 * 通过思源后端的 forwardProxy 正向代理发起请求
 */

import { fetchSyncPost } from "../../util/fetch";
import type {
    任务响应,
    任务状态响应,
    思源代理响应,
    提交生成任务参数,
    获取任务状态参数,
    轮询任务参数,
    获取图片参数,
    生成参数
} from "./types";
import {
    魔搭API基础URL,
    请求头,
    内容类型JSON,
    任务类型图片生成,
    默认模型,
    端点,
    默认参数,
    思源代理端点
} from "./constants";
import {
    转换请求头,
    处理思源代理响应,
    等待
} from "./utils";

/**
 * 通过思源代理发起请求（带重试）
 */
async function 通过思源代理请求<T>(
    targetUrl: string,
    options: RequestInit,
    maxRetries: number = 默认参数.最大重试次数
): Promise<T> {
    // 规范化 URL：移除协议后的多余连续斜杠
    const normalizedTargetUrl = targetUrl.replace(/([^:])\/+/g, "$1/");

    const headers = 转换请求头(options.headers);
    const siyuanHeaders = Object.entries(headers).map(([key, value]) => ({ [key]: value }));

    const payload: Record<string, unknown> = {
        url: normalizedTargetUrl,
        method: options.method || "GET",
        headers: siyuanHeaders,
        timeout: 默认参数.超时毫秒
    };

    // 如果有 body，解析并添加
    if (typeof options.body === "string") {
        try {
            payload.payload = JSON.parse(options.body);
        } catch {
            payload.payload = options.body;
        }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const response = await fetchSyncPost(思源代理端点, payload) as { code: number; msg: string; data: 思源代理响应 | null };

        if (response.code !== 0) {
            throw new Error(`思源代理错误: ${response.msg}`);
        }

        // 如果 data 为 null，等待后重试
        if (!response.data) {
            lastError = new Error("思源代理错误: 未返回数据");
            console.warn(`[思源代理] data 为 null, 重试中 (${attempt + 1}/${maxRetries})...`);
            await 等待(1000 * (attempt + 1));
            continue;
        }

        return 处理思源代理响应<T>(response.data);
    }

    throw lastError || new Error("思源代理错误: 已达到最大重试次数");
}

/**
 * 创建认证请求头
 */
function 创建认证请求头(apiToken: string): Record<string, string> {
    return {
        [请求头.Authorization]: `Bearer ${apiToken}`,
        [请求头.ContentType]: 内容类型JSON
    };
}

/**
 * 提交文生图任务
 */
export async function 提交生成任务(params: 提交生成任务参数): Promise<string> {
    const { apiToken, prompt, params: genParams = {} } = params;

    const url = `${魔搭API基础URL}${端点.图片生成}`;

    const requestBody: 生成参数 = {
        model: genParams.model || 默认模型,
        prompt,
        ...(genParams.size && { size: genParams.size }),
        ...(genParams.width !== undefined && { width: genParams.width }),
        ...(genParams.height !== undefined && { height: genParams.height }),
        ...(genParams.seed !== undefined && { seed: genParams.seed }),
        ...(genParams.steps !== undefined && { steps: genParams.steps }),
        ...(genParams.guidance !== undefined && { guidance: genParams.guidance }),
        ...(genParams.negative_prompt && { negative_prompt: genParams.negative_prompt }),
        ...(genParams.image_url && { image_url: genParams.image_url }),
        ...(genParams.loras && { loras: genParams.loras })
    };

    const headers = {
        ...创建认证请求头(apiToken),
        [请求头.AsyncMode]: "true"
    };

    const response = await 通过思源代理请求<任务响应>(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
    });

    return response.task_id;
}

/**
 * 获取任务状态
 */
export async function 获取任务状态(params: 获取任务状态参数): Promise<任务状态响应> {
    const { apiToken, taskId } = params;

    const url = `${魔搭API基础URL}${端点.任务状态}/${taskId}`;

    const headers = {
        ...创建认证请求头(apiToken),
        [请求头.TaskType]: 任务类型图片生成
    };

    return 通过思源代理请求<任务状态响应>(url, {
        method: "GET",
        headers
    });
}

/**
 * 轮询任务直到完成
 */
export async function 轮询任务直到完成(params: 轮询任务参数): Promise<任务状态响应> {
    const {
        apiToken,
        taskId,
        interval = 默认参数.轮询间隔毫秒,
        maxAttempts = 默认参数.最大轮询次数
    } = params;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const status = await 获取任务状态({ apiToken, taskId });

        if (status.task_status === "SUCCEED" || status.task_status === "FAILED") {
            return status;
        }

        await 等待(interval);
    }

    throw new Error(`轮询超时: 任务 ${taskId} 未在预期时间内完成`);
}

/**
 * 通过代理获取图片并返回 Base64
 */
export async function 获取图片(params: 获取图片参数): Promise<string> {
    const { imageUrl } = params;

    const normalizedUrl = imageUrl.replace(/([^:])\/+/g, "$1/");

    const payload = {
        url: normalizedUrl,
        method: "GET",
        headers: [],
        timeout: 默认参数.超时毫秒,
        responseEncoding: "base64"
    };

    const maxRetries = 默认参数.最大重试次数;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const response = await fetchSyncPost(思源代理端点, payload) as { code: number; msg: string; data: 思源代理响应 | null };

        if (response.code !== 0) {
            throw new Error(`思源代理错误: ${response.msg}`);
        }

        if (!response.data) {
            lastError = new Error("思源代理错误: 未返回数据");
            console.warn(`[获取图片] data 为 null, 重试中 (${attempt + 1}/${maxRetries})...`);
            await 等待(1000 * (attempt + 1));
            continue;
        }

        if (!response.data.body) {
            throw new Error("思源代理错误: 图片数据为空");
        }

        // 根据 bodyEncoding 决定如何处理
        const isTextEncoding = response.data.bodyEncoding === "text";
        const base64Data = isTextEncoding ? btoa(response.data.body) : response.data.body;

        // 获取 Content-Type
        const headers = response.data.headers || {};
        const contentTypeArr = headers["Content-Type"] || headers["content-type"] || ["image/png"];
        const contentType = contentTypeArr[0] || "image/png";

        return `data:${contentType};base64,${base64Data}`;
    }

    throw lastError || new Error("思源代理错误: 已达到最大重试次数");
}

/**
 * 从任务状态响应中提取第一个图片 URL
 */
export function 提取图片URL(status: 任务状态响应): string | undefined {
    return status.output_images?.[0];
}

// 英文别名导出
export const submitGenerationTask = 提交生成任务;
export const getTaskStatus = 获取任务状态;
export const pollTaskUntilComplete = 轮询任务直到完成;
export const fetchImage = 获取图片;
export const extractImageUrl = 提取图片URL;
