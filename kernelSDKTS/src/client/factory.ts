/**
 * 客户端工厂 - 核心实现
 *
 * 通过 TypeScript 类型推断，从 API 定义数组自动生成类型安全的客户端方法，
 * 无需代码生成，运行时创建方法，编译时获得完整类型支持。
 */
import type { z } from 'zod';
import type { Api定义, 客户端配置, 完整客户端, 请求配置, 响应处理方式 } from './types';
import { syncFetch } from '../utils/syncFetch';

/**
 * 默认配置
 */
const 默认配置: Required<客户端配置> = {
    baseUrl: 'http://127.0.0.1:6806',
    apiToken: '',
    customFetch: globalThis.fetch,
    responseHandler: 'json',
};

/**
 * 创建类型安全的 API 客户端
 *
 * @param apiDefs - API 定义数组，必须使用 `as const` 保留字面量类型
 * @param options - 客户端配置
 * @returns 类型安全的客户端对象，方法名对应 API 定义中的 `en` 字段
 *          返回的对象包含异步方法和 $sync 属性用于同步调用
 *
 * @example
 * ```typescript
 * const client = 创建客户端(accountApiDefs, {
 *   baseUrl: 'http://127.0.0.1:6806',
 *   apiToken: 'your-token',
 * });
 *
 * // 异步调用
 * const result = await client.login({
 *   userName: 'test',
 *   userPassword: '123',
 *   captcha: 'xxxx',
 *   cloudRegion: 0,
 * });
 *
 * // 同步调用
 * const syncResult = client.$sync.login({
 *   userName: 'test',
 *   userPassword: '123',
 *   captcha: 'xxxx',
 *   cloudRegion: 0,
 * });
 * ```
 */
export function 创建客户端<
    TDefs extends readonly Api定义[],
    TResult = 完整客户端<TDefs>
>(
    apiDefs: TDefs,
    options: 客户端配置 = {}
): TResult {
    const config = { ...默认配置, ...options };

    // 创建异步方法容器
    const client = {} as Record<string, (data?: unknown) => Promise<unknown>> & {
        baseUrl: string;
        apiToken: string;
    };

    // 创建同步方法容器
    const syncClient = {} as Record<string, (data?: unknown) => unknown>;

    // 暴露配置属性，供需要直接访问 API 配置的场景使用
    client.baseUrl = config.baseUrl;
    client.apiToken = config.apiToken;

    for (const def of apiDefs) {
        // ===== 创建异步方法 =====
        client[def.en] = async (data?: unknown, requestOptions?: 请求配置) => {
            const url = `${config.baseUrl}${def.endpoint}`;
            const headers: Record<string, string> = {};

            // 添加认证头
            if (def.needAuth && config.apiToken) {
                headers['Authorization'] = `Token ${config.apiToken}`;
            }

            const fetchOptions: RequestInit = {
                method: def.method,
                headers,
            };

            // POST/PUT/PATCH 请求添加 body
            if (data !== undefined && ['POST', 'PUT', 'PATCH'].includes(def.method)) {
                if (def.formDataRequest && data instanceof FormData) {
                    // FormData 请求：直接传递 FormData，不设置 Content-Type（让浏览器自动设置 boundary）
                    fetchOptions.body = data;
                } else {
                    // JSON 请求：设置 Content-Type 并序列化
                    headers['Content-Type'] = 'application/json';
                    fetchOptions.body = JSON.stringify(data);
                }
            } else if (!def.formDataRequest) {
                // 非 FormData 请求默认设置 Content-Type
                headers['Content-Type'] = 'application/json';
            }

            const response = await config.customFetch(url, fetchOptions);

            if (!response.ok) {
                throw new Error(
                    `API 请求失败: ${def.method} ${def.endpoint} - ${response.status} ${response.statusText}`
                );
            }

            // 请求级配置优先于客户端级配置
            const handler: 响应处理方式 = requestOptions?.responseHandler ?? config.responseHandler ?? 'json';
            switch (handler) {
                case 'blob':
                    return response.blob();
                case 'text':
                    return response.text();
                case 'arrayBuffer':
                    return response.arrayBuffer();
                case 'raw':
                    return response;
                case 'json':
                default:
                    return response.json() as Promise<z.infer<typeof def.zodResponseSchema>>;
            }
        };

        // ===== 创建同步方法 =====
        syncClient[def.en] = (data?: unknown, requestOptions?: 请求配置) => {
            const url = `${config.baseUrl}${def.endpoint}`;
            const headers: Record<string, string> = {};

            // 添加认证头
            if (def.needAuth && config.apiToken) {
                headers['Authorization'] = `Token ${config.apiToken}`;
            }

            let body: string | FormData | undefined;

            // POST/PUT/PATCH 请求添加 body
            if (data !== undefined && ['POST', 'PUT', 'PATCH'].includes(def.method)) {
                if (def.formDataRequest && data instanceof FormData) {
                    // FormData 请求：直接传递 FormData
                    body = data;
                } else {
                    // JSON 请求：设置 Content-Type 并序列化
                    headers['Content-Type'] = 'application/json';
                    body = JSON.stringify(data);
                }
            } else if (!def.formDataRequest) {
                // 非 FormData 请求默认设置 Content-Type
                headers['Content-Type'] = 'application/json';
            }

            // 使用同步请求，请求级配置优先于客户端级配置
            const handler: 响应处理方式 = requestOptions?.responseHandler ?? config.responseHandler ?? 'json';
            return syncFetch({
                method: def.method,
                url,
                headers,
                body,
                responseHandler: handler,
            }) as z.infer<typeof def.zodResponseSchema>;
        };
    }

    // 将同步方法容器挂载到客户端对象上
    Object.defineProperty(client, '$sync', {
        value: syncClient,
        writable: false,
        enumerable: true,
        configurable: false,
    });

    // 类型断言：返回完整客户端类型
    return client as unknown as TResult;
}

/** 创建客户端的英文别名 */
export const createClient = 创建客户端;
