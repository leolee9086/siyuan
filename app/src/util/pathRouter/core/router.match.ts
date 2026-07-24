import type { MatchResult } from "../routerCore.port.types";
import { LayerLike } from "./layerLike.types";

const debug = (...args: any[]) => {
    //    console.log(...args)
};

/**
 * 路由匹配函数
 *
 * 根据给定的路径和HTTP方法，在路由器的层栈中查找匹配的路由层。
 * 返回包含路径匹配和方法匹配的层信息。
 *
 * @param {LayerLike[]} stack - 路由器的层栈，包含所有注册的路由层
 * @param {string} path - 要匹配的请求路径
 * @param {string} method - 要匹配的HTTP方法
 * @returns {MatchResult} 匹配结果，包含路径匹配和方法匹配的层信息
 *
 * @example
 * ```typescript
 * const router = new Router();
 * router.get('/users', userHandler);
 * const result = match(router.stack, '/users', 'GET');
 * // result.path 包含匹配的层
 * // result.pathAndMethod 包含路径和方法都匹配的层
 * // result.route 为 true 表示找到了方法匹配的路由
 * ```
 */
export function match(stack: LayerLike[], path: string, method: string): MatchResult {
    let layer;
    const matched: MatchResult = {
        path: [],
        pathAndMethod: [],
        route: false
    };

    for (let len = stack.length, i = 0; i < len; i++) {
        layer = stack[i];

        debug("test %s %s", layer.path, layer.regexp);
        // eslint-disable-next-line unicorn/prefer-regexp-test
        if (layer.match(path)) {
            matched.path.push(layer);

            if (layer.methods.length === 0 || ~layer.methods.indexOf(method)) {
                matched.pathAndMethod.push(layer);
                if (layer.methods.length > 0) {
matched.route = true;
}
            }
        }
    }

    return matched;
}
