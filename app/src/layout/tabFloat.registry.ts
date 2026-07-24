/** 浮窗副本工厂注册表；具体模型只通过能力协议接入布局。 */
import {getSForgeState, setSForgeState} from "../config/sforge.global";
import {SForgeSymbols} from "../config/sforge.symbols";
import type {ILayoutTabFloatFactory} from "./tabFloat.types";
import type {ILayoutTabHandle} from "./tabFloat.types";

const getRegistry = () => {
    const current = getSForgeState(SForgeSymbols.TAB_FLOAT_FACTORY_REGISTRY);
    if (current instanceof Map) {
        return current as Map<string, ILayoutTabFloatFactory>;
    }
    const registry = new Map<string, ILayoutTabFloatFactory>();
    setSForgeState(SForgeSymbols.TAB_FLOAT_FACTORY_REGISTRY, registry);
    return registry;
};

/** 注册一个模型的浮窗副本能力；重复 id 会被拒绝，避免入口重复加载产生隐性覆盖。 */
export const registerTabFloatFactory = (factory: ILayoutTabFloatFactory) => {
    const registry = getRegistry();
    if (registry.has(factory.id)) {
        return false;
    }
    registry.set(factory.id, factory);
    return true;
};

/** 注销工厂，供测试/HMR 或宿主卸载能力时使用。 */
export const unregisterTabFloatFactory = (id: string) => getRegistry().delete(id);

/** 按声明顺序查找能够创建当前 Tab 副本的工厂。 */
export const getTabFloatFactory = (tab: ILayoutTabHandle) => {
    for (const factory of getRegistry().values()) {
        if (factory.canCreate(tab)) {
            return factory;
        }
    }
    return undefined;
};

/** 清空注册表，供浏览器契约测试隔离全局状态。 */
export const resetTabFloatFactories = () => {
    setSForgeState(SForgeSymbols.TAB_FLOAT_FACTORY_REGISTRY, undefined);
};

export type {ILayoutTabFloatFactory} from "./tabFloat.types";
