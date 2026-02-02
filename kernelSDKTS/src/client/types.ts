/**
 * 客户端相关类型定义
 */
import type { z } from 'zod';
import type { SyncRawResponse } from '../utils/syncFetch';

/**
 * 响应处理方式类型
 */
export type 响应处理方式 = 'json' | 'blob' | 'text' | 'arrayBuffer' | 'raw';
export type ResponseHandler = 响应处理方式;

/**
 * 异步请求的原始响应类型
 * 当 responseHandler 为 'raw' 时，异步方法返回此类型
 */
export type AsyncRawResponse = Response;

/** AsyncRawResponse 的中文别名 */
export type 异步原始响应 = AsyncRawResponse;

/**
 * 根据 responseHandler 推断响应类型的条件类型
 *
 * @template THandler - responseHandler 的值类型
 * @template TDefault - 默认响应类型（当 handler 为 'json' 或未指定时使用）
 *
 * @example
 * ```typescript
 * // 当 responseHandler 为 'raw' 时，返回 Response
 * type RawResult = ResponseByHandler<'raw', { code: number }>; // Response
 *
 * // 当 responseHandler 为 'text' 时，返回 string
 * type TextResult = ResponseByHandler<'text', { code: number }>; // string
 *
 * // 当 responseHandler 为 'json' 或未指定时，返回默认类型
 * type JsonResult = ResponseByHandler<'json', { code: number }>; // { code: number }
 * ```
 */
export type ResponseByHandler<THandler, TDefault> =
    THandler extends 'raw' ? AsyncRawResponse :
    THandler extends 'text' ? string :
    THandler extends 'blob' ? Blob :
    THandler extends 'arrayBuffer' ? ArrayBuffer :
    TDefault;

/** ResponseByHandler 的中文别名 */
export type 根据处理器推断响应<THandler, TDefault> = ResponseByHandler<THandler, TDefault>;

/**
 * 根据 responseHandler 推断同步响应类型的条件类型
 *
 * @template THandler - responseHandler 的值类型
 * @template TDefault - 默认响应类型（当 handler 为 'json' 或未指定时使用）
 */
export type SyncResponseByHandler<THandler, TDefault> =
    THandler extends 'raw' ? SyncRawResponse :
    THandler extends 'text' ? string :
    THandler extends 'blob' ? Blob :
    THandler extends 'arrayBuffer' ? never : // 同步请求不支持 arrayBuffer
    TDefault;

/** SyncResponseByHandler 的中文别名 */
export type 根据处理器推断同步响应<THandler, TDefault> = SyncResponseByHandler<THandler, TDefault>;

/**
 * 请求级配置选项（泛型版本）
 * 用于在单个 API 调用时覆盖客户端级配置
 *
 * @template THandler - responseHandler 的字面量类型，用于类型推断
 */
export interface 请求配置<THandler extends 响应处理方式 = 响应处理方式> {
    /** 响应处理方式，覆盖客户端级配置 */
    responseHandler?: THandler;
}

/** 请求配置的英文别名 */
export type RequestOptions<THandler extends ResponseHandler = ResponseHandler> = 请求配置<THandler>;

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
    /** 默认响应处理方式，决定如何解析 HTTP 响应体 @default 'json' */
    responseHandler?: 响应处理方式;
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
 * 根据 API 定义推断请求参数类型
 * 对于 formDataRequest: true 的 API，支持 FormData | 原始对象类型
 *
 * @template T - API 定义类型
 *
 * @example
 * ```typescript
 * // 对于普通 API，参数类型为 Zod Schema 推断的对象类型
 * type NormalParams = FormDataAwareRequest<typeof normalApiDef>; // { path: string }
 *
 * // 对于 formDataRequest: true 的 API，参数类型为 FormData | 对象类型
 * type FormDataParams = FormDataAwareRequest<typeof putFileDef>; // FormData | { path: string; ... }
 * ```
 */
export type FormDataAwareRequest<T extends Api定义> =
    T extends { formDataRequest: true }
        ? FormData | 推断请求类型<T>
        : 推断请求类型<T>;

/** FormDataAwareRequest 的中文别名 */
export type 表单感知请求类型<T extends Api定义> = FormDataAwareRequest<T>;

/**
 * 从 Zod Schema 推断响应类型
 */
export type 推断响应类型<T extends Api定义> = z.infer<T['zodResponseSchema']>;
export type InferResponse<T extends Api定义> = 推断响应类型<T>;

/**
 * 客户端配置属性
 * 包含在客户端对象上暴露的配置信息
 */
export interface 客户端配置属性 {
    /** 服务器基础 URL */
    readonly baseUrl: string;
    /** API 认证令牌 */
    readonly apiToken: string;
}

/**
 * 从 API 定义数组生成方法类型映射（异步版本）
 * 这是实现类型安全客户端的核心类型工具
 * 每个方法是泛型函数，支持根据 responseHandler 推断返回类型
 *
 * @example
 * ```typescript
 * // 默认返回 API 定义的响应类型
 * const result = await client.getFile({ path: '/test.md' });
 * // result 类型: { code: number; msg: string; data: ... }
 *
 * // 使用 raw 返回原始 Response
 * const rawResult = await client.getFile({ path: '/test.md' }, { responseHandler: 'raw' });
 * // rawResult 类型: Response
 * ```
 */
export type Api方法映射<TDefs extends readonly Api定义[]> = {
    [K in TDefs[number]['en']]: <THandler extends 响应处理方式 = 'json'>(
        data: FormDataAwareRequest<Extract<TDefs[number], { en: K }>>,
        options?: 请求配置<THandler>
    ) => Promise<ResponseByHandler<THandler, 推断响应类型<Extract<TDefs[number], { en: K }>>>>;
} & 客户端配置属性;

export type ApiMethods<TDefs extends readonly Api定义[]> = Api方法映射<TDefs>;

/**
 * 从 API 定义数组生成方法类型映射（同步版本）
 * 同步版本的方法返回实际值而不是 Promise
 * 每个方法是泛型函数，支持根据 responseHandler 推断返回类型
 *
 * @example
 * ```typescript
 * // 默认返回 API 定义的响应类型
 * const result = client.$sync.getFile({ path: '/test.md' });
 * // result 类型: { code: number; msg: string; data: ... }
 *
 * // 使用 raw 返回 SyncRawResponse
 * const rawResult = client.$sync.getFile({ path: '/test.md' }, { responseHandler: 'raw' });
 * // rawResult 类型: SyncRawResponse (包含 status, headers 等)
 * ```
 */
export type 同步Api方法映射<TDefs extends readonly Api定义[]> = {
    [K in TDefs[number]['en']]: <THandler extends 响应处理方式 = 'json'>(
        data: FormDataAwareRequest<Extract<TDefs[number], { en: K }>>,
        options?: 请求配置<THandler>
    ) => SyncResponseByHandler<THandler, 推断响应类型<Extract<TDefs[number], { en: K }>>>;
};

export type SyncApiMethods<TDefs extends readonly Api定义[]> = 同步Api方法映射<TDefs>;

/**
 * 完整客户端类型（包含异步方法和 $sync 同步方法）
 */
export type 完整客户端<TDefs extends readonly Api定义[]> = Api方法映射<TDefs> & {
    /** 同步方法访问器 - 通过 .sync.方法名 进行同步调用 */
    $sync: 同步Api方法映射<TDefs>;
};

export type FullClient<TDefs extends readonly Api定义[]> = 完整客户端<TDefs>;
