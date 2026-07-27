/**
 * @fileoverview util.ts 类型守卫
 * 提供类型守卫函数以消除类型断言
 */

/** 用途：布局聚合根结构。使用范围：运行时布局守卫的返回类型；解耦评估：仅依赖完整领域类型，不加载 Layout/Wnd/Tab 具体实现。 */
import type {LayoutDomain} from "./layout.types";
/** 用途：页签领域返回类型；使用范围：页签结构守卫；解耦评估：仅引入完整领域类型，不加载 Tab class。 */
import type {LayoutTab} from "./layout.types";
/** 用途：窗口领域返回类型；使用范围：窗口结构守卫；解耦评估：仅引入完整领域类型，不加载 Wnd class。 */
import type {LayoutWindow} from "./layout.types";

/**
 * 检查值是否满足 Layout 聚合根的完整公共结构
 * @param value - 要检查的值
 * @returns 是否为 Layout 实例
 */
export const isLayoutValue = (value: unknown): value is LayoutDomain => {
    return value !== null && typeof value === "object" &&
        "direction" in value && "children" in value &&
        "addLayout" in value && "addWnd" in value;
};

/**
 * 检查值是否满足 LayoutWindow 的完整公共结构
 * @param value - 要检查的值
 * @returns 是否为 Wnd 实例
 */
export const isWndValue = (value: unknown): value is LayoutWindow => {
    return value !== null && typeof value === "object" &&
        "headersElement" in value && "children" in value &&
        "switchTab" in value && "addTab" in value && "removeTab" in value;
};

/**
 * 检查布局节点是否有子节点
 * @param node - 布局节点
 * @returns 是否有子节点
 */
export const hasChildren = (node: unknown): node is { children: unknown[] } => {
    return node !== null &&
        typeof node === "object" &&
        "children" in node &&
        Array.isArray((node as { children: unknown[] }).children);
};

/**
 * 检查值是否满足 LayoutTab 的完整公共结构
 * @param value - 要检查的值
 * @returns 是否为 Tab 实例
 */
export const isTabValue = (value: unknown): value is LayoutTab => {
    return value !== null && typeof value === "object" &&
        "headElement" in value && "panelElement" in value &&
        "parent" in value && "updateTitle" in value && "addModel" in value;
};

/**
 * 检查对象是否有 id 属性
 * @param value - 要检查的值
 * @returns 是否有 id 属性
 */
export const hasId = (value: unknown): value is { id: string } => {
    return value !== null &&
        typeof value === "object" &&
        "id" in value &&
        typeof (value as { id: unknown }).id === "string";
};

// ========================================
// 模型数据类型守卫
// ========================================

/**
 * 检查是否为有效的卡片数据
 * @param data - 要检查的数据
 * @returns 是否为有效的卡片数据
 */
export const isCardModelData = (data: unknown): data is {
    cardType: TCardType;
    id: string;
    title?: string;
    cardsData?: ICardData;
    index?: number;
} => {
    if (data === null || typeof data !== "object") {
        return false;
    }
    const d = data as Record<string, unknown>;
    return "cardType" in d && "id" in d;
};

/**
 * 检查是否为有效的编辑器模式
 * @param mode - 要检查的模式值
 * @returns 是否为有效的编辑器模式
 */
export const isValidEditorMode = (mode: unknown): mode is TEditorMode => {
    return mode === "wysiwyg" || mode === undefined;
};

/**
 * 检查是否为有效的滚动位置
 * @param position - 要检查的位置值
 * @returns 是否为有效的滚动位置
 */
export const isValidScrollPosition = (position: unknown): position is ScrollLogicalPosition => {
    return position === "start" || position === "center" || position === "end" || position === "nearest" || position === undefined;
};

/**
 * 有效的 TProtyleAction 值集合,需要经常和类型定义校验一致
 */
const VALID_PROTYLE_ACTIONS = /^(?:cb-get-append|cb-get-before|cb-get-unchangeid|cb-get-hl|cb-get-focus|cb-get-focusfirst|cb-get-setid|cb-get-outline|cb-get-all|cb-get-backlink|cb-get-unundo|cb-get-scroll|cb-get-search|cb-get-context|cb-get-rootscroll|cb-get-html|cb-get-history|cb-get-opennew)$/;

/**
 * 检查单个值是否为有效的 TProtyleAction
 * @param action - 要检查的动作值
 * @returns 是否为有效的 TProtyleAction
 */
export const isValidProtyleAction = (action: unknown): action is TProtyleAction => {
    return typeof action === "string" && VALID_PROTYLE_ACTIONS.test(action);
};

/**
 * 检查是否为有效的Protyle动作数组
 * @param actions - 要检查的动作数组
 * @returns 是否为有效的Protyle动作数组
 */
export const isValidProtyleActions = (actions: unknown): actions is TProtyleAction[] => {
    return Array.isArray(actions) && actions.every(isValidProtyleAction);
};

/**
 * 安全地获取字符串值
 * @param value - 要转换的值
 * @returns 字符串值，null/undefined 返回空字符串
 */
export const toString = (value: unknown): string => {
    if (typeof value === "string") {
        return value;
    }
    if (value === null || value === undefined) {
        return "";
    }
    // 数字、布尔值等基本类型使用 String() 转换
    return String(value);
};
