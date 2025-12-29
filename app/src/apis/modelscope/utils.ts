/**
 * 魔搭社区 (ModelScope) API 工具函数
 */

import { 是可迭代键值对 } from "./utils.guard";
import { 检查思源代理响应 } from "./client.guard";

/**
 * 将 HeadersInit 转换为 Record<string, string> 格式
 */
export function 转换请求头(headersInit?: HeadersInit): Record<string, string> {
    const headers: Record<string, string> = {};
    if (!headersInit) {
        return headers;
    }

    if (Array.isArray(headersInit)) {
        for (const [key, value] of headersInit) {
            headers[key] = value;
        }
        return headers;
    }

    if (是可迭代键值对(headersInit)) {
        for (const [key, value] of headersInit) {
            headers[key] = value;
        }
        return headers;
    }

    return Object.assign(headers, headersInit);
}

/**
 * Base64 解码
 */
export function 解码Base64(str: string): string {
    try {
        return atob(str);
    } catch {
        throw new Error("Failed to decode Base64 response body");
    }
}

/**
 * 获取错误信息
 */
function 获取错误信息(data: { status: number; body?: string }): string {
    let msg = `HTTP ${data.status}`;
    if (!data.body) {
        return msg;
    }

    try {
        msg += `: ${解码Base64(data.body)}`;
    } catch {
        /* ignore */
    }
    return msg;
}

/**
 * 处理思源代理响应
 */
export function 处理思源代理响应<T>(innerData: unknown): T | undefined {
    if (!检查思源代理响应(innerData)) {
        throw new Error("收到的响应不符合 思源代理响应 结构");
    }
    const data = innerData;
    if (data.status < 200 || data.status >= 300) {
        throw new Error(获取错误信息(data));
    }

    if (!data.body) {
        return undefined;
    }

    // 根据 bodyEncoding 决定如何解码
    const isTextEncoding = data.bodyEncoding === "text";
    const bodyContent = isTextEncoding ? data.body : 解码Base64(data.body);

    try {
        return JSON.parse(bodyContent);
    } catch {
        const preview = bodyContent.substring(0, 200);
        throw new Error(`Failed to parse response body. Preview: ${preview}`);
    }
}

/**
 * 等待指定毫秒数
 */
export function 等待(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 英文别名导出
export const transformHeaders = 转换请求头;
export const decodeBase64 = 解码Base64;
export const handleSiyuanResponse = 处理思源代理响应;
export const wait = 等待;
