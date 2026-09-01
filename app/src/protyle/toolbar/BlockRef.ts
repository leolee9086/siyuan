import { createToolbarItemElement } from "./ToolbarItem";
import { hintRef } from "../hint/extend.hintRef";
import { fixTableRange } from "../util/selection";
import { isSameBlockRange } from "../../util/newFileSelection";

/**
 * 创建块引用工具栏项
 *
 * 作用：渲染块引用按钮并绑定点击行为，触发块引用提示面板
 * 意图：使用函数式渲染替代类继承实现
 * 调用时机：ToolbarItemFactory 在识别到 block-ref 时调用
 */
export const createBlockRefToolbarItem = (protyle: IProtyle, menuItem: IMenuItem): HTMLElement => {
    const element = createToolbarItemElement(protyle, menuItem);
    // 不能用 getEventName，否则会导致光标位置变动到点击的文档中
    element.addEventListener("click", (event: MouseEvent) => {
        blockRefEvent(protyle, event);
    });
    return element;
};

/**
 * 块引用点击事件处理函数
 *
 * 作用：处理块引用工具栏按钮的点击事件，触发块引用搜索界面
 * 意图：当用户选中文本后点击块引用按钮，使用选中的文本作为关键词搜索块引用
 * 调用时机：createBlockRefToolbarItem 绑定 click 事件后，用户点击块引用按钮时触发
 *
 * @param protyle - 编辑器实例
 * @param event - 鼠标点击事件
 */
const blockRefEvent = (protyle: IProtyle, event: MouseEvent) => {
    const range = protyle.toolbar?.range;
    if (!range || range.toString() === "") {
        return;
    }
    fixTableRange(range);
    if (!isSameBlockRange(range)) {
        return;
    }
    hintRef(range.toString(), protyle, "search");
    protyle.toolbar?.element.classList.add("fn__none");
    event.stopPropagation();
};
