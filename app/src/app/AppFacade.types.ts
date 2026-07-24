/** 用途：为应用外观提供上游事件总线的公开兼容基线；使用范围：AppFacade 默认事件总线类型与契约校验；解耦评估：仅为 type-only 依赖，不加载上游运行时，具体实现仍由初始化边界代入。 */
import type {EventBus} from "siyuan";
/** 用途：为应用外观提供上游插件的公开兼容基线；使用范围：AppFacade 默认插件类型与契约校验；解耦评估：仅为 type-only 依赖，不加载上游运行时，具体插件实现仍由初始化边界代入。 */
import type {Plugin} from "siyuan";

/** 应用外观的领域公共表面；具体插件和事件总线由装配边界代入。 */
export interface AppFacadeShape<
    TPlugin extends object = Plugin,
    TEventBus extends object = EventBus,
> {
    plugins: TPlugin[];
    appId: string;
    eventBus: TEventBus;
}

/** 模块级不可变身份键；其值只用于类型/运行时外观识别，不保存应用状态。 */
export const appFacadeBrand = Symbol("AppFacade");

/** 已由应用装配边界创建并验证的应用外观。 */
export type AppFacade<
    TPlugin extends object = Plugin,
    TEventBus extends object = EventBus,
> =
    AppFacadeShape<TPlugin, TEventBus> & {
        readonly [appFacadeBrand]: "AppFacade";
    };

/**
 * 将已初始化的应用公共表面登记为带厂牌外观，并保持原对象身份。
 * @同步豁免: 生命周期 - 装配边界必须在向下传递应用前同步完成厂牌登记。
 */
export const createAppFacade = <TPlugin extends object, TEventBus extends object>(
    shape: AppFacadeShape<TPlugin, TEventBus>,
) => {
    // 同一运行时对象可能从多个初始化边界登记，重复定义不可配置厂牌会抛出异常。
    if (!(appFacadeBrand in shape)) {
        Object.defineProperty(shape, appFacadeBrand, {
            configurable: false,
            enumerable: false,
            value: "AppFacade",
            writable: false,
        });
    }
    return shape as AppFacade<TPlugin, TEventBus>;
};
