import { use } from "./router.use";
import { routes } from "./router.routes";
import { getAllowedMethods, handleNotImplementedMethod, handleOptionsRequest, handleMethodNotAllowed } from "./router.allowedMethods";
import { createHttpMethodHandler, HttpMethodHandler } from "./router.httpMethod";
import { register } from "./router.register";
import { match } from "./router.match";
import { all } from "./router.all";
import { z } from "zod";
import type {
    Context,
    MiddlewareFunction,
    ParamMiddlewareFunction,
    RouteOptions,
    RouterOptions,
    MatchResult,
    AllowedMethodsOptions,
    HttpErrors,
    RouteParamType,
    MiddlewareWithRouter,
    HttpMethod,
} from "./types";

const Errors: HttpErrors = {
    NotImplemented: () => {
        return new Error("not implemented");
    },
    MethodNotAllowed: () => {
        return new Error("method not allowed");
    }
};

const HttpError = Errors;


import Layer from "./layer";
import { LayerLike } from "./layerLike.types";
import baseRouter from "./router.base";

/**
 * Router class for handling HTTP routing.
 * 
 * @param {Object} opts - Configuration options for the router. 
 * @param {Array} [opts.methods=['HEAD', 'OPTIONS', 'GET', 'PUT', 'PATCH', 'POST', 'DELETE']] - HTTP methods that the router should respond to.
 * @param {boolean} [opts.exclusive=false] - If true, the router will only respond to the most specific matching route for a given URL.
 * @param {Object} [opts.params={}] - An object to hold parameter value functions to be run when a particular parameter is present in the route.
 * @param {Array} [opts.stack=[]] - An array to hold middleware and routes.
 * @param {string} [opts.host] - The host that the router should respond to.
 */
class Router<
    TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny
