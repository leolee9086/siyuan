import { countBlockWord } from "../../runtime/status.port";
import { hideElements } from "../../ui/hideElements";
import { handleSelectUpEmpty } from "./commonHotkeySelect";

/**
 * 处理向上扩展选择的逻辑。
 *
 * 当用户按下向上扩展选择快捷键（如 ⌥⇧↑ 或自定义配置）时调用，
 * 用于扩展选区到上一个块或更新当前选区状态。
 *
 * 调用时机：
 * - 在 keydown.remote.ts 中处理向上扩展选择快捷键
 * - 在 keydown.expandSelect.ts 的 expandUpSelectMiddleware 中调用
 *
 * @param options - 配置选项
 * @param options.protyle - Protyle 编辑器实例
 * @param options.event - 键盘事件对象
 * @param options.nodeElement - 当前节点元素
 * @param options.editorElement - 编辑器元素
 * @param options.range - 当前选区范围
 * @param options.cb - 当已有选中元素时的回调函数
 */
export const upSelect = async (options: {
    protyle: IProtyle;
    event: KeyboardEvent;
    nodeElement: HTMLElement;
    editorElement: HTMLElement;
    range: Range;
    cb: (selectElements: NodeListOf<Element>) => void;
}) => {
    if (!options.protyle.wysiwyg) {
        return;
    }
    const selectElements = options.protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    // 当已有选中元素时，阻止事件冒泡和默认行为，避免与其他事件处理冲突
    if (selectElements.length > 0) {
        options.event.stopPropagation();
        options.event.preventDefault();
    }

    // 当没有选中元素时，尝试处理向上选择的空白情况（如光标在可编辑元素开头附近）
    // 如果 handleSelectUpEmpty 返回 true，表示已处理完毕，直接返回
    if (selectElements.length === 0 && handleSelectUpEmpty(options)) {
        return;
    }
    options.range.collapse(true);
    hideElements(["toolbar"], options.protyle);
    // 当没有选中元素时，给当前节点添加选中样式，标记为已选中状态
    if (selectElements.length === 0) {
        options.nodeElement.classList.add("protyle-wysiwyg--select");
    }

    // 当已有选中元素时，执行回调函数进行额外的选区处理（如扩展到上一个块）
    if (selectElements.length > 0) {
        options.cb(selectElements);
    }
    const ids: string[] = [];
    for (const item of options.protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select")) {
        const id = item.getAttribute("data-node-id");
        if (id) {
            ids.push(id);
        }
    }
    countBlockWord(ids, options.protyle.block.rootID, false, options.protyle.options.status);
    options.event.stopPropagation();
    options.event.preventDefault();
};
