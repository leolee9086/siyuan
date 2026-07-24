import { compose } from "./routerUtils";
import type {
    Context,
    MiddlewareFunction,
} from "./types";
import { LayerLike } from "./layerLike.types";
import type { RouterDispatchPort } from "../routerCore.port.types";

const debug = (...args: any[]) => {
    //    console.log(...args)
};

// 处理请求验证
function validateRequest(ctx: Context, layer: LayerLike): boolean {
    if (layer.schema?.request) {
        const parsed = layer.schema.request.safeParse(ctx.request.body);
        if (parsed.success) {
            ctx.request.body = parsed.data;
        } else {
            ctx.error = new Error(`Request validation failed: ${parsed.error.message}`);
            return false;
        }
    }
    return true;
}

// 处理响应验证
function validateResponse(ctx: Context, layer: LayerLike): boolean {
    if (layer.schema?.response) {
        const parsed = layer.schema.response.safeParse(ctx.response.body);
        if (parsed.success) {
            ctx.response.body = parsed.data;
        } else {
            ctx.error = new Error(`Response validation failed: ${parsed.error.message}`);
            return false;
        }
    }
    return true;
}

// 设置上下文参数
function setupContextParams(ctx: Context, layer: LayerLike, path: string): void {
    ctx.captures = layer.captures(path);
    ctx.params = ctx.request.params = layer.params(
        path,
        ctx.captures,
        ctx.params
    );
    ctx.routerPath = typeof layer.path === "string" ? layer.path : layer.path.toString();
    ctx.routerName = layer.name;
    ctx._matchedRoute = typeof layer.path === "string" ? layer.path : layer.path.toString();
    if (layer.name) {
        ctx._matchedRouteName = layer.name;
    }
}

// 创建层链
function createLayerChain(layers: LayerLike[], path: string): MiddlewareFunction[] {
    return layers.reduce(function (memo: MiddlewareFunction[], layer: LayerLike) {
        memo.push(async function (ctx: Context, next: () => Promise<void> | void) {
            // 处理请求验证
            if (!validateRequest(ctx, layer)) {
                return;
            }

            // 设置上下文参数
            setupContextParams(ctx, layer, path);

            await next();

            // 处理响应验证
            validateResponse(ctx, layer);
        });
        return memo.concat(layer.stack);
    }, []);
}

export function routes(router: RouterDispatchPort): MiddlewareFunction {
    const dispatch = function dispatch(ctx: Context, next: () => Promise<void> | void): Promise<void> | void {
        debug("%s %s", ctx.method, ctx.path);
        
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
        if (!matched.route) {
return next();
}

        const matchedLayers = matched.pathAndMethod;
        const mostSpecificLayer = matchedLayers[matchedLayers.length - 1];
        ctx._matchedRoute = typeof mostSpecificLayer.path === "string" ? mostSpecificLayer.path : mostSpecificLayer.path.toString();
        if (mostSpecificLayer.name) {
            ctx._matchedRouteName = mostSpecificLayer.name;
        }

        layerChain = createLayerChain(
            router.exclusive ? [mostSpecificLayer] : matchedLayers,
            path
        );

        return compose(layerChain)(ctx, next);
    };
    dispatch.router = router;
    return dispatch;
}
