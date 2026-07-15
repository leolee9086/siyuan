/** Protyle 入口需要的布局更新选项，不暴露具体 Layout/Wnd/Tab 类型。 */
export interface IProtyleLayoutUpdateOptions {
    focus: boolean;
    pushBackStack: boolean;
    reload: boolean;
    resize: boolean;
}

/** 宿主聚焦结果，用于避免 Protyle 直接检查布局 CSS 类名。 */
export interface IProtyleLayoutFocusResult {
    handled: boolean;
    needsUpdate: boolean;
}

/** 跨编辑器 DOM 查找的匹配语义。 */
export type ProtyleLayoutElementMatch = "contains" | "wysiwyg";

/**
 * Protyle 使用的最小布局协同能力。
 *
 * 所有具体布局树遍历、面板 DOM 查询和页签操作都必须在完整 App 适配器中
 * 实现；独立入口使用 no-op，从而不需要伪造主应用布局结构。
 */
export interface IProtyleLayoutPort {
    refreshOutline: (rootId: string) => void;
    /** 在编辑器模式切换后同步宿主中的大纲面板。 */
    updateOutline?: (protyle: IProtyle, reload: boolean) => void;
    /** 更新宿主大纲当前项；preview 表示来自预览 DOM 的定位。 */
    setOutlineCurrent?: (protyle: IProtyle, element: Element, preview: boolean) => void;
    refreshBacklink: (protyle: IProtyle) => void;
    updatePanel: (protyle: IProtyle, options: IProtyleLayoutUpdateOptions) => void | Promise<void>;
    focus: (protyle: IProtyle) => IProtyleLayoutFocusResult;
    clearFocus: () => void;
    updateTitle: (protyle: IProtyle, title: string, empty: boolean) => void;
    removeTab: (protyle: IProtyle) => void;
    /** 在宿主布局变化前记录所有编辑器的可视顶部块。 */
    recordBeforeResizeTop?: () => void;
    /** 清理宿主布局变化前记录的顶部块标记。 */
    clearBeforeResizeTop?: () => void;
    /** 查找其它编辑器或块面板中可复用的块 DOM 副本。 */
    findBlockCopies?: (blockId: string) => Element[];
    /** 从完整 App 的反链面板中移除已销毁的 Protyle 实例。 */
    removeBacklinkEditor?: (protyle: IProtyle, backlinkElement: Element) => void;
    /** 在完整 App 的其它编辑器中查找与元素关联的 Protyle。 */
    findProtyleForElement?: (element: Element, match: ProtyleLayoutElementMatch) => IProtyle | undefined;
}
