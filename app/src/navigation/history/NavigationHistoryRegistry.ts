/** 用途：读取统一状态；使用范围：导航注册表访问；解耦评估：经本域 imports 显式暴露基础设施依赖。 */
import {getSForgeState} from "./imports";
/** 用途：写入统一状态；使用范围：导航注册表初始化和重置；解耦评估：经本域 imports 显式暴露基础设施依赖。 */
import {setSForgeState} from "./imports";
/** 用途：导航注册表 Symbol；使用范围：唯一状态槽；解耦评估：独立厂牌键保持精确键值映射。 */
import {NAVIGATION_HISTORY_REGISTRY} from "./imports";
/** 用途：约束注册表 scope 与完整状态值；使用范围：本注册表的键值类型；解耦评估：纯领域类型不加载导航实现。 */
import type {NavigationHistoryScope} from "./NavigationHistory.types";
/** 用途：约束每个 scope 的完整状态；使用范围：注册表值；解耦评估：纯领域类型不加载导航实现。 */
import type {NavigationHistoryState} from "./NavigationHistory.types";

/** 获取或初始化可枚举的导航历史注册表，供导航操作同步读写和测试生命周期重置。 */
const getRegistry = () => {
    const current = getSForgeState(NAVIGATION_HISTORY_REGISTRY);
    if (current instanceof Map) {
        return current;
    }
    const registry = new Map<NavigationHistoryScope, NavigationHistoryState>();
    setSForgeState(NAVIGATION_HISTORY_REGISTRY, registry);
    return registry;
};

/** 获取指定宿主的唯一导航历史状态，在任一导航操作开始时调用。 @同步豁免: 生命周期 */
export const getNavigationHistoryState = (scope: NavigationHistoryScope) => {
    const registry = getRegistry();
    const current = registry.get(scope);
    if (current) {
        return current;
    }
    const state: NavigationHistoryState = {
        forwardStack: [],
        previousIsBack: false,
    };
    registry.set(scope, state);
    return state;
};

/** 清空所有宿主导航状态，供 HMR、测试和应用生命周期重置调用。 @同步豁免: 生命周期 */
export const resetNavigationHistoryRegistry = () => {
    getSForgeState(NAVIGATION_HISTORY_REGISTRY)?.clear();
    setSForgeState(NAVIGATION_HISTORY_REGISTRY, undefined);
};
