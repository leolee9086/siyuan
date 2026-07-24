import Layer from "./layer";
import type {
    MiddlewareFunction,
    RouteOptions,
} from "./types";
import { LayerLike } from "./layerLike.types";
import type { RouterRegistrationStatePort } from "../routerCore.port.types";

const debug = (...args: any[]) => {
    //    console.log(...args)
};

export function register<T extends RouterRegistrationStatePort>(router: T, path: string | RegExp | string[], methods: string[], middleware: MiddlewareFunction | MiddlewareFunction[], opts: RouteOptions = {}): LayerLike | T {
    const { stack } = router;
    // support array of paths
    if (Array.isArray(path)) {
        for (const curPath of path) {
            register(router, curPath, methods, middleware, opts);
        }

        return router;
    }
    // create route
    const route = new Layer(path, methods, middleware, {
        end: opts.end === false ? opts.end : true,
        name: opts.name,
        sensitive: opts.sensitive || router.opts.sensitive || false,
        strict: opts.strict || router.opts.strict || false,
        prefix: opts.prefix || router.opts.prefix || "",
        ignoreCaptures: opts.ignoreCaptures,
        schema: opts.schema
    });

    if (router.opts.prefix) {
        route.setPrefix(router.opts.prefix);
    }

    // add parameter middleware
    for (let i = 0; i < Object.keys(router.params).length; i++) {
        const param = Object.keys(router.params)[i];
        route.param(param, router.params[param]);
    }

    stack.push(route);

    debug("defined route %s %s", route.methods, route.path);

    return route;
}
