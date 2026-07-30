/**
 * protyleMenus 模块类型定义
 * 
 * 包含资源菜单、内容菜单、链接菜单等相关类型
 */

// ────────────────────────────────────────────────────────────
// 资源菜单类型 (原 protyle.asset.types.ts)
// ────────────────────────────────────────────────────────────

/** 资源项接口 */
export interface assetItem {
    path: string;
    hName: string;
}

/**
 * 资源选择结果的完整去向。
 * `editor` 保留编辑器插入模式的取消、空列表与菜单关闭语义；
 * `callback` 由调用方完整接管选中结果及后续界面生命周期。
 */
export type AssetMenuDestination =
    | {kind: "editor"; select: (url: string, name: string) => void}
    | {kind: "callback"; select: (url: string, name: string) => void};

/** 资源选择菜单的完整打开参数。 */
export interface AssetMenuOptions {
    protyle: IProtyle;
    position: IPosition;
    destination: AssetMenuDestination;
    exts?: string[];
}

/**
 * 用途：聚合一次资源菜单键盘交互所需的 DOM、编辑器和选择去向。
 * 使用场景：方向键预览、Enter 确认和 Escape 取消共享同一菜单生命周期时使用。
 * 关联类型：`destination` 使用完整 `AssetMenuDestination` 判别编辑器与调用方接管模式。
 */
export interface AssetMenuKeyboardContext {
    element: Element;
    listElement: Element;
    previewElement: Element;
    protyle: IProtyle;
    destination: AssetMenuDestination;
}

// ────────────────────────────────────────────────────────────
// 内容菜单类型 (原 protyle.contentMenu.types.ts)
// ────────────────────────────────────────────────────────────

/**
 * 内容菜单上下文，用于在子函数间传递共享状态
 */
export interface IContentMenuContext {
    protyle: IProtyle;
    nodeElement: Element;
    range: Range;
    oldHTML: string;
    id: string;
    captionElement: false | HTMLElement;
}

/**
 * 行内元素菜单所需的上下文
 */
export interface IInlineMenuContext {
    protyle: IProtyle;
    nodeElement: Element;
    range: Range;
    oldHTML: string;
    inlineElement: HTMLSpanElement;
}

// ────────────────────────────────────────────────────────────
// 链接菜单类型 (原 protyle.linkMenu.types.ts)
// ────────────────────────────────────────────────────────────

/** 链接菜单操作所需的上下文信息 */
export interface LinkMenuContext {
    protyle: IProtyle;
    linkElement: HTMLElement;
    linkElements: readonly HTMLElement[];
    linkBlockElements: readonly HTMLElement[];
    nodeElement: HTMLElement;
    id: string;
    html: string;
    linkAddress: string | null;
    oldHTMLs?: ReadonlyMap<string, string>;
    inputElements?: NodeListOf<HTMLTextAreaElement>;
}
