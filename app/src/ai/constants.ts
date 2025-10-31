/**
 * AI模块常量定义
 */

// CSS选择器常量
export const SELECTORS = {
    /** 列表项选择器 */
    LIST_ITEM: ".b3-list-item",
    /** 焦点列表项选择器 */
    LIST_ITEM_FOCUS: ".b3-list-item--focus",
    /** 菜单分隔符选择器 */
    MENU_SEPARATOR: ".b3-menu__separator"
} as const;

// CSS类名常量
export const CSS_CLASSES = {
    /** 隐藏元素的类名 */
    HIDDEN_CLASS: "fn__none"
} as const;

// 合并所有CSS类名常量，方便使用
export const ALL_CSS_CLASSES = {
    ...SELECTORS,
    ...CSS_CLASSES
} as const;
export const JAVASCRIPT_TOOLS_WAIT_CLASS = "javascript-tools-wait"
export const JAVASCRIPT_TOOLS_CLASS = "javascript-tools"