/**
 * 同步 HTTP 请求工具
 *
 * 基于 XMLHttpRequest 实现同步请求，用于 SDK 的 $sync 功能。
 * 注意：同步请求会阻塞主线程，仅在必要时使用。
 *
 * @module utils/syncFetch
 */

/**
 * 同步请求的原始响应对象类型
 * 当 responseHandler 为 'raw' 时返回此类型
 */
export interface SyncRawResponse {
    /** 请求是否成功 (status 在 200-299 范围内) */
    ok: boolean;
    /** HTTP 状态码 */
    status: number;
    /** HTTP 状态文本 */
    statusText: string;
    /** 响应头 (Map 格式) */
    headers: Map<string, string>;
    /** 获取响应体文本 */
    text: () => string;
    /** 解析响应体为 JSON */
    json: <T = unknown>() => T;
}

/** SyncRawResponse 的中文别名 */
export type 同步原始响应 = SyncRawResponse;

/**
 * 同步请求配置选项
 */
export interface SyncFetchOptions {
    /** HTTP 方法 */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    /** 请求 URL */
    url: string;
    /** 请求头 */
    headers?: Record<string, string>;
    /** 请求体（用于 POST/PUT/PATCH） */
    body?: string | FormData;
    /** 响应处理方式 */
    responseHandler?: 'json' | 'blob' | 'text' | 'arrayBuffer' | 'raw';
}

/**
 * 同步请求错误
 */
export class SyncFetchError extends Error {
    constructor(
        message: string,
        public status: number,
        public statusText: string
    ) {
        super(message);
        this.name = 'SyncFetchError';
    }
}

/**
 * 执行同步 HTTP 请求
 *
 * @param options - 请求配置选项
 * @returns 响应数据
 * @throws {SyncFetchError} 当请求失败时抛出
 *
 * @example
 * ```typescript
 * const result = syncFetch({
 *   method: 'POST',
 *   url: 'http://127.0.0.1:6806/api/system/getConf',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({}),
 *   responseHandler: 'json'
 * });
 * ```
 */
export function syncFetch<T = unknown>(options: SyncFetchOptions): T {
    const xhr = new XMLHttpRequest();

    xhr.open(options.method, options.url, false); // false = 同步请求

    // 设置请求头
    if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
            xhr.setRequestHeader(key, value);
        }
    }

    // 发送请求
    xhr.send(options.body ?? null);

    // 检查响应状态
    if (xhr.status < 200 || xhr.status >= 300) {
        throw new SyncFetchError(
            `同步请求失败: ${options.method} ${options.url} - ${xhr.status} ${xhr.statusText}`,
            xhr.status,
            xhr.statusText
        );
    }

    // 根据响应处理方式返回数据
    const handler = options.responseHandler ?? 'json';

    switch (handler) {
        case 'json':
            try {
                return JSON.parse(xhr.responseText) as T;
            } catch {
                // 如果解析失败，返回原始文本
                return xhr.responseText as unknown as T;
            }
        case 'text':
            return xhr.responseText as unknown as T;
        case 'blob': {
            // 将响应文本转换为 Blob
            const contentType = xhr.getResponseHeader('Content-Type') ?? 'application/octet-stream';
            return new Blob([xhr.response], { type: contentType }) as unknown as T;
        }
        case 'arrayBuffer':
            // 需要处理二进制数据
            throw new Error('arrayBuffer 响应类型在同步请求中不受支持，请使用异步请求');
        case 'raw':
            // 返回包装后的响应对象
            return {
                ok: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
                statusText: xhr.statusText,
                headers: new Map(
                    xhr.getAllResponseHeaders()
                        .split('\r\n')
                        .filter((line: string): boolean => line.length > 0)
                        .map((line: string): [string, string] => {
                            const [key, ...valueParts] = line.split(':');
                            return [key.trim(), valueParts.join(':').trim()];
                        })
                ),
                text: () => xhr.responseText,
                json: () => JSON.parse(xhr.responseText),
            } as unknown as T;
        default:
            return xhr.responseText as unknown as T;
    }
}

/** syncFetch 的中文别名 */
export const 同步请求 = syncFetch;

/** SyncFetchError 的中文别名 */
export const 同步请求错误 = SyncFetchError;

/** SyncFetchOptions 的中文别名 */
export type 同步请求配置选项 = SyncFetchOptions;
