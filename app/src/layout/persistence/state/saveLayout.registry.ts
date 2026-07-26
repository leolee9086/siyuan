/** 用途：统一状态读取。使用范围：取得布局持久化注册表；解耦评估：SForge 全局注册表是跨调用方状态的唯一所有者。 */
import {getSForgeState} from "./imports";
/** 用途：统一状态写入。使用范围：初始化和测试重置布局持久化注册表；解耦评估：集中写入避免闭包状态。 */
import {setSForgeState} from "./imports";
/** 用途：布局持久化注册表键。使用范围：全局状态索引；解耦评估：不可变 Symbol 身份。 */
import {LAYOUT_PERSISTENCE_REGISTRY} from "./imports";
/** 用途：布局保存状态。使用范围：注册表值；解耦评估：纯数据领域类型。 */
import type {LayoutPersistenceState} from "./saveLayout.types";

const SAVE_LAYOUT_STATE_KEY = "saveLayout";

/** 获取或初始化统一布局持久化状态注册表。 @同步豁免: 生命周期 */
const getRegistry = () => {
    const current = getSForgeState(LAYOUT_PERSISTENCE_REGISTRY);
    if (current instanceof Map) {
        return current;
    }
    const registry = new Map<string, LayoutPersistenceState>();
    setSForgeState(LAYOUT_PERSISTENCE_REGISTRY, registry);
    return registry;
};

/** 获取或初始化全局保存重试状态。 */
const getSaveState = () => {
    const registry = getRegistry();
    const current = registry.get(SAVE_LAYOUT_STATE_KEY);
    if (current) {
        return current;
    }
    const state: LayoutPersistenceState = {retryCount: 0};
    registry.set(SAVE_LAYOUT_STATE_KEY, state);
    return state;
};

/** 读取当前全局布局保存重试次数。 @同步豁免: 生命周期 */
export const getLayoutSaveRetryCount = () => getSaveState().retryCount;

/** 递增并返回全局布局保存重试次数。 @同步豁免: 生命周期 */
export const incrementLayoutSaveRetryCount = () => {
    const state = getSaveState();
    state.retryCount++;
    return state.retryCount;
};

/** 成功或终止保存后清零重试次数。 @同步豁免: 生命周期 */
export const resetLayoutSaveRetryCount = () => {
    getSaveState().retryCount = 0;
};

/** 清除整个布局持久化注册表，供测试和 HMR 生命周期隔离。 @同步豁免: 生命周期 */
export const resetLayoutPersistenceRegistry = () => {
    const registry = getSForgeState(LAYOUT_PERSISTENCE_REGISTRY);
    registry?.clear();
    setSForgeState(LAYOUT_PERSISTENCE_REGISTRY, undefined);
};
