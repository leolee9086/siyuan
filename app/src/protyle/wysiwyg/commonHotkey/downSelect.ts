import { countBlockWord } from "../../../layout/status";
import { hideElements } from "../../ui/hideElements";
import { handleSelectDownEmpty } from "./commonHotkeySelect";

/**
 * 处理编辑器中向下选择或扩展选择的逻辑。
 *
 * 作用：
 * - 在编辑器中实现"向下选中"功能，支持两种模式：
 *   1. 普通选中（当没有选中任何块时）：将当前光标所在块标记为选中
 *   2. 扩展选中（当已有选中块时）：通过回调函数扩展选区到下一个块
 *
 * 意图：
 * - 为 Shift+↓ 快捷键提供统一的处理逻辑
 * - 支持 "expandDown" 扩展选择快捷键（⌥⇧↓）
 * - 处理边界情况：当光标在可编辑元素末尾时的特殊处理
 *
 * 调用时机：
 * - 在 `keydown.remote.ts` 中响应普通 Shift+↓ 按键事件
 * - 在 `keydown.expandSelect.ts` 中响应 expandDown 快捷键（⌥⇧↓）
 *
 * @同步豁免: UI构建 - 该函数涉及选中元素管理、Range 操作、class 切换等 DOM 操作，
 *              且作为键盘事件处理函数需要立即响应 UI 更新
 */
export const downSelect = (options: {
    protyle: IProtyle;
    event: KeyboardEvent;
    nodeElement: HTMLElement;
    editorElement: HTMLElement;
    range: Range;
    cb: (selectElement: NodeListOf<Element>) => void;
}) => {
    if (!options.protyle.wysiwyg) {
        return;
    }
    const selectElements = options.protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");

    // 当已有选中元素时，阻止事件传播和默认行为（防止浏览器原生选择行为干扰）
    if (selectElements.length > 0) {
        options.event.stopPropagation();
        options.event.preventDefault();
    }

    // 当没有选中任何元素时，先处理空选区的特殊情况（如光标在可编辑元素末尾）
    // 如果 handleSelectDownEmpty 返回 true，表示已由该函数处理，直接返回
    if (selectElements.length === 0 && handleSelectDownEmpty(options)) {
        return;
    }

    options.range.collapse(false);
    hideElements(["toolbar"], options.protyle);

    // 首次选中：当前光标所在块没有选中状态时，将其标记为选中
    if (selectElements.length === 0) {
        options.nodeElement.classList.add("protyle-wysiwyg--select");
    }

    // 已有选中元素时，通过回调函数扩展选区（通常是选中下一个块）
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
