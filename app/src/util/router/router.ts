import { pathToRegexp } from 'path-to-regexp'
import { compose } from './routerUtils'
import type {
    Context,
    MiddlewareFunction,
    ParamMiddlewareFunction,
    RouteOptions,
    RouterOptions,
    MatchResult,
    AllowedMethodsOptions,
    HttpErrors,
} from './types.js'

const Errors: HttpErrors = {
    NotImplemented: () => {
        return new Error('not implemented')
    },
    MethodNotAllowed: () => {
        return new Error('method not allowed')
    }
}

const HttpError = Errors

const methods = [
    'get',
    'post',
    'put',
    'head',
    'delete',
    'options',
    'trace',
    'copy',
    'lock',
    'mkcol',
    'move',
    'purge',
    'propfind',
    'proppatch',
    'unlock',
    'report',
    'mkactivity',
    'checkout',
    'merge',
    'm-search',
    'notify',
    'subscribe',
    'unsubscribe',
    'patch',
    'search',
    'connect'
];

import Layer from './layer'

const debug = (...args: any[]) => {
    //    console.log(...args)
}

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
    use(...args: any[]): this {
        const router = this;
        const middleware = Array.prototype.slice.call(args);
        let path;
        if (Array.isArray(middleware[0]) && typeof middleware[0][0] === 'string') {
            const arrPaths = middleware[0];
            for (const p of arrPaths) {
                router.use.apply(router, [p].concat(middleware.slice(1)));
            }
            return this;
        }
        const hasPath = typeof middleware[0] === 'string';
        if (hasPath) path = middleware.shift();
        for (const m of middleware) {
            if (m.router) {
                const cloneRouter = Object.assign(
                    Object.create(new Router()),
                    m.router,
                    {
                        stack: [...m.router.stack]
                    }
                );
                for (let j = 0; j < cloneRouter.stack.length; j++) {
                    const nestedLayer = cloneRouter.stack[j];
                    const cloneLayer = Object.assign(
                        Object.create(Layer.prototype),
                        nestedLayer
                    );
                    if (path) cloneLayer.setPrefix(path);
                    if (router.opts.prefix) cloneLayer.setPrefix(router.opts.prefix);
                    router.stack.push(cloneLayer);
                    cloneRouter.stack[j] = cloneLayer;
                }

                if (router.params) {
                    function setRouterParams(paramArr: string[]) {
                        const routerParams = paramArr;
                        for (const key of routerParams) {
                            cloneRouter.param(key, router.params[key]);
                        }
                    }

                    setRouterParams(Object.keys(router.params));
                }
            } else {
                const keys: any[] = [];
                pathToRegexp(router.opts.prefix || '', keys);
                const routerPrefixHasParam = router.opts.prefix && keys.length;
                router.register(path || '(.*)', [], m, {
                    end: false,
                    ignoreCaptures: !hasPath && !routerPrefixHasParam
                });
            }
        }

        return this;
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
        const router = this;

        const dispatch = function dispatch(ctx: Context, next: () => Promise<void> | void): Promise<void> | void {
            debug('%s %s', ctx.method, ctx.path);

            const hostMatched = router.matchHost(ctx.host);

            if (!hostMatched) {
                return next();
            }

            const path =
                router.opts.routerPath || ctx.newRouterPath || ctx.path || ctx.routerPath;
            const matched = router.match(path, ctx.method);
            let layerChain;

            if (ctx.matched) {
                ctx.matched.push.apply(ctx.matched, matched.path);
            } else {
                ctx.matched = matched.path;
            }

            ctx.router = router;

            if (!matched.route) return next();

            const matchedLayers = matched.pathAndMethod;
            const mostSpecificLayer = matchedLayers[matchedLayers.length - 1];
            ctx._matchedRoute = typeof mostSpecificLayer.path === 'string' ? mostSpecificLayer.path : mostSpecificLayer.path.toString();
            if (mostSpecificLayer.name) {
                ctx._matchedRouteName = mostSpecificLayer.name;
            }

            layerChain = (
                router.exclusive ? [mostSpecificLayer] : matchedLayers
            ).reduce(function (memo, layer) {
                memo.push(function (ctx: Context, next: () => Promise<void> | void) {
                    ctx.captures = layer.captures(path);
                    ctx.params = ctx.request.params = layer.params(
                        path,
                        ctx.captures,
                        ctx.params
                    );
                    ctx.routerPath = typeof layer.path === 'string' ? layer.path : layer.path.toString();
                    ctx.routerName = layer.name;
                    ctx._matchedRoute = typeof layer.path === 'string' ? layer.path : layer.path.toString();
                    if (layer.name) {
                        ctx._matchedRouteName = layer.name;
                    }

                    return next();
                });
                return memo.concat(layer.stack);
            }, []);

            return compose(layerChain)(ctx, next);
        };
        dispatch.router = this;
        return dispatch;
    }


    // allowedMethods方法
    allowedMethods(options: AllowedMethodsOptions = {}): MiddlewareFunction {
        const implemented = this.methods;
        return function allowedMethods(ctx: Context, next: () => Promise<void> | void): Promise<void> | void {
            return Promise.resolve(next()).then(function () {
                const allowed: Record<string, string> = {};
                if (!ctx.status || ctx.status === 404) {
                    for (let i = 0; i < ctx.matched.length; i++) {
                        const route = ctx.matched[i];
                        for (let j = 0; j < route.methods.length; j++) {
                            const method = route.methods[j];
                            allowed[method] = method;
                        }
                    }
                    const allowedArr = Object.keys(allowed);
                    if (!~implemented.indexOf(ctx.method)) {
                        if (options.throw) {
                            const notImplementedThrowable =
                                typeof options.notImplemented === 'function'
                                    ? options.notImplemented() // set whatever the user returns from their function
                                    : HttpError.NotImplemented();

                            throw notImplementedThrowable;
                        } else {
                            ctx.status = 501;
                            ctx.set('Allow', allowedArr.join(', '));
                        }
                    } else if (allowedArr.length > 0) {
                        if (ctx.method === 'OPTIONS') {
                            ctx.status = 200;
                            ctx.body = '';
                            ctx.set('Allow', allowedArr.join(', '));
                        } else if (!allowed[ctx.method]) {
                            if (options.throw) {
                                const notAllowedThrowable =
                                    typeof options.methodNotAllowed === 'function'
                                        ? options.methodNotAllowed() // set whatever the user returns from their function
                                        : HttpError.MethodNotAllowed();

                                throw notAllowedThrowable;
                            } else {
                                ctx.status = 405;
                                ctx.set('Allow', allowedArr.join(', '));
                            }
                        }
                    }
                }
            });
        };
    }

    // all方法
    all(nameOrPath: string | RegExp | string[] | null, pathOrMiddleware: string | RegExp | string[] | MiddlewareFunction | MiddlewareFunction[], ...rest: MiddlewareFunction[]): this {
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

        // 处理命名路由的情况: router.all('name', '/path', middleware)
        if (isPath(pathOrMiddleware)) {
            actualName = typeof nameOrPath === 'string' ? nameOrPath : null;
            actualPath = pathOrMiddleware;
            middleware = rest;
        }
        // 处理普通路由的情况: router.all('/path', middleware)
        else if (isPath(nameOrPath)) {
            actualName = null;
            actualPath = nameOrPath;
            
            // 处理中间件
            if (isMiddleware(pathOrMiddleware)) {
                middleware = [pathOrMiddleware, ...rest];
            } else if (isMiddlewareArray(pathOrMiddleware)) {
                middleware = [...pathOrMiddleware, ...rest];
            } else {
                throw new Error('You have to provide a valid middleware when adding an all handler');
            }
        } else {
            throw new Error('You have to provide a path when adding an all handler');
        }

        // Sanity check to ensure we have a viable path candidate (eg: string|regex|non-empty array)
        if (
            typeof actualPath !== 'string' &&
            !(actualPath instanceof RegExp) &&
            (!Array.isArray(actualPath) || actualPath.length === 0)
        )
            throw new Error('You have to provide a path when adding an all handler');
        this.register(actualPath, methods, middleware, { name: actualName });
        return this;
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
        const router = this;
        const { stack } = this;
        // support array of paths
        if (Array.isArray(path)) {
            for (const curPath of path) {
                router.register.call(router, curPath, methods, middleware, opts);
            }

            return router;
        }
        // create route
        const route = new Layer(path, methods, middleware, {
            end: opts.end === false ? opts.end : true,
            name: opts.name,
            sensitive: opts.sensitive || this.opts.sensitive || false,
            strict: opts.strict || this.opts.strict || false,
            prefix: opts.prefix || this.opts.prefix || '',
            ignoreCaptures: opts.ignoreCaptures
        });

        if (this.opts.prefix) {
            route.setPrefix(this.opts.prefix);
        }

        // add parameter middleware
        for (let i = 0; i < Object.keys(this.params).length; i++) {
            const param = Object.keys(this.params)[i];
            route.param(param, this.params[param]);
        }

        stack.push(route);

        debug('defined route %s %s', route.methods, route.path);

        return route;
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
        const layers = this.stack;
        let layer;
        const matched: MatchResult = {
            path: [],
            pathAndMethod: [],
            route: false
        };

        for (let len = layers.length, i = 0; i < len; i++) {
            layer = layers[i];

            debug('test %s %s', layer.path, layer.regexp);
            // eslint-disable-next-line unicorn/prefer-regexp-test
            if (layer.match(path)) {
                matched.path.push(layer);

                if (layer.methods.length === 0 || ~layer.methods.indexOf(method)) {
                    matched.pathAndMethod.push(layer);
                    if (layer.methods.length > 0) matched.route = true;
                }
            }
        }

        return matched;
    }

    // matchHost方法
    matchHost(input?: string): boolean {
        const { host } = this;
        if (!host) {
            return true;
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
        const args = Array.prototype.slice.call(restArgs, 1);
        return Layer.prototype.url.apply({ path }, args);
    }

    // 通用HTTP方法处理函数
    private createHttpMethodHandler(method: string) {
        return (nameOrPath: string | RegExp | string[] | null, pathOrMiddleware: string | RegExp | string[] | MiddlewareFunction | MiddlewareFunction[], ...rest: MiddlewareFunction[]): this => {
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

            this.register(actualPath, [method], middleware, { name: actualName });
            return this;
        };
    }



    // HTTP方法定义
    get = this.createHttpMethodHandler('get');
    post = this.createHttpMethodHandler('post');
    put = this.createHttpMethodHandler('put');
    head = this.createHttpMethodHandler('head');
    delete = this.createHttpMethodHandler('delete');
    options = this.createHttpMethodHandler('options');
    trace = this.createHttpMethodHandler('trace');
    copy = this.createHttpMethodHandler('copy');
    lock = this.createHttpMethodHandler('lock');
    mkcol = this.createHttpMethodHandler('mkcol');
    move = this.createHttpMethodHandler('move');
    purge = this.createHttpMethodHandler('purge');
    propfind = this.createHttpMethodHandler('propfind');
    proppatch = this.createHttpMethodHandler('proppatch');
    unlock = this.createHttpMethodHandler('unlock');
    report = this.createHttpMethodHandler('report');
    mkactivity = this.createHttpMethodHandler('mkactivity');
    checkout = this.createHttpMethodHandler('checkout');
    merge = this.createHttpMethodHandler('merge');
    ['m-search'] = this.createHttpMethodHandler('m-search');
    notify = this.createHttpMethodHandler('notify');
    subscribe = this.createHttpMethodHandler('subscribe');
    unsubscribe = this.createHttpMethodHandler('unsubscribe');
    patch = this.createHttpMethodHandler('patch');
    search = this.createHttpMethodHandler('search');
    connect = this.createHttpMethodHandler('connect');

}

export default Router;
