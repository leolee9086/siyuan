import type { RouteParamType } from "./types";
import type { RouterRegistrarPort } from "../routerCore.port.types";
import { z } from "zod";
import { isMiddleware, isMiddlewareArray, isPath } from "./router.guard";
// HTTP方法列表
const methods = [
    "get",
    "post",
    "put",
    "head",
    "delete",
    "options",
    "trace",
    "copy",
    "lock",
    "mkcol",
    "move",
    "purge",
    "propfind",
    "proppatch",
    "unlock",
    "report",
    "mkactivity",
    "checkout",
    "merge",
    "m-search",
    "notify",
    "subscribe",
    "unsubscribe",
    "patch",
    "search",
    "connect"
];





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
    TResponseBodySchema extends z.ZodTypeAny,
    TRouter extends RouterRegistrarPort<TRequestBodySchema, TResponseBodySchema>,
>(
    router: TRouter,
    ...args: (RouteParamType<TRequestBodySchema, TResponseBodySchema>)[]
) {
    // 处理命名路由的情况: router.all('name', '/path', middleware)
    if (args.length >= 2 && isPath(args[1])) {
        const nameOrPath = args[0];
        const pathOrMiddleware = args[1];
        const rest = args.slice(2);

        const actualName = typeof nameOrPath === "string" ? nameOrPath : undefined;
        const actualPath = pathOrMiddleware;
        const middleware = rest.filter(isMiddleware);

        router.register(actualPath, methods, middleware, { name: actualName });
        return router;
    }

    // 处理普通路由的情况: router.all('/path', middleware)
    if (args.length < 1 || !isPath(args[0])) {
        throw new Error("You have to provide a path when adding an all handler");
    }

    const nameOrPath = args[0];
    const rest = args.slice(1);
    const actualPath = nameOrPath;
    // 处理中间件: 单个中间件函数
    if (rest.length > 0 && isMiddleware(rest[0])) {
        const middleware = rest.filter(isMiddleware);
        router.register(actualPath, methods, middleware, { name: undefined });
        return router;
    }

    // 处理中间件: 中间件数组
    if (rest.length > 0 && isMiddlewareArray(rest[0])) {
        const firstMiddlewareArray = rest[0];
        const remainingMiddleware = rest.slice(1).filter(isMiddleware);
        const middleware = [...firstMiddlewareArray, ...remainingMiddleware];
        router.register(actualPath, methods, middleware, { name: undefined });
        return router;
    }

    throw new Error("You have to provide a valid middleware when adding an all handler");
}
