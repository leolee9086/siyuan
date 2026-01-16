/**
 * TabRegistry.guard.ts - Tab 注册表类型守卫
 */

import type { TabRegistration } from "./TabRegistry.types";

/**
 * 判断是否为 Tab 注册表 Map
 * 
 * 注意：此处仅做运行时 Map 类型检查，泛型类型通过逻辑保证
 * 用于在从全局状态获取时进行类型收窄
 */
export function isTabRegistryMap(target: unknown): target is Map<string, TabRegistration> {
    return target instanceof Map;
}
