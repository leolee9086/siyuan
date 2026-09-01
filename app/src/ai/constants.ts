/**
 * AI模块常量定义
 */


// CSS类名常量
export const CSS_CLASSES = {
    /** 列表项类名 */
    LIST_ITEM: "b3-list-item",
    /** 焦点列表项类名 */
    LIST_ITEM_FOCUS: "b3-list-item--focus",
    /** 菜单分隔符类名 */
    MENU_SEPARATOR: "b3-menu__separator",
    /** 隐藏元素的类名 */
    HIDDEN_CLASS: "fn__none"
} as const;

/**
 * 从CSS类名生成选择器
 * @param className CSS类名
 * @returns CSS选择器
 */
export const createSelector = (className: string) => {
    return `.${className}`;
};


/** AI 工具等待状态的 CSS 类名 */
export const JAVASCRIPT_TOOLS_WAIT_CLASS = "javascript-tools-wait";
/** AI 工具面板的 CSS 类名 */
export const JAVASCRIPT_TOOLS_CLASS = "javascript-tools";