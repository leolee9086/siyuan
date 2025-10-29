import { compose } from './routerUtils'
import type {
    Context,
    MiddlewareFunction,
} from './types'
import Layer from './layer'
import Router from './router'

const debug = (...args: any[]) => {
    //    console.log(...args)
}

export function routes(router: Router): MiddlewareFunction {
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
        ).reduce(function (memo: MiddlewareFunction[], layer: Layer) {
            memo.push(async function (ctx: Context, next: () => Promise<void> | void) {
                if (layer.schema?.request) {
                    const parsed = layer.schema.request.safeParse(ctx.request.body);
                    if (parsed.success) {
                        ctx.request.body = parsed.data;
                    } else {
                        ctx.error = new Error(`Request validation failed: ${parsed.error.message}`);
                        return;
                    }
                }

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

                await next();

                if (layer.schema?.response) {
                    const parsed = layer.schema.response.safeParse(ctx.response.body);
                    if (parsed.success) {
                        ctx.response.body = parsed.data;
                    } else {
                        ctx.error = new Error(`Response validation failed: ${parsed.error.message}`);
                        return;
                    }
                }
            });
            return memo.concat(layer.stack);
        }, []);

        return compose(layerChain)(ctx, next);
    };
    dispatch.router = router;
    return dispatch;
}