> extends baseRouter {
    
    // 泛型HTTP方法定义
    public get: HttpMethodHandler<"get", TRequestBodySchema, TResponseBodySchema>;
    public post: HttpMethodHandler<"post", TRequestBodySchema, TResponseBodySchema>;
    public put: HttpMethodHandler<"put", TRequestBodySchema, TResponseBodySchema>;
    public head: HttpMethodHandler<"head", TRequestBodySchema, TResponseBodySchema>;
    public delete: HttpMethodHandler<"delete", TRequestBodySchema, TResponseBodySchema>;
    public options: HttpMethodHandler<"options", TRequestBodySchema, TResponseBodySchema>;
    public trace: HttpMethodHandler<"trace", TRequestBodySchema, TResponseBodySchema>;
    public copy: HttpMethodHandler<"copy", TRequestBodySchema, TResponseBodySchema>;
    public lock: HttpMethodHandler<"lock", TRequestBodySchema, TResponseBodySchema>;
    public mkcol: HttpMethodHandler<"mkcol", TRequestBodySchema, TResponseBodySchema>;
    public move: HttpMethodHandler<"move", TRequestBodySchema, TResponseBodySchema>;
    public purge: HttpMethodHandler<"purge", TRequestBodySchema, TResponseBodySchema>;
    public propfind: HttpMethodHandler<"propfind", TRequestBodySchema, TResponseBodySchema>;
    public proppatch: HttpMethodHandler<"proppatch", TRequestBodySchema, TResponseBodySchema>;
    public unlock: HttpMethodHandler<"unlock", TRequestBodySchema, TResponseBodySchema>;
    public report: HttpMethodHandler<"report", TRequestBodySchema, TResponseBodySchema>;
    public mkactivity: HttpMethodHandler<"mkactivity", TRequestBodySchema, TResponseBodySchema>;
    public checkout: HttpMethodHandler<"checkout", TRequestBodySchema, TResponseBodySchema>;
    public merge: HttpMethodHandler<"merge", TRequestBodySchema, TResponseBodySchema>;
    public "m-search": HttpMethodHandler<"m-search", TRequestBodySchema, TResponseBodySchema>;
    public notify: HttpMethodHandler<"notify", TRequestBodySchema, TResponseBodySchema>;
    public subscribe: HttpMethodHandler<"subscribe", TRequestBodySchema, TResponseBodySchema>;
    public unsubscribe: HttpMethodHandler<"unsubscribe", TRequestBodySchema, TResponseBodySchema>;
    public patch: HttpMethodHandler<"patch", TRequestBodySchema, TResponseBodySchema>;
    public search: HttpMethodHandler<"search", TRequestBodySchema, TResponseBodySchema>;
    public connect: HttpMethodHandler<"connect", TRequestBodySchema, TResponseBodySchema>;

    constructor(opts: RouterOptions = {}) {
        super();
        if (!(this instanceof Router)) {
return new Router(opts);
}

        // 将传入的选项赋值给this.opts
        this.opts = opts;

        // 如果传入的选项中包含methods，则使用传入的methods，否则使用默认的HTTP方法
        this.methods = this.opts.methods || [
            "HEAD",
            "OPTIONS",
            "GET",
            "PUT",
            "PATCH",
            "POST",
            "DELETE"
        ];

        // 如果传入的选项中包含exclusive，则将其转换为布尔值并赋值给this.exclusive
        this.exclusive = Boolean(this.opts.exclusive);
        // 初始化params为空对象
        this.params = {};
        // 初始化stack为空数组
        this.stack = [];
        // 如果传入的选项中包含host，则将其赋值给this.host
        this.host = this.opts.host;
        // 初始化泛型HTTP方法
        this.initializeHttpMethods();
    }
    
    /**
     * 初始化HTTP方法处理器
     */
    private initializeHttpMethods(): void {
        this.get = createHttpMethodHandler(this, "get");
        this.post = createHttpMethodHandler(this, "post");
        this.put = createHttpMethodHandler(this, "put");
        this.head = createHttpMethodHandler(this, "head");
        this.delete = createHttpMethodHandler(this, "delete");
        this.options = createHttpMethodHandler(this, "options");
        this.trace = createHttpMethodHandler(this, "trace");
        this.copy = createHttpMethodHandler(this, "copy");
        this.lock = createHttpMethodHandler(this, "lock");
        this.mkcol = createHttpMethodHandler(this, "mkcol");
        this.move = createHttpMethodHandler(this, "move");
        this.purge = createHttpMethodHandler(this, "purge");
        this.propfind = createHttpMethodHandler(this, "propfind");
        this.proppatch = createHttpMethodHandler(this, "proppatch");
        this.unlock = createHttpMethodHandler(this, "unlock");
        this.report = createHttpMethodHandler(this, "report");
        this.mkactivity = createHttpMethodHandler(this, "mkactivity");
        this.checkout = createHttpMethodHandler(this, "checkout");
        this.merge = createHttpMethodHandler(this, "merge");
        this["m-search"] = createHttpMethodHandler(this, "m-search");
        this.notify = createHttpMethodHandler(this, "notify");
        this.subscribe = createHttpMethodHandler(this, "subscribe");
        this.unsubscribe = createHttpMethodHandler(this, "unsubscribe");
        this.patch = createHttpMethodHandler(this, "patch");
        this.search = createHttpMethodHandler(this, "search");
        this.connect = createHttpMethodHandler(this, "connect");
    }
    
    // use方法
    use(...args: (MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | MiddlewareWithRouter | string[]|string)[]): this {
        use(this, ...args);
        return this;
    }
    /**
     * 动态创建HTTP方法处理器
     * @param method HTTP方法名
     * @returns HTTP方法处理器
     */
    public createHttpMethod<T extends HttpMethod>(method: T): HttpMethodHandler<T> {
        return createHttpMethodHandler(this, method);
    }
      // 静态url方法
    static url(path: string, ...restArgs: any[]): string {
        const args = Array.prototype.slice.call(restArgs);
        return Layer.prototype.url.apply({ path }, args);
    }
}

export default Router;
