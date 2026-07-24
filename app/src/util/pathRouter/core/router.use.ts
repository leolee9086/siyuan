import Layer from "./layer";
import {pathToRegexp, Key} from "path-to-regexp";
import type { MiddlewareFunction } from "./types";
import type { CloneRouterType, MiddlewareWithRouter, RouterMountTargetPort } from "../routerCore.port.types";
import { z } from "zod";
import { LayerLike } from "./layerLike.types";

/**
 * 克隆路由器的层并设置前缀
 *
 * 此函数用于将一个路由器的所有层克隆到另一个路由器中，并可选地设置路径前缀。
 * 克隆过程中会保持层的原型链，确保方法调用正确。
 *
 * @param {CloneRouterType} cloneRouter - 要被克隆的源路由器
 * @param {Router} router - 目标路由器，克隆的层将被添加到此路由器
 * @param {string} [path] - 可选的路径前缀，如果提供则设置到每个克隆的层上
 * @returns {void}
 *
 * @example
 * ```typescript
 * const sourceRouter = new Router();
 * const targetRouter = new Router();
 * cloneRouterLayers(sourceRouter, targetRouter, '/api');
 * // 现在 targetRouter 包含了 sourceRouter 的所有层，并且每个层都有 '/api' 前缀
 * ```
 */
function cloneRouterLayers<
    TRequestBodySchema extends z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny,
>(cloneRouter: CloneRouterType, router: RouterMountTargetPort<TRequestBodySchema, TResponseBodySchema>, path?: string): void {
    for (let j = 0; j < cloneRouter.stack.length; j++) {
        const nestedLayer = cloneRouter.stack[j];
        const cloneLayer = Object.assign(
            Object.create(Layer.prototype),
            nestedLayer
        );
        if (path) {
cloneLayer.setPrefix(path);
}
        if (router.opts.prefix) {
cloneLayer.setPrefix(router.opts.prefix);
}
        router.stack.push(cloneLayer);
        cloneRouter.stack[j] = cloneLayer;
    }
}

/**
 * 设置路由器参数
 *
 * 将源路由器的参数设置复制到目标路由器中。参数通常用于路由匹配时的参数处理。
 *
 * @param {CloneRouterType} cloneRouter - 目标路由器，参数将被设置到此路由器
 * @param {Router} router - 源路由器，从中获取参数设置
 * @returns {void}
 *
 * @example
 * ```typescript
 * const sourceRouter = new Router();
 * sourceRouter.param('id', (req, res, next, id) => {
 *   // 参数处理逻辑
 * });
 * const targetRouter = new Router();
 * setRouterParams(targetRouter, sourceRouter);
 * // 现在 targetRouter 也有了相同的 'id' 参数处理
 * ```
 */
function setRouterParams<
    TRequestBodySchema extends z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny
>(cloneRouter: CloneRouterType, router: RouterMountTargetPort<TRequestBodySchema, TResponseBodySchema>): void {
    if (router.params) {
        const paramKeys = Object.keys(router.params);
        for (const key of paramKeys) {
            cloneRouter.param(key, router.params[key]);
        }
    }
}

/**
 * 处理包含路由器的中间件
 *
 * 当中间件包含路由器时，此函数会克隆该路由器的所有层和参数，
 * 并将它们合并到目标路由器中，同时应用指定的路径前缀。
 *
 * @param {MiddlewareWithRouter} m - 包含路由器的中间件对象
 * @param {Router} router - 目标路由器，中间件将被合并到此路由器
 * @param {string} [path] - 可选的路径前缀，应用于所有合并的层
 * @returns {void}
 *
 * @example
 * ```typescript
 * const subRouter = new Router();
 * subRouter.get('/users', handler);
 * const middleware = { router: subRouter };
 * const mainRouter = new Router();
 * handleMiddlewareRouter(middleware, mainRouter, '/api');
 * // 现在 mainRouter 处理 '/api/users' 路径
 * ```
 */
function handleMiddlewareRouter<
    TRequestBodySchema extends z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny
