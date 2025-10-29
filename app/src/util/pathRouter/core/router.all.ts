import Router from './router.htttpRouter'
import baseRouter from './router.base';
import type { MiddlewareFunction, PathType, RouteParamType } from './types'
import { z } from 'zod'
// HTTP方法列表
const methods = [
    'get',
    'post',
    'put',
    'head',
    'delete',
    'options',
    'trace',
    'copy',
    'lock',
    'mkcol',
    'move',
    'purge',
    'propfind',
    'proppatch',
    'unlock',
    'report',
    'mkactivity',
    'checkout',
    'merge',
    'm-search',
    'notify',
    'subscribe',
    'unsubscribe',
    'patch',
    'search',
    'connect'
];

/**
 * 检查是否是路径类型
 * @param value 待检查的值
 * @returns 是否是路径类型
 */
const isPath = (value: any): value is PathType => {
    return typeof value === 'string' ||
    value instanceof RegExp ||
    (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string');
};

/**
 * 检查是否是中间件函数
 * @param value 待检查的值
 * @returns 是否是中间件函数
 */
const isMiddleware = (value: any): value is MiddlewareFunction => {
    return typeof value === 'function';
};

/**
 * 检查是否是中间件数组
 * @param value 待检查的值
 * @returns 是否是中间件数组
 */
const isMiddlewareArray = (value: any): value is MiddlewareFunction[] => {
    return Array.isArray(value) && value.length > 0 && typeof value[0] === 'function';
};



/**
 * 路由器 all 方法实现
 *
 * 此方法用于注册一个路由处理器，该处理器将响应所有HTTP方法。
 * 支持命名路由和普通路由两种模式。
 *
 * @param {Router} router - 路由器实例
 * @param {string | RegExp | string[] | null} nameOrPath - 路由名称或路径
 * @param {string | RegExp | string[] | MiddlewareFunction | MiddlewareFunction[]} pathOrMiddleware - 路径或中间件函数
 * @param {...MiddlewareFunction[]} rest - 额外的中间件函数
 * @returns {Router} 返回路由器实例，支持链式调用
 *
 * @example
 * ```typescript
 * const router = new Router();
 *
 * // 普通路由：处理所有HTTP方法
 * router.all('/api/data', handler);
 *
 * // 命名路由：为路由指定名称
 * router.all('dataApi', '/api/data', handler);
 *
 * // 多个中间件
 * router.all('/api/data', auth, validation, handler);
 * ```
 */
export function all<
    TRequestBodySchema extends z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny
>(
    router: baseRouter<TRequestBodySchema, TResponseBodySchema>,
    ...args: (RouteParamType<TRequestBodySchema, TResponseBodySchema>)[]
): baseRouter<TRequestBodySchema, TResponseBodySchema> {
    let actualPath: PathType;
    let actualName: string | null = null;
    let middleware: MiddlewareFunction<TRequestBodySchema, TResponseBodySchema>[];

    // 处理命名路由的情况: router.all('name', '/path', middleware)
    if (args.length >= 2 && isPath(args[1])) {
        const nameOrPath = args[0];
        const pathOrMiddleware = args[1];
        const rest = args.slice(2);
        
        actualName = typeof nameOrPath === 'string' ? nameOrPath : null;
        actualPath = pathOrMiddleware;
        middleware = rest.filter(isMiddleware);
    }
    // 处理普通路由的情况: router.all('/path', middleware)
    else if (args.length >= 1 && isPath(args[0])) {
        const nameOrPath = args[0];
        const rest = args.slice(1);
        
        actualName = null;
        actualPath = nameOrPath;

        // 处理中间件
        if (rest.length > 0 && isMiddleware(rest[0])) {
            middleware = rest.filter(isMiddleware);
        } else if (rest.length > 0 && isMiddlewareArray(rest[0])) {
            const firstMiddlewareArray = rest[0] ;
            const remainingMiddleware = rest.slice(1).filter(isMiddleware);
            middleware = [...firstMiddlewareArray, ...remainingMiddleware];
        } else {
            throw new Error('You have to provide a valid middleware when adding an all handler');
        }
    } else {
        throw new Error('You have to provide a path when adding an all handler');
    }

    // Sanity check to ensure we have a viable path candidate (eg: string|regex|non-empty array)
    if (
        typeof actualPath !== 'string' &&
        !(actualPath instanceof RegExp) &&
        (!Array.isArray(actualPath) || actualPath.length === 0)
    )
        throw new Error('You have to provide a path when adding an all handler');
    
    router.register(actualPath, methods, middleware, { name: actualName });
    return router ;
}