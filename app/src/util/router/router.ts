import { compose } from './routerUtils'
import { use } from './router.use'
import { routes } from './router.routes'
import { getAllowedMethods, handleNotImplementedMethod, handleOptionsRequest, handleMethodNotAllowed } from './router.allowedMethods'
import { createHttpMethodHandler } from './router.httpMethod'
import { register } from './router.register'
import { match } from './router.match'
import { all } from './router.all'
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
} from './types'

const Errors: HttpErrors = {
    NotImplemented: () => {
        return new Error('not implemented')
    },
    MethodNotAllowed: () => {
        return new Error('method not allowed')
    }
}

const HttpError = Errors


import Layer from './layer'

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
class Router {
    public opts: RouterOptions
    public methods: string[]
    public exclusive: boolean
    public params: Record<string, ParamMiddlewareFunction>
    public stack: any[]
    public host?: string | RegExp

    constructor(opts: RouterOptions = {}) {
        if (!(this instanceof Router)) return new Router(opts);

        // 将传入的选项赋值给this.opts
        this.opts = opts;

        // 如果传入的选项中包含methods，则使用传入的methods，否则使用默认的HTTP方法
        this.methods = this.opts.methods || [
            'HEAD',
            'OPTIONS',
            'GET',
            'PUT',
            'PATCH',
            'POST',
            'DELETE'
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
    use(...args: (MiddlewareFunction | MiddlewareWithRouter | string[]|string)[]): Router {
        return use(this, ...args);
    }

    // prefix方法
    prefix(prefix: string): this {
        prefix = prefix.replace(/\/$/, '');

        this.opts.prefix = prefix;

        for (let i = 0; i < this.stack.length; i++) {
            const route = this.stack[i];
            route.setPrefix(prefix);
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
            return Promise.resolve(next()).then(function () {
                if (!ctx.status || ctx.status === 404) {
                    const allowedArr = getAllowedMethods(ctx);

                    if (!~implemented.indexOf(ctx.method)) {
                        handleNotImplementedMethod(ctx, implemented, options, HttpError);
                    } else if (allowedArr.length > 0) {
                        if (ctx.method === 'OPTIONS') {
                            handleOptionsRequest(ctx);
                        } else if (!allowedArr.includes(ctx.method)) {
                            handleMethodNotAllowed(ctx, options, HttpError);
                        }
                    }
                }
            });
        };
    }

    // all方法
    all(...args: (RouteParamType)[]): this {
        return all(this, ...args);
    }

    // redirect方法
    redirect(source: string | RegExp, destination: string | symbol, code?: number): this {
        // lookup source route by name
        if (typeof source === 'symbol' || (typeof source === 'string' && source[0] !== '/')) {
            const sourceResult = this.url(source);
            if (sourceResult instanceof Error) throw sourceResult;
            source = sourceResult;
        }
        // lookup destination route by name
        if (
            typeof destination === 'symbol' ||
            (typeof destination === 'string' && destination[0] !== '/' && !destination.includes('://'))
        ) {
            const destResult = this.url(destination);
            if (destResult instanceof Error) throw destResult;
            destination = destResult;
        }
        return this.all(null, source, (ctx: Context) => {
            ctx.redirect(destination);
            ctx.status = code || 301;
        });
    }

    // register方法
    register(path: string | RegExp | string[], methods: string[], middleware: MiddlewareFunction | MiddlewareFunction[], opts: RouteOptions = {}): Layer | this {
        return register(this, path, methods, middleware, opts);
    }

    // route方法
    route(name: string | RegExp | symbol): Layer | false {
        const routes = this.stack;

        for (let len = routes.length, i = 0; i < len; i++) {
            if (routes[i].name && routes[i].name === name) return routes[i];
        }

        return false;
    }

    // url方法
    url(name: string | RegExp | symbol, ...args: any): string | Error {
        const route = this.route(name);
        if (route) return route.url.apply(route, args);

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
            return input !== undefined;
        }

        if (!input) {
            return false;
        }

        if (typeof host === 'string') {
            return input === host;
        }

        if (typeof host === 'object' && host instanceof RegExp) {
            return host.test(input);
        }
    }

    // param方法
    param(param: string, middleware: ParamMiddlewareFunction): this {
        this.params[param] = middleware;
        for (let i = 0; i < this.stack.length; i++) {
            const route = this.stack[i];
            route.param(param, middleware);
        }
        return this;
    }

    // 静态url方法
    static url(path: string, ...restArgs: any[]): string {
        const args = Array.prototype.slice.call(restArgs);
        return Layer.prototype.url.apply({ path }, args);
    }




    // HTTP方法定义
    get = createHttpMethodHandler(this, 'get');
    post = createHttpMethodHandler(this, 'post');
    put = createHttpMethodHandler(this, 'put');
    head = createHttpMethodHandler(this, 'head');
    delete = createHttpMethodHandler(this, 'delete');
    options = createHttpMethodHandler(this, 'options');
    trace = createHttpMethodHandler(this, 'trace');
    copy = createHttpMethodHandler(this, 'copy');
    lock = createHttpMethodHandler(this, 'lock');
    mkcol = createHttpMethodHandler(this, 'mkcol');
    move = createHttpMethodHandler(this, 'move');
    purge = createHttpMethodHandler(this, 'purge');
    propfind = createHttpMethodHandler(this, 'propfind');
    proppatch = createHttpMethodHandler(this, 'proppatch');
    unlock = createHttpMethodHandler(this, 'unlock');
    report = createHttpMethodHandler(this, 'report');
    mkactivity = createHttpMethodHandler(this, 'mkactivity');
    checkout = createHttpMethodHandler(this, 'checkout');
    merge = createHttpMethodHandler(this, 'merge');
    ['m-search'] = createHttpMethodHandler(this, 'm-search');
    notify = createHttpMethodHandler(this, 'notify');
    subscribe = createHttpMethodHandler(this, 'subscribe');
    unsubscribe = createHttpMethodHandler(this, 'unsubscribe');
    patch = createHttpMethodHandler(this, 'patch');
    search = createHttpMethodHandler(this, 'search');
    connect = createHttpMethodHandler(this, 'connect');

}

export default Router;