>(m: MiddlewareWithRouter, router: RouterMountTargetPort<TRequestBodySchema, TResponseBodySchema>, path?: string): void {
    const cloneRouter = Object.assign(
        Object.create(Object.getPrototypeOf(m.router)),
        m.router,
        {
            stack: [...m.router.stack]
        }
    ) ;
    
    cloneRouterLayers(cloneRouter, router, path);
    setRouterParams(cloneRouter, router);
}

/**
 * 处理普通中间件函数
 *
 * 将普通的中间件函数注册到路由器中，支持路径匹配和参数捕获。
 * 根据路由器前缀和提供的路径参数决定是否忽略捕获组。
 *
 * @param {MiddlewareFunction} m - 要注册的中间件函数
 * @param {Router} router - 目标路由器，中间件将被注册到此路由器
 * @param {string} [path] - 可选的路径模式，如果未提供则使用默认模式
 * @param {boolean} [hasPath] - 指示是否显式提供了路径参数
 * @returns {void}
 *
 * @example
 * ```typescript
 * const router = new Router();
 * const logger = (req, res, next) => {
 *   console.log('Request received');
 *   next();
 * };
 * handleRegularMiddleware(logger, router, '/admin', true);
 * // logger 中间件现在处理 '/admin' 路径的请求
 * ```
 */
function handleRegularMiddleware<
    TRequestBodySchema extends z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny
>(m: MiddlewareFunction<TRequestBodySchema, TResponseBodySchema>, router: RouterMountTargetPort<TRequestBodySchema, TResponseBodySchema>, path?: string, hasPath?: boolean): void {
    const keys: Key[] = [];
    pathToRegexp(router.opts.prefix || "", keys);
    const routerPrefixHasParam = router.opts.prefix && keys.length;
    router.register(path || "([^/]*)", [], m , {
        end: false,
        ignoreCaptures: !hasPath && !routerPrefixHasParam
    });
}

/**
 * 路由器中间件使用函数
 *
 * 这是路由器的核心中间件注册函数，支持多种使用方式：
 * 1. 注册单个中间件到默认路径
 * 2. 注册中间件到指定路径
 * 3. 批量注册中间件到多个路径
 * 4. 注册包含路由器的中间件
 *
 * @param {Router} router - 目标路由器实例
 * @param {...(MiddlewareFunction | MiddlewareWithRouter | string[])} args - 中间件参数，可以是：
 *   - 中间件函数
 *   - 包含路由器的中间件对象
 *   - 路径字符串数组（用于批量注册）
 * @returns {Router} 返回路由器实例，支持链式调用
 *
 * @example
 * ```typescript
 * const router = new Router();
 *
 * // 基本用法：注册中间件到默认路径
 * router.use(logger);
 *
 * // 注册中间件到指定路径
 * router.use('/admin', authMiddleware, adminHandler);
 *
 * // 批量注册到多个路径
 * router.use(['/api/v1', '/api/v2'], apiMiddleware);
 *
 * // 注册子路由器
 * router.use('/users', { router: userRouter });
 * ```
 */
export function use<
    TRequestBodySchema extends z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny,
    TRouter extends RouterMountTargetPort<TRequestBodySchema, TResponseBodySchema>,
>(router: TRouter, ...args: (MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | MiddlewareWithRouter | string[]|string)[]) {
    const middleware = Array.prototype.slice.call(args);
    let path;
    if (Array.isArray(middleware[0]) && typeof middleware[0][0] === "string") {
        const arrPaths = middleware[0];
        for (const p of arrPaths) {
            use(router, p, ...middleware.slice(1));
        }
        return router;
    }
    const hasPath = typeof middleware[0] === "string";
    if (hasPath) {
path = middleware.shift();
}
    
    for (const m of middleware) {
        if (m.router) {
            handleMiddlewareRouter(m , router, path);
        } else {
            handleRegularMiddleware(m , router, path, hasPath);
        }
    }

    return router;
}
