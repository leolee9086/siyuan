/**
 * 窗口工具模块类型守卫
 *
 * @module window-utils.guard
 * @description 提供窗口工具模块中的类型守卫函数
 */

import type { Tab } from "./Tab";
import { Editor } from "../editor";

/**
 * 检查标签页模型是否为编辑器类型
 *
 * @param tab - 需要检查的标签页
 * @returns 如果是编辑器类型返回true，否则返回false
 */
export function isEditorTab(tab: Tab): tab is Tab & { model: Editor } {
    return tab.model instanceof Editor;
}
