import { z } from "zod";




// HTTP方法类型
export type HttpMethod =
  | "get" | "post" | "put" | "head" | "delete" | "options"
  | "trace" | "copy" | "lock" | "mkcol" | "move" | "purge"
  | "propfind" | "proppatch" | "unlock" | "report" | "mkactivity"
  | "checkout" | "merge" | "m-search" | "notify" | "subscribe"
  | "unsubscribe" | "patch" | "search" | "connect"

// 基础值类型定义
const primitiveValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const arrayValue = z.array(primitiveValue);
const value = z.union([primitiveValue, arrayValue]);
const headerValue = z.union([z.string(), z.array(z.string())]);

// 递归的类JSON类型
const jsonLike: z.ZodType<any> = z.lazy(() =>
  z.union([
    primitiveValue,
    z.array(jsonLike),
    z.record(z.string(), jsonLike)
  ])
);

// 基础请求体类型
const baseRequestBodyTypes = z.union([
  z.string(),
  z.instanceof(Buffer),
  z.instanceof(ReadableStream),
  z.instanceof(FormData),
  z.instanceof(URLSearchParams),
  z.null(),
  z.undefined()
]);

// 默认请求体类型
const defaultRequestBodyTypes = z.union([
  baseRequestBodyTypes,
  jsonLike,
]);

// 浏览器特定请求属性
const browserRequestSpecific = z.object({
  cache: z.enum(["default", "no-store", "reload", "no-cache", "force-cache", "only-if-cached"]).optional(),
  credentials: z.enum(["include", "same-origin", "omit"]).optional(),
  integrity: z.string().optional(),
  keepalive: z.boolean().optional(),
  mode: z.enum(["cors", "no-cors", "same-origin", "navigate"]).optional(),
  redirect: z.enum(["manual", "follow", "error"]).optional(),
  referrer: z.string().optional(),
  referrerPolicy: z.string().optional(),
  signal: z.instanceof(AbortSignal).optional(),
});

// Node.js特定请求属性
const nodeRequestSpecific = z.object({
  socket: z.any().optional(),
  connection: z.any().optional(),
  httpVersion: z.string().optional(),
  httpVersionMajor: z.number().optional(),
  httpVersionMinor: z.number().optional(),
  complete: z.boolean().optional(),
  rawHeaders: z.array(z.string()).optional(),
  rawTrailers: z.array(z.string()).optional(),
  trailers: z.record(z.string(), z.string()).optional(),
});

// 请求型对象schema工厂函数 - 支持泛型
export const createRequestLikeSchema = <TBodySchema extends z.ZodTypeAny = z.ZodTypeAny>(
  bodySchema?: TBodySchema
) => z.object({
  // 基础HTTP属性
  method: z.enum(["GET", "POST", "PUT", "HEAD", "DELETE", "OPTIONS", "TRACE", "COPY", "LOCK", "MKCOL", "MOVE", "PURGE", "PROPFIND", "PROPPATCH", "UNLOCK", "REPORT", "MKACTIVITY", "CHECKOUT", "MERGE", "M-SEARCH", "NOTIFY", "SUBSCRIBE", "UNSUBSCRIBE", "PATCH", "SEARCH", "CONNECT"]),
  url: z.string(),
  headers: z.record(z.string(), headerValue),

  // 请求内容 - 使用传入的body schema
  body: bodySchema?.optional(),

  // URL参数和查询参数
  params: z.record(z.string(), value),
  query: z.record(z.string(), value),

  // Cookie支持
  cookies: z.record(z.string(), z.string()).optional(),

  // 通用可选属性
  protocol: z.string().optional(),
  host: z.string().optional(),
  hostname: z.string().optional(),
  port: z.union([z.string(), z.number()]).optional(),
  pathname: z.string().optional(),
  search: z.string().optional(),
  hash: z.string().optional(),

  // 浏览器特定属性（可选）
  ...browserRequestSpecific.partial().shape,

  // Node.js特定属性（可选）
  ...nodeRequestSpecific.partial().shape,
});

// 默认请求型对象schema
export const requestLikeSchema = createRequestLikeSchema(defaultRequestBodyTypes);

// 基础响应体类型
const baseResponseBodyTypes = z.union([
  z.string(),
  z.record(z.string(), value),
  z.array(value),
  z.instanceof(Buffer),
  z.instanceof(ReadableStream),
  z.null(),
  z.undefined()
]);

// 默认响应体类型
const defaultResponseBodyTypes = baseResponseBodyTypes;

// 响应函数类型定义
const responseFunction = z.function().input(z.any()).output(z.any());

// 浏览器特定响应属性
const browserResponseSpecific = z.object({
  bodyUsed: z.boolean().optional(),
  ok: z.boolean().optional(),
  redirected: z.boolean().optional(),
  type: z.enum(["basic", "cors", "default", "error", "opaque", "opaqueredirect"]).optional(),
  url: z.string().optional(),
  statusText: z.string().optional(),
  trailer: z.promise(z.record(z.string(), z.string())).optional(),
});

