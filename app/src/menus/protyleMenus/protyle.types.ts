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
    nodeElement: HTMLElement;
    id: string;
    html: string;
    linkAddress: string | null;
    inputElements?: NodeListOf<HTMLTextAreaElement>;
}
