/** 用途：以思源上游公开事件总线作为生态兼容基线；使用范围：AppFacade 默认事件总线类型与契约校验；解耦评估：type-only 依赖不会加载上游运行时。 */
import type {EventBus} from "siyuan";
/** 用途：以思源上游公开插件类型作为插件生态兼容基线；使用范围：AppFacade、插件宿主与契约校验；解耦评估：本地实现只能强化该边界，不能另立平行插件协议。 */
import type {Plugin} from "siyuan";
/** 用途：完整 App 的资产导航参数；使用范围：桌面、移动及独立宿主公共表面；解耦评估：纯数据类型，不加载资产或编辑器实现。 */
import type {AssetOpenOptions} from "../asset/open/openAsset.types";

/** 当前应用宿主打开 SiYuan 块 URI 时使用的完整导航参数。 */
export interface AppBlockNavigation {
    id: string;
    action: TProtyleAction[];
    zoomIn: boolean;
    /** 将目标块作为数据库行预览打开；宿主负责复用同一预览页签并展开属性面板。 */
    databaseRowId?: string;
}

/** 数据库条目在桌面页签或移动端详情面板中打开所需的完整数据。 */
export interface AppDatabaseRowNavigation {
    avID: string;
    databaseBlockID: string;
    notebookID: string;
    itemID: string;
    valueID: string;
    title: string;
    boundBlockID?: string;
    isDetached: boolean;
}

/** 完整 App 实例除厂牌外的公共领域表面；类型槽仅用于校验本地实现对上游契约的兼容性。 */
export interface AppFacadeShape<
    TPlugin extends object = Plugin,
    TEventBus extends object = EventBus,
> {
    plugins: TPlugin[];
    appId: string;
    eventBus: TEventBus;
    pluginHost: {
        reloadData: (plugin: TPlugin) => void;
        addDock: (plugin: TPlugin) => void;
    };
    openAsset(options: AssetOpenOptions): void;
    openBlock(options: AppBlockNavigation): void;
    openDatabaseRow(protyle: IProtyle, options: AppDatabaseRowNavigation): void;
    processSiYuanUri(uri: string): boolean;
}

/** 模块级不可变身份键；其值只用于类型/运行时外观识别，不保存应用状态。 */
export const appFacadeBrand = Symbol("AppFacade");

/** 已由应用装配边界创建并验证、且保持思源插件生态兼容的完整应用外观。 */
export interface AppFacade<
    TPlugin extends object = Plugin,
    TEventBus extends object = EventBus,
> extends AppFacadeShape<TPlugin, TEventBus> {
    readonly [appFacadeBrand]: "AppFacade";
}

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
