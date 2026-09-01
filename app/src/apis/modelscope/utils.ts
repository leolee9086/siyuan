/**
 * 魔搭社区 (ModelScope) API 工具函数
 */

/** 用途：类型守卫。使用范围：Headers 可迭代性判断。解耦评估：同目录守卫文件。 */
import { 是可迭代键值对 } from "./utils.guard";
/** 用途：响应类型守卫。使用范围：代理响应校验。解耦评估：同目录守卫文件。 */
import { 检查思源代理响应 } from "./client.guard";

/**
 * 将 HeadersInit 转换为 Record<string, string> 格式
 */
/** @同步豁免: 性能考虑 */
/** 当前请求构造阶段需要立即展开请求头，不包含 I/O。 */
export function 转换请求头(headersInit?: HeadersInit) {
    const headers: Record<string, string> = {};
    if (!headersInit) {
        return headers;
    }

    // HeadersInit 的第一种形式：二维字符串数组（如 [["Content-Type", "application/json"]]）
    // 需要遍历每个 [key, value] 对并添加到结果对象中
    if (Array.isArray(headersInit)) {
        for (const [key, value] of headersInit) {
            headers[key] = value;
        }
        return headers;
    }

    // HeadersInit 的第二种形式：Headers 实例或其他可迭代对象（实现了 Symbol.iterator）
    // 同样需要遍历每个 [key, value] 对
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
/** @同步豁免: 性能考虑 */
/** 错误消息构造需要立即取得可读预览文本。 */
export function 解码Base64(str: string) {
    try {
        return atob(str);
    } catch {
        throw new Error("Failed to decode Base64 response body");
    }
}

/**
 * 获取错误信息
 */
function 获取错误信息(data: { status: number; body?: string }) {
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
export async function 处理思源代理响应<T>(innerData: unknown) {
    if (!检查思源代理响应(innerData)) {
        throw new Error("收到的响应不符合 思源代理响应 结构");
    }
    // 类型守卫已收窄 innerData 类型，直接使用
    if (innerData.status < 200 || innerData.status >= 300) {
        throw new Error(获取错误信息(innerData));
    }

    if (!innerData.body) {
        return undefined;
    }

    // 根据 bodyEncoding 决定如何解码
    const isTextEncoding = innerData.bodyEncoding === "text";
    const bodyContent = isTextEncoding ? innerData.body : 解码Base64(innerData.body);

    try {
        const parsed: T = JSON.parse(bodyContent);
        return parsed;
    } catch {
        const preview = bodyContent.substring(0, 200);
        throw new Error(`Failed to parse response body. Preview: ${preview}`);
    }
}

/**
 * 等待指定毫秒数
 */
export async function 等待(ms: number) {
    // 用于创建可 await 的延迟，调用者根据需要决定延迟时长和用途（如 API 限流、等待动画等）
    return new Promise(resolve => setTimeout(resolve, ms));
}

