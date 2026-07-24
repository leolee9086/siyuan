import { use } from "./router.use";
import { routes } from "./router.routes";
import { getAllowedMethods, handleNotImplementedMethod, handleOptionsRequest, handleMethodNotAllowed } from "./router.allowedMethods";
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
} from "./types";
import type { MatchResult, MiddlewareWithRouter } from "../routerCore.port.types";

const Errors: HttpErrors = {
    NotImplemented: () => {
        return new Error("not implemented");
    },
    MethodNotAllowed: () => {
        return new Error("method not allowed");
    }
};

const HttpError = Errors;

function handleAllowedMethodsResponse(ctx: Context, options: AllowedMethodsOptions, implemented: string[]) {
    if (ctx.status && ctx.status !== 404) {
        return;
    }

    const allowedArr = getAllowedMethods(ctx);

    if (!~implemented.indexOf(ctx.method)) {
        handleNotImplementedMethod(ctx, implemented, options, HttpError);
        return;
    }

    if (allowedArr.length === 0) {
        return;
    }

    if (ctx.method === "OPTIONS") {
        handleOptionsRequest(ctx);
        return;
    }

    if (!allowedArr.includes(ctx.method)) {
        handleMethodNotAllowed(ctx, options, HttpError);
    }
}


import { LayerLike } from "./layerLike.types";

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
class baseRouter<
    TRequestBodySchema extends z.ZodTypeAny = z.ZodTypeAny,
    TResponseBodySchema extends z.ZodTypeAny = z.ZodTypeAny
> {
    public opts!: RouterOptions;
    public methods!: string[];
    public exclusive!: boolean;
    public params!: Record<string, ParamMiddlewareFunction>;
    public stack!: LayerLike[];
    public host?: string | RegExp | undefined;

    constructor(opts: RouterOptions = {}) {
        if (!(this instanceof baseRouter)) {
            return new baseRouter(opts);
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
    }


    // use方法
    use(...args: (MiddlewareFunction<TRequestBodySchema, TResponseBodySchema> | MiddlewareWithRouter | string[] | string)[]): this {
        use(this, ...args);
        return this;
    }

    // prefix方法
    prefix(prefix: string): this {
        prefix = prefix.replace(/\/$/, "");
        this.opts.prefix = prefix;
        for (let i = 0; i < this.stack.length; i++) {
            const route = this.stack[i];
            if (route) {
                route.setPrefix(prefix);
            }
        }
        return this;
    }

    // routes/middleware方法
    routes(): MiddlewareFunction {
        return routes(this);
    }
    // allowedMethods方法
    allowedMethods(options: AllowedMethodsOptions = {}): MiddlewareFunction {
        const implemented = this.methods;
        return function allowedMethods(ctx: Context, next: () => Promise<void> | void): Promise<void> | void {
            return Promise.resolve(next()).then(() => handleAllowedMethodsResponse(ctx, options, implemented));
        };
    }
    // all方法
    all(...args: (RouteParamType<TRequestBodySchema, TResponseBodySchema>)[]): this {
        all(this, ...args);
        return this;
    }
    // redirect方法
    redirect(source: string | RegExp, destination: string | symbol, code?: number): this {
        // lookup source route by name
        if (typeof source === "symbol" || (typeof source === "string" && source[0] !== "/")) {
            source = this.resolveRoutePath(source);
        }
        // lookup destination route by name
        if (
            typeof destination === "symbol" ||
            (typeof destination === "string" && destination[0] !== "/" && !destination.includes("://"))
        ) {
            destination = this.resolveRoutePath(destination);
        }
        return this.all(null, source, (ctx: Context) => {
            ctx.redirect?.(destination);
            ctx.status = code || 301;
        });
    }

    resolveRoutePath(path: string | RegExp | symbol): string {
        const result = this.url(path);
        if (result instanceof Error) {
            throw result;
        }
        return result;
    }

    // register方法
    register(path: string | RegExp | string[], methods: string[], middleware: MiddlewareFunction | MiddlewareFunction[], opts: RouteOptions = {}): LayerLike | this {
        return register(this, path, methods, middleware, opts);
    }

    // route方法
    route(name: string | RegExp | symbol): LayerLike | false {
        const routes = this.stack;

        for (let len = routes.length, i = 0; i < len; i++) {
            const route = routes[i];
            if (route && route.name && route.name === name) {
                return route;
            }
        }

        return false;
    }

    // url方法
    url(name: string | RegExp | symbol, params?: Record<string, string | number | boolean> | (string | number | boolean)[], options?: { query?: string | Record<string, string | number | boolean> }): string | Error {
        const route = this.route(name);
        if (route) {
            return route.url(params || {}, options);
        }
        return new Error(`No route found for name: ${String(name)}`);
    }

    // match方法
    match(path: string, method: string): MatchResult {
        return match(this.stack, path, method);
    }

    // matchHost方法
    matchHost(input?: string): boolean {
        const { host } = this;
        if (!host) {
            // 如果没有设置host，则匹配任何host（包括undefined）
            return true;
        }
        if (!input) {
            return false;
        }
        if (typeof host === "string") {
            return input === host;
        }
        if (typeof host === "object" && host instanceof RegExp) {
            return host.test(input);
        }
        return false;
    }

    // param方法
    param(param: string, middleware: ParamMiddlewareFunction): this {
        this.params[param] = middleware;
        for (let i = 0; i < this.stack.length; i++) {
            const route = this.stack[i];
            if (route) {
                route.param(param, middleware);
            }
        }
        return this;
    }


}

export default baseRouter;
