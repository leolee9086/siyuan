import { use } from "./router.use";
import { routes } from "./router.routes";
import { getAllowedMethods, handleNotImplementedMethod, handleOptionsRequest, handleMethodNotAllowed } from "./router.allowedMethods";
import { createHttpMethodHandler } from "./router.httpMethod";
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
    AllowedMethodsOptions,
    HttpErrors,
    RouteParamType,
    HttpMethod,
} from "./types";
import type { HttpMethodHandler, MiddlewareWithRouter } from "../routerCore.port.types";

const Errors: HttpErrors = {
    /**
     * 创建未实现错误
     * 作用：生成表示功能未实现的错误对象
     * 意图：为HTTP路由器提供标准化的未实现错误
     * 调用时机：当请求的HTTP方法未被实现时调用
     * 问题/改进：当前返回通用Error，可考虑使用专门的HttpError类型
     */
    NotImplemented: () => {
        return new Error("not implemented");
    },
    /**
     * 创建方法不允许错误
     * 作用：生成表示HTTP方法不被允许的错误对象
     * 意图：为HTTP路由器提供标准化的方法不允许错误
     * 调用时机：当请求的HTTP方法不在允许列表中时调用
     * 问题/改进：当前返回通用Error，可考虑使用专门的HttpError类型
     */
    MethodNotAllowed: () => {
        return new Error("method not allowed");
    }
};

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
    public get: HttpMethodHandler<"get", TRequestBodySchema, TResponseBodySchema, this>;
    public post: HttpMethodHandler<"post", TRequestBodySchema, TResponseBodySchema, this>;
    public put: HttpMethodHandler<"put", TRequestBodySchema, TResponseBodySchema, this>;
    public head: HttpMethodHandler<"head", TRequestBodySchema, TResponseBodySchema, this>;
    public delete: HttpMethodHandler<"delete", TRequestBodySchema, TResponseBodySchema, this>;
    public options: HttpMethodHandler<"options", TRequestBodySchema, TResponseBodySchema, this>;
    public trace: HttpMethodHandler<"trace", TRequestBodySchema, TResponseBodySchema, this>;
    public copy: HttpMethodHandler<"copy", TRequestBodySchema, TResponseBodySchema, this>;
    public lock: HttpMethodHandler<"lock", TRequestBodySchema, TResponseBodySchema, this>;
    public mkcol: HttpMethodHandler<"mkcol", TRequestBodySchema, TResponseBodySchema, this>;
    public move: HttpMethodHandler<"move", TRequestBodySchema, TResponseBodySchema, this>;
    public purge: HttpMethodHandler<"purge", TRequestBodySchema, TResponseBodySchema, this>;
    public propfind: HttpMethodHandler<"propfind", TRequestBodySchema, TResponseBodySchema, this>;
    public proppatch: HttpMethodHandler<"proppatch", TRequestBodySchema, TResponseBodySchema, this>;
    public unlock: HttpMethodHandler<"unlock", TRequestBodySchema, TResponseBodySchema, this>;
    public report: HttpMethodHandler<"report", TRequestBodySchema, TResponseBodySchema, this>;
    public mkactivity: HttpMethodHandler<"mkactivity", TRequestBodySchema, TResponseBodySchema, this>;
    public checkout: HttpMethodHandler<"checkout", TRequestBodySchema, TResponseBodySchema, this>;
    public merge: HttpMethodHandler<"merge", TRequestBodySchema, TResponseBodySchema, this>;
    public "m-search": HttpMethodHandler<"m-search", TRequestBodySchema, TResponseBodySchema, this>;
    public notify: HttpMethodHandler<"notify", TRequestBodySchema, TResponseBodySchema, this>;
    public subscribe: HttpMethodHandler<"subscribe", TRequestBodySchema, TResponseBodySchema, this>;
    public unsubscribe: HttpMethodHandler<"unsubscribe", TRequestBodySchema, TResponseBodySchema, this>;
    public patch: HttpMethodHandler<"patch", TRequestBodySchema, TResponseBodySchema, this>;
    public search: HttpMethodHandler<"search", TRequestBodySchema, TResponseBodySchema, this>;
    public connect: HttpMethodHandler<"connect", TRequestBodySchema, TResponseBodySchema, this>;

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
    use(...args: (MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | MiddlewareWithRouter | string[] | string)[]): this {
        use(this, ...args);
        return this;
    }
    /**
     * 动态创建HTTP方法处理器
     * @param method HTTP方法名
     * @returns HTTP方法处理器
     */
    public createHttpMethod<T extends HttpMethod>(method: T): HttpMethodHandler<T, TRequestBodySchema, TResponseBodySchema, this> {
        return createHttpMethodHandler(this, method);
    }
    // 静态url方法
    static url(path: string, ...restArgs: any[]): string {
        const args = Array.prototype.slice.call(restArgs);
        return Layer.prototype.url.apply({ path }, args);
    }
}

export default Router;
