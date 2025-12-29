import type { MiddlewareFunction, PathType } from "./types";

/**
 * 检查是否是路径类型
 * @param value 待检查的值
 * @returns 是否是路径类型
 */
export const isPath = (value: unknown): value is PathType => {
    return typeof value === "string" ||
        value instanceof RegExp ||
        (Array.isArray(value) && value.length > 0 && typeof value[0] === "string");
};

/**
 * 检查是否是中间件函数
 * @param value 待检查的值
 * @returns 是否是中间件函数
 */
export const isMiddleware = (value: unknown): value is MiddlewareFunction => {
    return typeof value === "function";
};

/**
 * 检查是否是中间件数组
 * @param value 待检查的值
 * @returns 是否是中间件数组
 */
export const isMiddlewareArray = (value: unknown): value is MiddlewareFunction[] => {
    return Array.isArray(value) && value.length > 0 && typeof value[0] === "function";
};
