/**
 * 用途：定义 Layout 聚合根的窗口与页签抽象。
 * 使用范围：Wnd、Tab、Dock 模型和布局相关契约；具体实现只在组合根与契约校验边界出现。
 * 解耦评估：窗口与页签是布局领域的稳定关系，应由 layout 根统一定义；集中在此处可保持生命周期模块与具体布局实现单向依赖。
 */
import type {ILayoutModel} from "./lifecycle/model.types";

/** Layout 窗口的完整公开领域能力。 */
export interface LayoutWindow {
    readonly id: string;
    readonly element: HTMLElement;
    readonly headersElement: HTMLElement;
    readonly children: LayoutTab[];
    readonly resize?: Config.TUILayoutDirection;
    showHeading(): void;
    switchTab(target: HTMLElement, pushBack?: boolean, update?: boolean, resize?: boolean, isSaveLayout?: boolean): void;
    addTab(tab: LayoutTab, keepCursor?: boolean, isSaveLayout?: boolean, activeTime?: string): void;
    removeTab(id: string, isBatchClose?: boolean, animate?: boolean, isSaveLayout?: boolean): void;
    moveTab(tab: LayoutTab, nextId?: string): void;
    split(direction: Config.TUILayoutDirection, after?: boolean): LayoutWindow;
}

/** Layout 页签的完整公开领域能力，关联所属窗口与挂载模型。 */
export interface LayoutTab {
    readonly id: string;
    readonly parent: LayoutWindow;
    readonly headElement: HTMLElement;
    readonly panelElement: HTMLElement;
    readonly title: string;
    readonly icon: string;
    readonly docIcon: string;
    readonly model: ILayoutModel;
    updateTitle(title: string): void;
    addModel(model: ILayoutModel): void;
    initialize(): void;
    pin(): void;
    setDocIcon(icon: string): void;
    unpin(): void;
    close(): void;
}

/** 布局窗口拖拽恢复能力；应用身份由组合根参数化，领域类型不依赖具体 App。 */
export type WndDragRestore<TApplication> = (
    app: TApplication,
    data: Config.TUILayoutItem,
    target: LayoutWindow,
) => void;
