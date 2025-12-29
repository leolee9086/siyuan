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

export type TFetchRequestData = IFetchRequestObject | FormData;

