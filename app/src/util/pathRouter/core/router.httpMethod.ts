import type {
    MiddlewareFunction,
    RouteOptions,
    HttpMethod,
} from './types'
import Router from './router'
import { z } from 'zod'
 
 /**
  * HTTP方法处理函数类型
  */
 export type HttpMethodHandler<
    T extends HttpMethod = HttpMethod,
    TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny
> = (
    nameOrPath: string | RegExp | string[] | null,
    pathOrMiddleware: string | RegExp | string[] | MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | MiddlewareFunction<TRequestBodySchema, TResponseBodySchema>[],
    ...rest: (MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | RouteOptions)[]
) => Router<TRequestBodySchema, TResponseBodySchema>;
 
 /**
  * 创建HTTP方法处理函数
  * @param router Router实例
  * @param method HTTP方法名
  * @returns HTTP方法处理函数
  */
 export function createHttpMethodHandler<
    T extends HttpMethod,
    TRequestBodySchema extends z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny
>(router: Router<TRequestBodySchema, TResponseBodySchema>, method: T): HttpMethodHandler<T, TRequestBodySchema, TResponseBodySchema> {
    return (nameOrPath: string | RegExp | string[] | null, pathOrMiddleware: string | RegExp | string[] | MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | MiddlewareFunction<TRequestBodySchema, TResponseBodySchema>[], ...rest: (MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | RouteOptions)[]): Router<TRequestBodySchema, TResponseBodySchema> => {
        let actualPath: string | RegExp | string[];
        let actualName: string | null = null;
        let middleware: MiddlewareFunction<TRequestBodySchema, TResponseBodySchema>[];
        let opts: RouteOptions = {};

        // 检查是否是路径类型
        const isPath = (value: any): value is string | RegExp | string[] => {
            return typeof value === 'string' || value instanceof RegExp || (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string');
        };

        // 检查是否是中间件函数
        const isMiddleware = (value: any): value is MiddlewareFunction => {
            return typeof value === 'function';
        };

        // 检查是否是中间件数组
        const isMiddlewareArray = (value: any): value is MiddlewareFunction[] => {
            return Array.isArray(value) && value.length > 0 && typeof value[0] === 'function';
        };

        // 处理命名路由的情况: router.get('name', '/path', middleware)
        if (isPath(pathOrMiddleware)) {
            actualName = typeof nameOrPath === 'string' ? nameOrPath : null;
            actualPath = pathOrMiddleware;
            middleware = rest.filter(isMiddleware) as MiddlewareFunction<TRequestBodySchema, TResponseBodySchema>[];
            opts = rest.find(arg => typeof arg === 'object' && arg !== null && !isMiddleware(arg)) as RouteOptions || {};
        }
        // 处理普通路由的情况: router.get('/path', middleware)
        else if (isPath(nameOrPath)) {
            actualName = null;
            actualPath = nameOrPath;

            const middlewares = [pathOrMiddleware, ...rest].filter(isMiddleware) as MiddlewareFunction<TRequestBodySchema, TResponseBodySchema>[];
            const options = [pathOrMiddleware, ...rest].find(arg => typeof arg === 'object' && arg !== null && !isMiddleware(arg)) as RouteOptions | undefined;

            if (middlewares.length > 0) {
                middleware = middlewares;
                opts = options || {};
            } else {
                throw new Error(`You have to provide a valid middleware when adding a ${method} handler`);
            }
        } else {
            throw new Error(`You have to provide a path when adding a ${method} handler`);
        }

        if (
            typeof actualPath !== 'string' &&
            !(actualPath instanceof RegExp) &&
            (!Array.isArray(actualPath) || actualPath.length === 0)
        ) {
            throw new Error(`You have to provide a path when adding a ${method} handler`);
        }

        router.register(actualPath, [method], middleware, { ...opts, name: actualName });
        return router;
    };
}