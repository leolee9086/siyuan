/**
 * TriggerRegistry.guard.ts - TriggerRegistry 类型守卫
 */

import type { ITriggerRegistration, IBrushSession } from "./TriggerRegistry.types";

/**
 * 判断是否为 Trigger 注册表 Map
 */
export function isTriggerRegistryMap(target: unknown): target is Map<string, ITriggerRegistration> {
    return target instanceof Map;
}

/**
 * 判断是否为 BrushSession 对象
 */
export function isBrushSession(target: unknown): target is IBrushSession {
    if (typeof target !== "object" || target === null) {
        return false;
    }
    return typeof (target as Record<string, unknown>).triggerType === "string"
        && Array.isArray((target as Record<string, unknown>).cleanupFns);
}

/**
 * 验证参数类型 (泛型守卫)
 * 
 * 由于参数类型在运行时被擦除，此守卫主要用于通过 TS 检查，
 * 调用者需自行确保类型的正确性或在后续使用中验证。
 */
export function isValidParams<T>(params: unknown): params is T {
    return params !== undefined; // 基础检查，默认 params 可以是 T (如果是 optional 则需注意)
}

/**
 * 判断是否为有效的 ITriggerRegistration (非 null/undefined)
 */
export function isValidTriggerRegistration(target: ITriggerRegistration | null | undefined): target is ITriggerRegistration {
    return target !== null && target !== undefined;
}
