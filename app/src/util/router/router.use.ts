import Router from './router'
import Layer from './layer'
import {pathToRegexp} from 'path-to-regexp'

export function use(router: Router, ...args: any[]): Router {
    const middleware = Array.prototype.slice.call(args);
    let path;
    if (Array.isArray(middleware[0]) && typeof middleware[0][0] === 'string') {
        const arrPaths = middleware[0];
        for (const p of arrPaths) {
            router.use.apply(router, [p].concat(middleware.slice(1)));
        }
        return router;
    }
    const hasPath = typeof middleware[0] === 'string';
    if (hasPath) path = middleware.shift();
    for (const m of middleware) {
        if (m.router) {
            const cloneRouter = Object.assign(
                Object.create(Router.prototype),
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
            router.register(path || '([^/]*)', [], m, {
                end: false,
                ignoreCaptures: !hasPath && !routerPrefixHasParam
            });
        }
    }

    return router;
}
