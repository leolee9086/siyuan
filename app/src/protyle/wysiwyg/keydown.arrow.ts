import { isIncludesHotKey } from "../util/hotKey";
import { getSelectionOffset } from "../util/selection";
import { getContenteditableElement, isEndOfBlock } from "./getBlock";


/**
 * 左右方向键选区扩展中间件
 *
 * 该函数处理 Shift + 左右方向键的选择行为，在特定情况下阻止浏览器的默认行为，
 * 以确保编辑器的选择逻辑能够正确工作。
 *
 * 主要处理以下几种情况：
 * 1. 当存在已选择的元素时，阻止默认行为
 * 2. 当光标在块末尾且按下 Shift+右箭头时（非 Option+Shift+右箭头），阻止默认行为
 * 3. 当光标在块开头且按下 Shift+左箭头时（非 Option+Shift+左箭头），阻止默认行为
 *
 * @param event - 键盘事件对象，包含按键信息和修饰键状态
 * @param protyle - 思源笔记编辑器实例，包含 wysiwyg 等编辑器相关属性
 * @param nodeElement - 当前操作的节点元素，通常是包含光标的块级元素
 * @param range - 当前选区范围对象，表示用户选择的文本范围
 * @param controller - 中止控制器，用于停止后续的事件处理流程
 * @returns void - 该函数不返回值，通过修改事件对象和调用控制器来影响后续处理
 */
export const arrowLeftRightMiddleWare = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 只处理 Shift + 左右方向键的组合
    if (event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        // 检查编辑器中是否存在已选择的元素（.protyle-wysiwyg--select 类名的元素）
        const selectElements = protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--select");
        if (selectElements && selectElements.length > 0) {
            // 如果存在已选择的元素，阻止事件传播和默认行为，并中止后续处理
            // 这是为了防止在选择状态下进行扩展选择时出现意外的行为
            event.stopPropagation();
            event.preventDefault();
            controller.abort();
            return
        }

        // 检查当前是否有选中的文本内容
        if (!range.toString()) {
            // 处理右箭头键：当光标在块末尾时，阻止默认行为（除非按下了 Option+Shift+右箭头）
            if (event.key === "ArrowRight" && isEndOfBlock(range) && !isIncludesHotKey("⌥⇧→")) {
                // 阻止浏览器默认的选择扩展行为，防止光标跳出当前块
                event.preventDefault();
                event.stopPropagation();
                controller.abort();
                return
            }
            
            // 获取当前节点的可编辑元素
            const nodeEditableElement = getContenteditableElement(nodeElement);
            if (nodeEditableElement) {
                // 获取光标在可编辑元素中的位置信息
                const position = getSelectionOffset(nodeEditableElement, protyle.wysiwyg?.element, range);
                
                // 处理左箭头键：当光标在块开头时，阻止默认行为（除非按下了 Option+Shift+左箭头）
                if (position.start === 0 && event.key === "ArrowLeft" && !isIncludesHotKey("⌥⇧←")) {
                    // 阻止浏览器默认的选择扩展行为，防止光标跳出当前块
                    event.preventDefault();
                    event.stopPropagation();
                    // 中止后续的键盘事件处理流程
                    controller.abort();
                    return
                }
            }
        }
    }
}