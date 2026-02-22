/**
 * sforge.guard.ts - SForge 类型守卫
 * 
 * 封装类型断言，符合架构规范
 */

import type { IGlobalWithSForge } from "./sforge.types";

/**
 * 将 globalThis 转换为带 SForge 接口的类型
 * 
 * 在 .guard.ts 中允许使用 as 断言
 */
export function asGlobalWithSForge(global: typeof globalThis): IGlobalWithSForge {
    return global as unknown as IGlobalWithSForge;
}

import type { IStyleBrushHandlers } from "../registry/TriggerRegistry.types";

/**
 * 将值转换为 IStyleBrushHandlers
 */
export function asStyleBrushHandlers(val: unknown): IStyleBrushHandlers | undefined {
    return val as IStyleBrushHandlers | undefined;
}

import type { IModelHandlers, TOpenMobileFileById } from "./sforge.types";

/**
 * 类型守卫：检查值是否为 IModelHandlers
 *
 * 意图：运行时校验从 SForge 注册表取出的值确实包含 Model 所需的三个处理器函数
 * 调用时机：Model.registry.ts 中 getModelHandlers 读取注册表后
 */
export function isModelHandlers(val: unknown): val is IModelHandlers {
    if (!val || typeof val !== "object") {
        return false;
    }
    const obj = val as Record<string, unknown>;
    return typeof obj.processMessage === "function"
        && typeof obj.kernelError === "function"
        && typeof obj.reloadSync === "function";
}

/**
 * 类型守卫：检查值是否为 TOpenMobileFileById
 *
 * 意图：运行时校验从 SForge 注册表取出的值确实是 openMobileFileById 函数
 * 调用时机：plugin/API.ts 中通过注册表获取 openMobileFileById 时
 */
export function isOpenMobileFileById(val: unknown): val is TOpenMobileFileById {
    return typeof val === "function";
}
