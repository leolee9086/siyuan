/**
 * @fileoverview genSearch 函数的共享上下文类型定义
 * @description 用于在各个拆分后的处理器之间传递共享状态
 */

/** Inputs shared by the local search template and the source selector controls. */
export interface SearchHTMLContext {
    config: Config.IUILayoutTabSearchConfig;
    closeCB: boolean;
    includeChild: boolean;
    enableIncludeChild: boolean;
}



/**
 * UI 元素引用
 */
export interface IClickHandlerUIElements {
    /** 根容器元素 */
    element: HTMLElement;
    /** 搜索输入框 */
    searchInputElement: HTMLInputElement;
    /** 替换输入框 */
    replaceInputElement: HTMLInputElement;
    /** 搜索列表容器 */
    searchPanelElement: Element;
    /** 资源面板元素 */
    assetsElement: HTMLElement;
    /** 无效引用面板元素 */
    unRefPanelElement: HTMLElement;
}

/**
 * 状态数据
 */
export interface IClickHandlerState<TApplication, TEditor> {
    /** 应用实例 */
    app: TApplication;
    /** 搜索配置 */
    config: Config.IUILayoutTabSearchConfig;
    /** 搜索预览编辑器 */
    edit: TEditor;
    /** 无效引用预览编辑器 */
    unRefEdit: TEditor;
    /** 搜索条件数据 */
    criteriaData: Config.IUILayoutTabSearchConfig[];
    /** 本地搜索配置 */
    localSearch: ISearchAssetOption;
}

/**
 * 回调函数
 */
export interface IClickHandlerCallbacks {
    /** 关闭回调 */
    closeCB?: () => void;
    /** 配置更新回调 */
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void;
}

/** 点击事件处理上下文 */
export interface IClickContext<TApplication, TEditor> {
    target: HTMLElement;
    type: string | null;
    targetId: string;
    ui: IClickHandlerUIElements;
    state: IClickHandlerState<TApplication, TEditor>;
    callbacks: IClickHandlerCallbacks;
    event: MouseEvent;
    clickTimeout: number;
    lastClickTime: number;
}

/** 处理 CSS 类名点击的结果 */
export interface IClassClickResult {
    handled: boolean;
    clickTimeout: number;
    lastClickTime: number;
}

/** 点击事件监听器状态 */
export interface IClickListenerState {
    clickTimeout: number;
    lastClickTime: number;
}

/** 拖拽布局配置 */
export interface ILayoutConfig {
    direction: "lr" | "tb";
    positionKey: "clientX" | "clientY";
    sizeKey: "width" | "height";
    clientSizeKey: "clientWidth" | "clientHeight";
    storageKey: string;
}

/** 列表项点击上下文 */
export interface IListItemClickContext<TApplication, TEditor> {
    app: TApplication;
    element: HTMLElement;
    edit: TEditor;
    unRefEdit: TEditor;
    config: Config.IUILayoutTabSearchConfig;
    searchInputElement: HTMLInputElement;
    searchPanelElement: Element;
    unRefPanelElement: HTMLElement;
    closeCB: (() => void) | undefined;
    clickTimeout: number;
    lastClickTime: number;
}
