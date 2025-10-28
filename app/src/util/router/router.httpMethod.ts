import type {
    MiddlewareFunction,
    RouteOptions,
    HttpMethod,
} from './types'
import Router from './router'

/**
 * HTTP方法处理函数类型
 */
export type HttpMethodHandler<T extends HttpMethod = HttpMethod> = (
    nameOrPath: string | RegExp | string[] | null,
    pathOrMiddleware: string | RegExp | string[] | MiddlewareFunction | MiddlewareFunction[],
    ...rest: MiddlewareFunction[]
) => Router;

/**
 * 创建HTTP方法处理函数
 * @param router Router实例
 * @param method HTTP方法名
 * @returns HTTP方法处理函数
 */
export function createHttpMethodHandler<T extends HttpMethod>(router: Router, method: T): HttpMethodHandler<T> {
    return (nameOrPath: string | RegExp | string[] | null, pathOrMiddleware: string | RegExp | string[] | MiddlewareFunction | MiddlewareFunction[], ...rest: MiddlewareFunction[]): Router => {
        let actualPath: string | RegExp | string[];
        let actualName: string | null = null;
        let middleware: MiddlewareFunction[];

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
            middleware = rest;
        }
        // 处理普通路由的情况: router.get('/path', middleware)
        else if (isPath(nameOrPath)) {
            actualName = null;
            actualPath = nameOrPath;

            // 处理中间件
            if (isMiddleware(pathOrMiddleware)) {
                middleware = [pathOrMiddleware, ...rest];
            } else if (isMiddlewareArray(pathOrMiddleware)) {
                middleware = [...pathOrMiddleware, ...rest];
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

        router.register(actualPath, [method], middleware, { name: actualName });
        return router;
    };
}