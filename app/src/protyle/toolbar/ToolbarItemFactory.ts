import { createToolbarDividerElement } from "./Divider";
import { createFontToolbarItem } from "./Font";
import { createToolbarItemElement } from "./ToolbarItem";
import { createLinkToolbarItem } from "./Link";
import { createBlockRefToolbarItem } from "./BlockRef";
import { createInlineMathToolbarItem } from "./InlineMath";
import { createInlineMemoToolbarItem } from "./InlineMemo";

/**
 * 创建分隔线工具栏项
 *
 * 作用：创建分隔符 DOM
 * 意图：将分隔线创建逻辑纳入统一工厂映射
 * 调用时机：当 genToolbarItem 识别到 menuItem.name 为 "|" 时调用
 */
function createDivider(protyle: IProtyle, menuItem: IMenuItem) {
    void protyle;
    void menuItem;
    return createToolbarDividerElement();
}

// 工具栏项工厂映射表：根据菜单项名称创建对应的工具栏 DOM 元素
const toolbarItemFactoryMap: Record<string, (protyle: IProtyle, menuItem: IMenuItem) => HTMLElement> = {
    "block-ref": createBlockRefToolbarItem,
    "inline-math": createInlineMathToolbarItem,
    "inline-memo": createInlineMemoToolbarItem,
    "|": createDivider,
    "text": createFontToolbarItem,
    "a": createLinkToolbarItem,
};

/**
 * 工具栏项工厂函数：根据菜单项配置创建对应的工具栏 DOM 元素
 *
 * 作用：根据 menuItem.name 选择对应的创建函数并返回元素
 * 意图：统一管理工具栏项创建逻辑，避免调用处重复类型判断
 * 调用时机：在 protyle 编辑器初始化与更新工具栏时调用（见 toolbar/index.ts）
 *
 * @param protyle - protyle 编辑器实例
 * @param menuItem - 工具栏项配置对象，包含 name/icon/tip/hotkey 等属性
 * @returns 工具栏项的 DOM 元素
 *
 * @同步豁免: UI构建 - 必须同步返回 DOM 元素以便立即插入工具栏容器
 */
export function genToolbarItem(protyle: IProtyle, menuItem: IMenuItem) {
    const factory = toolbarItemFactoryMap[menuItem.name];
    return factory ? factory(protyle, menuItem) : createToolbarItemElement(protyle, menuItem);
}

/** 把插件工具项注册到移动键盘工具栏，已存在同名按钮时保持唯一实例。 */
/** @同步豁免: UI构建 - 必须同步创建并挂载移动键盘工具项。 */
export function appendMobilePluginToolbarItem(protyle: IProtyle, toolbarItem: IMenuItem, inlineToolbarElement?: Element | null) {
    if (!inlineToolbarElement || inlineToolbarElement.querySelector(`[data-type="${toolbarItem.name}"]`)) {
        return;
    }
    const itemElement = genToolbarItem(protyle, toolbarItem);
    if (!itemElement) {
        return;
    }
    itemElement.className = "keyboard__action";
    inlineToolbarElement.appendChild(itemElement);
}
