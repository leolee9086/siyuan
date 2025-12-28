/**
 * 客户端工厂 - 核心实现
 * 
 * 通过 TypeScript 类型推断，从 API 定义数组自动生成类型安全的客户端方法，
 * 无需代码生成，运行时创建方法，编译时获得完整类型支持。
 */
import type { z } from 'zod';
import type { Api定义, 客户端配置, Api方法映射 } from './types';

/**
 * 默认配置
 */
const 默认配置: Required<客户端配置> = {
    baseUrl: 'http://127.0.0.1:6806',
    apiToken: '',
    customFetch: globalThis.fetch,
};

/**
 * 创建类型安全的 API 客户端
 * 
 * @param apiDefs - API 定义数组，必须使用 `as const` 保留字面量类型
 * @param options - 客户端配置
 * @returns 类型安全的客户端对象，方法名对应 API 定义中的 `en` 字段
 * 
 * @example
 * ```typescript
 * const client = 创建客户端(accountApiDefs, {
 *   baseUrl: 'http://127.0.0.1:6806',
 *   apiToken: 'your-token',
 * });
 * 
 * // 有完整类型提示！
 * const result = await client.login({
 *   userName: 'test',
 *   userPassword: '123',
 *   captcha: 'xxxx',
 *   cloudRegion: 0,
 * });
 * ```
 */
export function 创建客户端<TDefs extends readonly Api定义[]>(
    apiDefs: TDefs,
    options: 客户端配置 = {}
): Api方法映射<TDefs> {
    const config = { ...默认配置, ...options };

    const client = {} as Record<string, (data?: unknown) => Promise<unknown>>;

    for (const def of apiDefs) {
        client[def.en] = async (data?: unknown) => {
            const url = `${config.baseUrl}${def.endpoint}`;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

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
                fetchOptions.body = JSON.stringify(data);
            }

            const response = await config.customFetch(url, fetchOptions);

            if (!response.ok) {
                throw new Error(
                    `API 请求失败: ${def.method} ${def.endpoint} - ${response.status} ${response.statusText}`
                );
            }

            return response.json() as Promise<z.infer<typeof def.zodResponseSchema>>;
        };
    }

    // 类型断言：返回类型由 Api方法映射 保证
    return client as Api方法映射<TDefs>;
}

/** 创建客户端的英文别名 */
export const createClient = 创建客户端;
