/**
 * sforge.global.ts - SForge 全局对象访问
 * 
 * 封装 globalThis 访问，符合架构规范
 */

import { SForgeSymbols } from "./sforge.symbols";
import type { ISForgeGlobalState, IGlobalWithSForge } from "./sforge.types";
import { asGlobalWithSForge } from "./sforge.guard";

/**
 * 获取全局对象（封装 globalThis 访问）
 */
function 获取全局对象(): IGlobalWithSForge {
    return asGlobalWithSForge(globalThis);
}

/**
 * 获取或创建 SForge 全局对象
 * 挂载在 globalThis 上，确保跨模块单例
 */
export function 获取SForge全局对象(): ISForgeGlobalState {
    const globalObj = 获取全局对象();
    const key = SForgeSymbols.GLOBAL_KEY;

    if (!globalObj[key]) {
        globalObj[key] = {};
    }

    return globalObj[key];
}

/**
 * 获取 SForge 全局状态中的某个值
 * @param symbolKey Symbol 键
 * @returns 对应的值
 */
export function getSForgeState<K extends keyof ISForgeGlobalState>(
    symbolKey: K
): ISForgeGlobalState[K] {
    return 获取SForge全局对象()[symbolKey];
}

/**
 * 设置 SForge 全局状态中的某个值
 * @param symbolKey Symbol 键
 * @param value 要设置的值
 */
export function setSForgeState<K extends keyof ISForgeGlobalState>(
    symbolKey: K,
    value: ISForgeGlobalState[K]
): void {
    获取SForge全局对象()[symbolKey] = value;
}

// 中文别名
export const 获取SForge状态 = getSForgeState;
export const 设置SForge状态 = setSForgeState;
