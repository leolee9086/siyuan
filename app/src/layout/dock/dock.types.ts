/** 用途：布局模型最小接口。使用范围：Dock 工厂返回值。解耦评估：模型创建协议只依赖布局领域契约。 */
import type {ILayoutModel} from "../lifecycle/model.types";
/** 用途：Dock 持有的布局聚合根。使用范围：Dock 领域状态及拖拽、显示、模型编排；解耦评估：依赖完整 Layout 抽象而非具体 class，参数传递已经完成运行时解耦。 */
import type {LayoutDomain} from "../layout.types";
/** 用途：Dock 持有的应用外观。使用范围：插件 Dock 配置持久化和宿主动作；解耦评估：AppFacade 是应用完整抽象根，继续参数传递不会减少领域耦合。 */
import type {AppFacade} from "../../app/AppFacade.types";

/** Dock 聚合根的完整公开能力；行为模块不得按单个调用点复制局部结构。 */
export interface DockDomain {
    readonly app: AppFacade;
    readonly elements: HTMLElement[];
    readonly layout: LayoutDomain;
    readonly position: TDockPosition;
    readonly resizeElement: HTMLElement;
    readonly pin: boolean;
    readonly data: {[key: string]: ILayoutModel | boolean | undefined};
    readonly hideResizeTimeout: number;
    togglePin(): void;
    showDock(reset?: boolean): void;
    hideDock(reset?: boolean): void;
    toggleModel(type: TDock | string, show?: boolean, close?: boolean, removeDock?: boolean, isSaveLayout?: boolean): void;
    add(index: number, sourceElement: Element, previousType?: string): void;
    remove(key: TDock | string): void;
    setSize(): void;
    genButton(data: Config.IUILayoutDockTab[], index: number, tabIndex?: number): void;
    addCustomItem(item: Config.IUILayoutDockTab): void;
    saveLocalPlugin(dockType: TDock | string, options: {
        position?: TPluginDockPosition;
        size?: Partial<Config.IUILayoutDockPanelSize>;
        index?: number;
        show?: boolean;
    }): void;
}

/**
 * Model 工厂函数类型
 * 
 * 用途：定义创建 Dock Model 的函数签名（函数式组件）
 * 使用场景：MODEL_FACTORIES 中的普通工厂函数
 */
export type ModelFactory<TApplication, TTab, TEditor, TData> = (
    app: TApplication,
    tab: TTab,
    editor?: TEditor,
    data?: TData
) => ILayoutModel | undefined;

/**
 * Model 构造函数类型
 * 
 * 用途：定义 Dock Model 的类构造函数签名（类式组件）
 * 使用场景：MODEL_FACTORIES 中的类构造器，如 Bookmark, Tag 等
 */
export type ModelConstructor<TApplication, TTab, TEditor, TData> = new (
    app: TApplication,
    tab: TTab,
    editor?: TEditor,
    data?: TData
) => ILayoutModel;
