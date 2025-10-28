import { z } from 'zod'
import Layer from './layer'
import Router from './router'



// HTTP方法类型
export type HttpMethod =
  | 'get' | 'post' | 'put' | 'head' | 'delete' | 'options'
  | 'trace' | 'copy' | 'lock' | 'mkcol' | 'move' | 'purge'
  | 'propfind' | 'proppatch' | 'unlock' | 'report' | 'mkactivity'
  | 'checkout' | 'merge' | 'm-search' | 'notify' | 'subscribe'
  | 'unsubscribe' | 'patch' | 'search' | 'connect'

// Zod模式定义
export const requestSchema = z.object({
  method: z.string(),
  url: z.string(),
  params: z.record(z.any(), z.any()),
  query: z.record(z.any(), z.any()),
  headers: z.record(z.string(), z.string()),
})

export const responseSchema = z.object({
  status: z.number(),
  body: z.any().optional(),
  headers: z.record(z.string(), z.string()),
  set: z.instanceof(Function),
  redirect: z.instanceof(Function),
})

export const contextSchema = z.object({
  method: z.string(),
  path: z.string(),
  host: z.string().optional(),
  newRouterPath: z.string().optional(),
  routerPath: z.string().optional(),
  routerName: z.string().optional(),
  _matchedRoute: z.string().optional(),
  _matchedRouteName: z.string().optional(),
  matched: z.array(z.any()).optional(),
  router: z.any().optional(),
  request: requestSchema,
  response: responseSchema,
  status: z.number(),
  body: z.any().optional(),
  params: z.record(z.any(), z.any()),
  captures: z.array(z.string()),
  set: z.instanceof(Function),
  redirect: z.instanceof(Function),
})

export const routeOptionsSchema = z.object({
  name: z.string().optional(),
  end: z.boolean().optional(),
  sensitive: z.boolean().optional(),
  strict: z.boolean().optional(),
  prefix: z.string().optional(),
  ignoreCaptures: z.boolean().optional(),
})

export const routerOptionsSchema = z.object({
  methods: z.array(z.string()).optional(),
  exclusive: z.boolean().optional(),
  params: z.record(z.string(), z.function()).optional(),
  stack: z.array(z.any()).optional(),
  host: z.union([z.string(), z.instanceof(RegExp)]).optional(),
  prefix: z.string().optional(),
  sensitive: z.boolean().optional(),
  strict: z.boolean().optional(),
  routerPath: z.string().optional(),
})

// 使用 z.infer 推导类型
export type Request = z.infer<typeof requestSchema>
export type Response = z.infer<typeof responseSchema>
export type Context = z.infer<typeof contextSchema>
export type RouteOptions = z.infer<typeof routeOptionsSchema>
export type RouterOptions = z.infer<typeof routerOptionsSchema>

// 中间件函数类型
export type MiddlewareFunction = (ctx: Context, next: () => Promise<void> | void) => Promise<void> | void

// 参数中间件函数类型
export type ParamMiddlewareFunction = (param: any, ctx: Context, next: () => Promise<void> | void) => Promise<void> | void

// 路由匹配结果类型
export interface MatchResult {
  path: Layer[]
  pathAndMethod: Layer[]
  route: boolean
}

// 错误类型
export interface HttpErrors {
  NotImplemented: () => Error
  MethodNotAllowed: () => Error
}

// 允许的方法选项类型
export interface AllowedMethodsOptions {
  throw?: boolean
  notImplemented?: () => Error
  methodNotAllowed?: () => Error
}

// 静态方法接口
export interface IRouterStatic {
  url(path: string, ...args: any[]): string
}

// 包含路由器的中间件接口
export interface MiddlewareWithRouter {
  /** 路由器实例 */
  router: Router;
}

// 可克隆的路由器类型，扩展了Router接口
export interface CloneRouterType extends Router {
  /** 路由器栈，包含所有层 */
  stack: Layer[];
}

// 路径类型定义
export type PathType = string | RegExp | string[];

// 中间件类型定义
export type MiddlewareType = MiddlewareFunction | MiddlewareFunction[];

// 路由参数类型定义
export type RouteParamType = PathType | MiddlewareType;