// Node.js特定响应属性
const nodeResponseSpecific = z.object({
  socket: z.any().optional(),
  connection: z.any().optional(),
  httpVersion: z.string().optional(),
  httpVersionMajor: z.number().optional(),
  httpVersionMinor: z.number().optional(),
  complete: z.boolean().optional(),
  rawHeaders: z.array(z.string()).optional(),
  rawTrailers: z.array(z.string()).optional(),
  trailers: z.record(z.string(), z.string()).optional(),
  sendDate: z.boolean().optional(),
  finished: z.boolean().optional(),
  destroyed: z.boolean().optional(),
  writableEnded: z.boolean().optional(),
  writableFinished: z.boolean().optional(),
});

// 响应型对象schema工厂函数 - 支持泛型
export const createResponseLikeSchema = <TBodySchema extends z.ZodTypeAny = z.ZodTypeAny>(
  bodySchema?: TBodySchema
) => z.object({
  // 基础HTTP响应属性
  status: z.number(),
  headers: z.record(z.string(), headerValue),

  // 响应内容 - 使用传入的body schema
  body: bodySchema?.optional(),

  // 通用响应方法（使用更灵活的函数定义）
  set: responseFunction.optional(),
  get: responseFunction.optional(),
  append: responseFunction.optional(),
  remove: responseFunction.optional(),
  has: responseFunction.optional(),
  redirect: responseFunction.optional(),
  type: responseFunction.optional(),
  length: responseFunction.optional(),
  lastModified: responseFunction.optional(),
  etag: responseFunction.optional(),
  vary: responseFunction.optional(),

  // 通用可选属性
  statusText: z.string().optional(),

  // 浏览器特定属性（可选）
  ...browserResponseSpecific.partial().shape,

  // Node.js特定属性（可选）
  ...nodeResponseSpecific.partial().shape,
});

// 默认响应型对象schema
export const responseLikeSchema = createResponseLikeSchema();

// 上下文函数类型定义
const contextFunction = z.function().input(z.any()).output(z.any());

// 上下文型对象schema工厂函数 - 支持泛型
export const createContextSchema = <
  TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
  TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny
>(
  requestBodySchema?: TRequestBodySchema,
  responseBodySchema?: TResponseBodySchema
) => z.object({
  // 基础路由信息
  method: z.string(),
  path: z.string(),
  host: z.string().optional(),
  protocol: z.string().optional(),
  hostname: z.string().optional(),
  port: z.union([z.string(), z.number()]).optional(),

  // 路由器特定信息
  newRouterPath: z.string().optional(),
  routerPath: z.string().optional(),
  routerName: z.string().optional(),
  _matchedRoute: z.string().optional(),
  _matchedRouteName: z.string().optional(),
  matched: z.array(z.any()).optional(),
  router: z.any().optional(),

  // 请求和响应对象 - 使用传入的schema
  request: createRequestLikeSchema(requestBodySchema),
  response: createResponseLikeSchema(responseBodySchema),

  // 响应状态和内容
  status: z.number(),
  body: responseBodySchema?.optional(),

  // 路由参数
  params: z.record(z.string(), value),
  captures: z.array(z.string()),

  // 上下文方法
  set: contextFunction.optional(),
  get: contextFunction.optional(),
  append: contextFunction.optional(),
  remove: contextFunction.optional(),
  has: contextFunction.optional(),
  redirect: contextFunction.optional(),

  // 状态管理
  state: z.record(z.string(), value).optional(),

  // 错误处理
  error: z.any().optional(),

  // 可选的环境特定属性
  // 浏览器环境
  isSecure: z.boolean().optional(),
  // Node.js环境
  socket: z.any().optional(),
  connection: z.any().optional(),

  //用于调用
  history: z.array(z.any()).optional(),
  currentStep: z.string().optional(),
  previousStep: z.string().optional(),

});

// 默认上下文型对象schema
export const contextSchema = createContextSchema();

export const routeOptionsSchema = z.object({
  name: z.string().optional(),
  end: z.boolean().optional(),
  sensitive: z.boolean().optional(),
  strict: z.boolean().optional(),
  prefix: z.string().optional(),
  ignoreCaptures: z.boolean().optional(),
  schema: z.object({
    request: z.any().optional(),
    response: z.any().optional(),
  }).optional(),
});

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
});

// 使用 z.infer 推导类型
export type Context<
  TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
  TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny
> = InferContext<TRequestBodySchema, TResponseBodySchema>
export type RouteOptions = z.infer<typeof routeOptionsSchema>
export type RouterOptions = z.infer<typeof routerOptionsSchema>


export type InferContext<
  TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
  TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny
> = z.infer<ReturnType<typeof createContextSchema<TRequestBodySchema, TResponseBodySchema>>>

// 导出基础类型定义，方便在其他地方使用
export type RequestBodyTypes = z.infer<typeof defaultRequestBodyTypes>

// 中间件函数类型
export type MiddlewareFunction<
  TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
  TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny
> = (ctx: Context<TRequestBodySchema, TResponseBodySchema>, next: () => Promise<void> | void) => Promise<void> | void

// 参数中间件函数类型
export type ParamMiddlewareFunction = (param: any, ctx: Context, next: () => Promise<void> | void) => Promise<void> | void

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



// 路径类型定义
export type PathType = string | RegExp | string[];

// 中间件类型定义
export type MiddlewareType<
  TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
  TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny
> = MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | MiddlewareFunction<TRequestBodySchema, TResponseBodySchema>[];

export type RouteParamType<
  TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
  TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny
> = PathType | MiddlewareType<TRequestBodySchema, TResponseBodySchema> | null;
