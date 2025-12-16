import type { Context, AllowedMethodsOptions, HttpErrors } from "./types";

/**
 * 从匹配的路由中获取允许的HTTP方法列表
 * @param ctx 请求上下文
 * @returns 允许的HTTP方法数组
 */
export function getAllowedMethods(ctx: Context): string[] {
    const allowed: Record<string, string> = {};
    
    // 确保 ctx.matched 存在并且是数组
    const matched = ctx.matched || [];
    for (let i = 0; i < matched.length; i++) {
        const route = matched[i];
        if (route && route.methods) {
            for (let j = 0; j < route.methods.length; j++) {
                const method = route.methods[j];
                allowed[method] = method;
            }
        }
    }
    
    // 确保HEAD方法总是被包含在允许的方法中，如果GET被允许
    if (allowed["GET"] && !allowed["HEAD"]) {
        allowed["HEAD"] = "HEAD";
    }
    
    return Object.keys(allowed);
}

/**
 * 处理未实现的HTTP方法
 * @param ctx 请求上下文
 * @param implemented 已实现的HTTP方法列表
 * @param options 配置选项
 * @param HttpError HTTP错误对象
 */
export function handleNotImplementedMethod(
    ctx: Context, 
    implemented: string[], 
    options: AllowedMethodsOptions, 
    HttpError: HttpErrors
): void {
    if (options.throw) {
        const notImplementedThrowable =
            typeof options.notImplemented === "function"
                ? options.notImplemented() // set whatever the user returns from their function
                : HttpError.NotImplemented();

        throw notImplementedThrowable;
    } else {
        ctx.status = 501;
        if (ctx.set) {
            const allowedArr = getAllowedMethods(ctx);
            ctx.set("Allow", allowedArr.join(", "));
        }
    }
}

/**
 * 处理OPTIONS请求
 * @param ctx 请求上下文
 */
export function handleOptionsRequest(ctx: Context): void {
    ctx.status = 200;
    ctx.body = "";
    if (ctx.set) {
        const allowedArr = getAllowedMethods(ctx);
        ctx.set("Allow", allowedArr.join(", "));
    }
}

/**
 * 处理不允许的HTTP方法
 * @param ctx 请求上下文
 * @param options 配置选项
 * @param HttpError HTTP错误对象
 */
export function handleMethodNotAllowed(
    ctx: Context, 
    options: AllowedMethodsOptions, 
    HttpError: HttpErrors
): void {
    if (options.throw) {
        const notAllowedThrowable =
            typeof options.methodNotAllowed === "function"
                ? options.methodNotAllowed() // set whatever the user returns from their function
                : HttpError.MethodNotAllowed();

        throw notAllowedThrowable;
    } else {
        ctx.status = 405;
        if (ctx.set) {
            const allowedArr = getAllowedMethods(ctx);
            ctx.set("Allow", allowedArr.join(", "));
        }
    }
}