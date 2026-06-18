/**
 * 魔搭社区 (ModelScope) 文生图 API 客户端
 *
 * 通过思源后端的 forwardProxy 正向代理发起请求
 */

/**
 * 用途：网络请求工具，用于通过思源代理发起HTTP请求
 * 使用范围：本文件中所有需要发起网络请求的函数
 * 解耦评估：必须保留。fetchSyncPost是核心网络层抽象，作为API客户端必须依赖网络层
 */
import { fetchSyncPost } from "./imports";

/**
 * 用途：任务响应类型定义
 * 使用范围：提交生成任务函数的返回值类型
 * 解耦评估：类型定义无需解耦，是接口契约的一部分
 */
import type { 任务响应 } from "./types";

/**
 * 用途：任务状态响应类型定义
 * 使用范围：获取任务状态、轮询任务等函数的返回值类型
 * 解耦评估：类型定义无需解耦，是接口契约的一部分
 */
import type { 任务状态响应 } from "./types";

/**
 * 用途：提交生成任务参数类型定义
 * 使用范围：提交生成任务函数的参数类型
 * 解耦评估：类型定义无需解耦，是接口契约的一部分
 */
import type { 提交生成任务参数 } from "./types";

/**
 * 用途：获取任务状态参数类型定义
 * 使用范围：获取任务状态函数的参数类型
 * 解耦评估：类型定义无需解耦，是接口契约的一部分
 */
import type { 获取任务状态参数 } from "./types";

/**
 * 用途：轮询任务参数类型定义
 * 使用范围：轮询任务函数的参数类型
 * 解耦评估：类型定义无需解耦，是接口契约的一部分
 */
import type { 轮询任务参数 } from "./types";

/**
 * 用途：获取图片参数类型定义
 * 使用范围：获取图片函数的参数类型
 * 解耦评估：类型定义无需解耦，是接口契约的一部分
 */
import type { 获取图片参数 } from "./types";

/**
 * 用途：生成参数类型定义
 * 使用范围：构建请求体时使用
 * 解耦评估：类型定义无需解耦，是接口契约的一部分
 */
import type { 生成参数 } from "./types";

/**
 * 用途：魔搭API基础URL常量
 * 使用范围：构建完整API端点URL
 * 解耦评估：配置常量，可通过配置文件或环境变量注入，但当前作为模块常量合理
 */
import { 魔搭API基础URL } from "./constants";

/**
 * 用途：HTTP请求头常量定义
 * 使用范围：构建请求头时使用
 * 解耦评估：协议常量，无需解耦
 */
import { 请求头 } from "./constants";

/**
 * 用途：JSON内容类型常量
 * 使用范围：设置请求Content-Type
 * 解耦评估：协议常量，无需解耦
 */
import { 内容类型JSON } from "./constants";

/**
 * 用途：任务类型常量
 * 使用范围：获取任务状态时指定任务类型
 * 解耦评估：业务常量，无需解耦
 */
import { 任务类型图片生成 } from "./constants";

/**
 * 用途：默认模型常量
 * 使用范围：未指定模型时使用的默认值
 * 解耦评估：配置常量，可通过参数传递，但提供默认值合理
 */
import { 默认模型 } from "./constants";

/**
 * 用途：API端点路径常量
 * 使用范围：构建完整API URL
 * 解耦评估：配置常量，无需解耦
 */
import { 端点 } from "./constants";

/**
 * 用途：默认参数配置（超时、重试次数等）
 * 使用范围：各函数的默认参数值
 * 解耦评估：配置常量，可通过参数传递，但提供默认值合理
 */
import { 默认参数 } from "./constants";

/**
 * 用途：思源代理端点路径
 * 使用范围：所有通过思源代理的请求
 * 解耦评估：配置常量，可通过依赖注入，但当前作为模块常量合理
 */
import { 思源代理端点 } from "./constants";

/**
 * 用途：转换请求头格式工具函数
 * 使用范围：通过思源代理请求函数中转换请求头
 * 解耦评估：工具函数，可通过参数传递，但作为同模块工具函数合理
 */
import { 转换请求头 } from "./utils";

/**
 * 用途：处理思源代理响应工具函数
 * 使用范围：通过思源代理请求函数中解析响应
 * 解耦评估：工具函数，可通过参数传递，但作为同模块工具函数合理
 */
import { 处理思源代理响应 } from "./utils";

/**
 * 用途：异步等待工具函数
 * 使用范围：轮询和重试逻辑中的延迟
 * 解耦评估：通用工具函数，可使用标准Promise，但封装后更清晰
 */
import { 等待 } from "./utils";

/**
 * 用途：类型守卫函数，验证思源代理响应格式
 * 使用范围：通过思源代理请求函数中验证响应
 * 解耦评估：类型守卫，与类型定义紧密相关，无需解耦
 */
import { 断言思源代理请求响应 } from "./client.guard";

/**
 * 通过思源代理发起请求（带重试）
 */
async function 通过思源代理请求<T>(
    targetUrl: string,
    options: RequestInit,
    maxRetries: number = 默认参数.最大重试次数
) {
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
        const response = await fetchSyncPost(思源代理端点, payload);
        断言思源代理请求响应(response);

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

        const result = 处理思源代理响应<T>(response.data);
        if (result === undefined) {
            lastError = new Error("思源代理错误: 响应体为空");
            console.warn(`[思源代理] 响应体为空, 重试中 (${attempt + 1}/${maxRetries})...`);
            await 等待(1000 * (attempt + 1));
            continue;
        }
        return result;
    }

    throw lastError || new Error("思源代理错误: 已达到最大重试次数");
}

/**
 * 创建认证请求头
 */
function 创建认证请求头(apiToken: string) {
    return {
        [请求头.Authorization]: `Bearer ${apiToken}`,
        [请求头.ContentType]: 内容类型JSON
    };
}

/**
 * 提交文生图任务
 */
export async function 提交生成任务(params: 提交生成任务参数) {
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
export async function 获取任务状态(params: 获取任务状态参数) {
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
export async function 轮询任务直到完成(params: 轮询任务参数) {
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
export async function 获取图片(params: 获取图片参数) {
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
        const response = await fetchSyncPost(思源代理端点, payload);
        断言思源代理请求响应(response);

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

        // 使用 contentType 字段
        const contentType = response.data.contentType || "image/png";

        return `data:${contentType};base64,${base64Data}`;
    }

    throw lastError || new Error("思源代理错误: 已达到最大重试次数");
}

/**
 * 从任务状态响应中提取第一个图片 URL
 */
export async function 提取图片URL(status: 任务状态响应) {
    return status.output_images?.[0];
}
