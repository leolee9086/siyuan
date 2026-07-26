/**
 * 窗口工具模块类型守卫
 *
 * @module window-utils.guard
 * @description 提供窗口工具模块中的类型守卫函数
 */

/** 用途：完整布局页签领域根。使用范围：窗口工具模块类型守卫。解耦评估：纯类型依赖稳定抽象，避免守卫反向加载具体 Tab class。 */
import type {LayoutTab} from "./layout.types";
/** 用途：Editor 编辑器类。使用范围：运行时的 instanceof 检查。解耦评估：通过目录 imports.ts 转发可降低路径耦合，当前直接导入因 Editor 用作运行时值而非仅类型。 */
import { Editor } from "../editor";

/**
 * 检查标签页模型是否为编辑器类型
 *
 * @param tab - 需要检查的标签页
 * @returns 如果是编辑器类型返回true，否则返回false
 */
export function isEditorTab(tab: LayoutTab): tab is LayoutTab & {model: Editor} {
    return tab.model instanceof Editor;
}
