/**
 * 用途：定义 Layout 聚合根的窗口与页签抽象。
 * 使用范围：Wnd、Tab、Dock 模型和布局相关契约；具体实现只在组合根与契约校验边界出现。
 * 解耦评估：窗口与页签是布局领域的稳定关系，应由 layout 根统一定义；集中在此处可保持生命周期模块与具体布局实现单向依赖。
 */
import type {ILayoutModel} from "./lifecycle/model.types";

/** Layout 聚合根的完整公开能力；用于布局工具和宿主之间的稳定依赖。 */
export interface LayoutDomain {
    element: HTMLElement;
    children: Array<LayoutDomain | LayoutWindow>;
    parent?: LayoutDomain;
    direction: Config.TUILayoutDirection;
    type?: Config.TUILayoutType;
    id?: string;
    resize?: Config.TUILayoutDirection | undefined;
    size?: string;
    addLayout(child: LayoutDomain, id?: string, after?: boolean): void;
    addWnd(child: LayoutWindow, id?: string, after?: boolean): void;
}

/** Layout 窗口的完整公开领域能力。 */
export interface LayoutWindow {
    id: string;
    parent?: LayoutDomain;
    element: HTMLElement;
    headersElement: HTMLElement;
    children: LayoutTab[];
    resize?: Config.TUILayoutDirection;
    showHeading(): void;
    switchTab(target: HTMLElement, pushBack?: boolean, update?: boolean, resize?: boolean, isSaveLayout?: boolean): void;
    addTab(tab: LayoutTab, keepCursor?: boolean, isSaveLayout?: boolean, activeTime?: string): void;
    removeTab(id: string, isBatchClose?: boolean, animate?: boolean, isSaveLayout?: boolean): void;
    moveTab(tab: LayoutTab, nextId?: string): void;
    split(direction: Config.TUILayoutDirection, after?: boolean): LayoutWindow;
    ensureCenterWindow(): void;
    remove(): void;
}

/** Layout 页签的完整公开领域能力，关联所属窗口与挂载模型。 */
export interface LayoutTab {
    id: string;
    parent: LayoutWindow;
    headElement: HTMLElement;
    panelElement: HTMLElement;
    callback: (tab: LayoutTab) => void;
    model: ILayoutModel;
    title: string;
    icon: string;
    docIcon: string;
    updateTitle(title: string): void;
    addModel(model: ILayoutModel): void;
    initialize(): void;
    pin(): void;
    setDocIcon(icon: string): void;
    unpin(): void;
    close(): void;
}

/** 运行时布局容器的完整公开表面；布局与 Dock 身份由使用边界参数化。 */
export interface LayoutRuntimeDomain<TLayout extends LayoutDomain, TDock extends object> {
    layout?: TLayout;
    centerLayout?: TLayout;
    leftDock?: TDock;
    rightDock?: TDock;
    bottomDock?: TDock;
}

/** 布局窗口拖拽恢复能力；应用身份由组合根参数化，领域类型不依赖具体 App。 */
export type WndDragRestore<TApplication> = (
    app: TApplication,
    data: Config.TUILayoutItem,
    target: LayoutWindow,
) => void;
