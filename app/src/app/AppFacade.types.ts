/** 用途：以思源上游公开事件总线作为生态兼容基线；使用范围：AppFacade 默认事件总线类型与契约校验；解耦评估：type-only 依赖不会加载上游运行时。 */
import type {EventBus} from "siyuan";
/** 用途：以思源上游公开插件类型作为插件生态兼容基线；使用范围：AppFacade、插件宿主与契约校验；解耦评估：本地实现只能强化该边界，不能另立平行插件协议。 */
import type {Plugin} from "siyuan";
/** 用途：完整 App 的资产导航参数；使用范围：桌面、移动及独立宿主公共表面；解耦评估：纯数据类型，不加载资产或编辑器实现。 */
import type {AssetOpenOptions} from "../asset/open/openAsset.types";
/** 用途：完整 Protyle 公共领域表面；使用范围：App 组合根创建编辑器；解耦评估：纯类型不加载具体实现。 */
import type {ProtyleDomain} from "../protyle/protyle.types";
/** 用途：描述应用导航完成后的完整布局模型；使用范围：AppBlockNavigation.afterOpen；解耦评估：纯类型直达布局生命周期抽象。 */
import type {ILayoutModel} from "../layout/lifecycle/model.types";
/** 用途：描述应用打开页签后的完整布局结果；使用范围：AppFacade.openTab 完成语义；解耦评估：纯类型直达 Layout 领域根。 */
import type {LayoutTab} from "../layout/layout.types";
/** 用途：完整笔记内插件管理器领域根；使用范围：应用外观向菜单和编辑器暴露唯一管理实例；解耦评估：纯类型不加载具体管理器。 */
import type {InNotePluginManagerDomain} from "../inNotePlugin/manager/inNotePluginManager.types";

/** 当前应用宿主打开 SiYuan 块 URI 时使用的完整导航参数。 */
export interface AppBlockNavigation {
    id: string;
    action?: TProtyleAction[];
    zoomIn?: boolean;
    /** 桌面宿主在指定分屏方向打开；移动宿主保持单编辑器导航语义。 */
    position?: "right" | "bottom" | undefined;
    /** 桌面宿主在新页签中保留当前编辑器光标；移动宿主保持原导航语义。 */
    keepCursor?: boolean;
    /** 桌面宿主强制创建新页签而不复用现有分屏；移动宿主保持单编辑器导航语义。 */
    openNewTab?: boolean;
    /** 桌面宿主是否移除当前页签；移动宿主使用单编辑器导航，不消费该布局选项。 */
    removeCurrentTab?: boolean;
    /** 打开后将目标滚动到指定位置；桌面与移动宿主均透传既有编辑器语义。 */
    scrollPosition?: ScrollLogicalPosition;
    /** 目标完成打开后的通知；桌面传入布局模型，移动端在编辑器就绪后以无模型参数通知。 */
    afterOpen?: (model?: ILayoutModel) => void;
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

/** 应用宿主打开普通 Editor、Asset、Search 或 Custom 页签时接收的完整既有导航载荷。 */
export type AppTabNavigation = Omit<IOpenFileOptions, "app">;

/** 完整 App 实例除厂牌外的公共领域表面；类型槽仅用于校验本地实现对上游契约的兼容性。 */
export interface AppFacadeShape<
    TPlugin extends object = Plugin,
    TEventBus extends object = EventBus,
> {
    plugins: TPlugin[];
    appId: string;
    eventBus: TEventBus;
    inNotePluginManager: InNotePluginManagerDomain<AppFacade>;
    pluginHost: {
        reloadData: (plugin: TPlugin) => void;
        addDock: (plugin: TPlugin) => void;
    };
    createProtyle(element: HTMLElement, options: IProtyleOptions): ProtyleDomain;
    createDocument(name?: string): Promise<void>;
    createDocumentInTree(notebookId: string, currentPath: string, paths?: string[]): Promise<void>;
    handleUnavailableDocument(protyle: IProtyle): void;
    toggleFullscreen(element: Element, button?: Element): void;
    openGlobalSearch(text: string, replace: boolean, searchData?: Config.IUILayoutTabSearchConfig): void;
    openTab(options: AppTabNavigation): Promise<LayoutTab | undefined>;
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
