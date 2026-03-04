/**
 * fetch 模块的请求数据类型
 * 用于替代 any 类型，提供更好的类型安全性
 */

/**
 * 通用的请求数据对象接口
 * 包含已知的可选属性，同时允许扩展其他属性
 */
export interface IFetchRequestObject {
    /** 请求 ID，用于请求追踪 */
    reqId?: number;
    /** 类型标识 */
    type?: string;
    /** 错误时是否退出 */
    errorExit?: boolean;
    /** 允许其他任意属性 */
    [key: string]: unknown;
}

/**
 * fetch 请求数据类型联合
 *
 * 用途：表示 fetchPost 等函数接受的请求数据
 * 使用场景：所有 HTTP POST 请求的 body 数据
 * 关联类型：IFetchRequestObject（普通对象）、FormData（文件上传）
 */
export type TFetchRequestData = IFetchRequestObject | FormData;

/**
 * 请求上下文对象，用于在中间件之间传递和修改请求数据
 *
 * 用途：在请求发送前的中间件管道中传递状态
 * 使用场景：injectReqIdMiddleware、serializeRequestDataMiddleware 等中间件
 */
export interface FetchContext {
    url: string;
    data: TFetchRequestData | undefined;
    serializedBody: string | FormData | null;
}

/**
 * 中间件函数签名
 *
 * 用途：定义请求前处理中间件的统一接口
 * 使用场景：所有需要在请求发送前修改上下文的中间件函数
 */
export type FetchMiddleware = (ctx: FetchContext) => void;

