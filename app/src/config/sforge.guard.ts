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
