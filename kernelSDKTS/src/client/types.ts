/**
 * 客户端相关类型定义
 */
import type { z } from 'zod';

/**
 * 客户端配置选项
 */
export interface 客户端配置 {
    /** 服务器基础 URL，默认 http://127.0.0.1:6806 */
    baseUrl?: string;
    /** API 认证令牌 */
    apiToken?: string;
    /** 自定义 fetch 实现，用于测试或特殊环境 */
    customFetch?: typeof fetch;
}

/** 客户端配置的英文别名 */
export type ClientOptions = 客户端配置;

/**
 * 单个 API 定义的结构
 */
export interface Api定义 {
    /** HTTP 方法 */
    readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    /** API 端点路径 */
    readonly endpoint: string;
    /** 英文方法名 (用作客户端方法名) */
    readonly en: string;
    /** 中文名称 */
    readonly zh_cn?: string;
    /** 描述 */
    readonly description?: string;
    /** 是否需要认证 */
    readonly needAuth?: boolean;
    /** 是否需要管理员权限 */
    readonly needAdminRole?: boolean;
    /** 只读模式下不可用 */
    readonly unavailableIfReadonly?: boolean;
    /** 是否已废弃 */
    readonly deprecated?: boolean;
    /** 是否为 FormData 请求 (multipart/form-data) */
    readonly formDataRequest?: boolean;
    /** 请求参数 Zod Schema */
    readonly zodRequestSchema: z.ZodType<unknown>;
    /** 响应数据 Zod Schema */
    readonly zodResponseSchema: z.ZodType<unknown>;

    // ========== 核对追踪字段 ==========
    /** 
     * 上次核对日期 (ISO 格式: "2025-12-28")
     * undefined = 从未核对过 (最高优先级)
     */
    readonly lastVerified?: string;
}

/** Api定义的英文别名 */
export type ApiDef = Api定义;

/**
 * 从 Zod Schema 推断请求类型
 */
export type 推断请求类型<T extends Api定义> = z.infer<T['zodRequestSchema']>;
export type InferRequest<T extends Api定义> = 推断请求类型<T>;

/**
 * 从 Zod Schema 推断响应类型
 */
export type 推断响应类型<T extends Api定义> = z.infer<T['zodResponseSchema']>;
export type InferResponse<T extends Api定义> = 推断响应类型<T>;

/**
 * 从 API 定义数组生成方法类型映射
 * 这是实现类型安全客户端的核心类型工具
 */
export type Api方法映射<TDefs extends readonly Api定义[]> = {
    [K in TDefs[number]['en']]: (
        data: 推断请求类型<Extract<TDefs[number], { en: K }>>
    ) => Promise<推断响应类型<Extract<TDefs[number], { en: K }>>>;
};

export type ApiMethods<TDefs extends readonly Api定义[]> = Api方法映射<TDefs>;
