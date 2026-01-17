/**
 * dock.registry.ts - Dock 类型全局注册表
 * 
 * 解决问题：界面初始化时由于各 Dock 实例初始化顺序不确定，
 * 导致依赖 DOM 查询进行去重的逻辑不可靠，某些类型（如 tag）会消失。
 * 
 * 解决方案：使用全局注册表追踪已被各 Dock 实例占用的类型，
 * 而非依赖不稳定的 DOM 查询。
 * 
 * 注册表挂载在 SForge 全局对象的 Symbol 属性下，避免模块级变量可能的问题。
 */

import { SForgeSymbols, getSForgeState, setSForgeState } from "../../config/sforge";
import { isDockTypeRegistryMap } from "./dock.guard";

/**
 * 获取全局类型注册表（懒初始化）
 */
function 获取类型注册表(): Map<string, TDockPosition> {
    const registry = getSForgeState(SForgeSymbols.DOCK_TYPE_REGISTRY);

    // 使用类型守卫安全收窄类型
    if (isDockTypeRegistryMap(registry)) {
        return registry;
    }

    const newRegistry = new Map<string, TDockPosition>();
    setSForgeState(SForgeSymbols.DOCK_TYPE_REGISTRY, newRegistry);
    return newRegistry;
}

/**
 * 注册一个类型到指定的 Dock position
 * @param type dock 类型
 * @param position dock 位置
 * @returns 是否注册成功（如果已被其他 position 占用则返回 false）
 */
export function 注册类型(type: string, position: TDockPosition): boolean {
    const 类型注册表 = 获取类型注册表();
    const 现有位置 = 类型注册表.get(type);

    // 已被同一 position 占用，视为成功
    if (现有位置 === position) {
        return true;
    }

    // 已被其他 position 占用
    if (现有位置 !== undefined) {
        return false;
    }

    类型注册表.set(type, position);
    return true;
}

/**
 * 检查类型是否可用（未被任何 Dock 占用）
 * @param type dock 类型
 */
export function 类型可用(type: string): boolean {
    return !获取类型注册表().has(type);
}

/**
 * 检查类型是否被指定的 position 占用
 * @param type dock 类型
 * @param position dock 位置
 */
export function 是本Dock的类型(type: string, position: TDockPosition): boolean {
    return 获取类型注册表().get(type) === position;
}

/**
 * 注销一个类型
 * @param type dock 类型
 * @param position dock 位置（只有所有者才能注销）
 */
export function 注销类型(type: string, position: TDockPosition): void {
    const 类型注册表 = 获取类型注册表();
    const 现有位置 = 类型注册表.get(type);
    if (现有位置 === position) {
        类型注册表.delete(type);
    }
}

/**
 * 清空指定 position 的所有类型（用于 Dock 销毁时）
 * @param position dock 位置
 */
export function 清空Position的类型(position: TDockPosition): void {
    const 类型注册表 = 获取类型注册表();
    for (const [type, pos] of 类型注册表.entries()) {
        if (pos === position) {
            类型注册表.delete(type);
        }
    }
}

/**
 * 获取所有已注册的类型（用于调试）
 */
export function 获取所有已注册类型(): Map<string, TDockPosition> {
    return new Map(获取类型注册表());
}

/**
 * 重置注册表（用于测试或完全重新初始化）
 */
export function 重置注册表(): void {
    获取类型注册表().clear();
}

// 英文别名导出
export const registerType = 注册类型;
export const isTypeAvailable = 类型可用;
export const isOwnType = 是本Dock的类型;
export const unregisterType = 注销类型;
export const clearPositionTypes = 清空Position的类型;
export const getAllRegisteredTypes = 获取所有已注册类型;
export const resetRegistry = 重置注册表;
