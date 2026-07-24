/** 用途：Zod 泛型约束；使用范围：Router Core Port；解耦评估：纯类型依赖。 */
import type { z } from "zod";
/** 用途：路由层结构；使用范围：路由栈和匹配结果；解耦评估：结构化类型，不依赖 Layer 类。 */
import type { LayerLike } from "./core/layerLike.types";
/** 用途：HTTP 方法字面量；使用范围：HTTP handler 泛型；解耦评估：纯类型依赖。 */
import type { HttpMethod } from "./core/types";
/** 用途：中间件签名；使用范围：注册和 use；解耦评估：纯类型依赖。 */
import type { MiddlewareFunction } from "./core/types";
/** 用途：参数中间件签名；使用范围：参数注册；解耦评估：纯类型依赖。 */
import type { ParamMiddlewareFunction } from "./core/types";
/** 用途：单路由选项；使用范围：注册和 HTTP handler；解耦评估：纯类型依赖。 */
import type { RouteOptions } from "./core/types";
/** 用途：路由器选项；使用范围：结构端口属性；解耦评估：纯类型依赖。 */
import type { RouterOptions } from "./core/types";

/** 路由匹配算法返回的结构化结果。 */
export interface MatchResult {
    path: LayerLike[];
    pathAndMethod: LayerLike[];
    route: boolean;
}

/** 路由注册调用方所需的最小能力。 */
export interface RouterRegistrarPort<
    TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
> {
    register(
        path: string | RegExp | string[],
        methods: string[],
        middleware: MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | MiddlewareFunction<TRequestBodySchema, TResponseBodySchema>[],
        opts?: RouteOptions,
    ): LayerLike | this;
}

/** register 算法读写的路由状态。 */
export interface RouterRegistrationStatePort {
    opts: RouterOptions;
    params: Record<string, ParamMiddlewareFunction>;
    stack: LayerLike[];
}

/** use 算法挂载普通中间件所需的目标能力。 */
export interface RouterMountTargetPort<
    TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
> extends RouterRegistrarPort<TRequestBodySchema, TResponseBodySchema> {
    opts: RouterOptions;
    params: Record<string, ParamMiddlewareFunction>;
    stack: LayerLike[];
}

/** 子路由克隆和参数传播所需的能力。 */
export interface NestedRouterPort {
    stack: LayerLike[];
    param(param: string, middleware: ParamMiddlewareFunction): this;
}

/** 请求分发只依赖匹配能力与分发选项。 */
export interface RouterDispatchPort {
    opts: RouterOptions;
    exclusive: boolean;
    match(path: string, method: string): MatchResult;
    matchHost(input?: string): boolean;
}

/** 中间件携带的结构化子路由。 */
export interface MiddlewareWithRouter {
    router: NestedRouterPort;
}

/** 克隆算法使用的路由结构，与具体 Router 构造器无关。 */
export type CloneRouterType = NestedRouterPort;

/** HTTP 方法处理器，保留调用方具体 Router 的链式返回类型。 */
export type HttpMethodHandler<
    TMethod extends HttpMethod = HttpMethod,
    TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
    TReturn = RouterRegistrarPort<TRequestBodySchema, TResponseBodySchema>,
> = ((
        nameOrPath: string | RegExp | string[] | null,
        pathOrMiddleware: string | RegExp | string[] | MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | MiddlewareFunction<TRequestBodySchema, TResponseBodySchema>[],
        ...rest: Array<MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | RouteOptions>
    ) => TReturn) & { readonly method?: TMethod };
