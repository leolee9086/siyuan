/**
 * 窗口工具模块类型守卫
 *
 * @module window-utils.guard
 * @description 提供窗口工具模块中的类型守卫函数
 */

/** 用途：Tab 页签类型定义。使用范围：窗口工具模块类型守卫。解耦评估：类型导入，不涉及运行时耦合。 */
import type { Tab } from "./Tab";
/** 用途：Editor 编辑器类。使用范围：运行时的 instanceof 检查。解耦评估：通过目录 imports.ts 转发可降低路径耦合，当前直接导入因 Editor 用作运行时值而非仅类型。 */
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
