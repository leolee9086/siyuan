import {hasClosestBlock, hasClosestByAttribute, hasClosestByTag} from "../util/hasClosest";
import {
    focusByOffset,
    focusByRange,
    getEditorRange,
    getSelectionOffset,
    setInsertWbrHTML,
} from "../util/selection";
import {Constants} from "../../constants";
import {beforePaste, paste} from "../util/paste";
import {getContenteditableElement} from "./getBlock";
import {updateTransaction} from "./transaction/update";
import {ipcSend} from "../../platform/electron/ipcRenderer";
import {isElectron} from "../../platform";
import {isMac, isOnlyMeta} from "../util/compatibility";
import {countSelectWord} from "../runtime/status.port";
import {clearSelect} from "../util/clearSelect";
import {input} from "./input";
import {escapeInline} from "./utils/rendercustomWithCtx";
import type {PendingInputScheduler} from "./index.input.scheduler";

/**
 * 绑定 paste/compositionstart/compositionend/input/keyup/dblclick 事件。
 * 这些事件共享 isComposition 状态（用于区分输入法组合输入与普通输入），
 * 因此封装在同一函数中以避免跨文件共享可变状态。
 * @同步豁免: 遗留代码 - 从 WYSIWYG.bindEvent 中机械提取，原始代码为同步事件处理器
 *
 * @param protyle - 编辑器实例
 * @param element - wysiwyg DOM 元素
 * @param getPreventKeyup - 获取 preventKeyup 标志的回调
 * @param setPreventKeyup - 设置 preventKeyup 标志的回调
 * @param setEmptyOutline - 设置大纲高亮的回调
 */
export function bindInputEvents(
    protyle: IProtyle,
    element: HTMLElement,
    getPreventKeyup: () => boolean,
    setPreventKeyup: (v: boolean) => void,
    setEmptyOutline: (protyle: IProtyle, el: HTMLElement) => void,
    isInputSuppressed: () => boolean,
    scheduler: PendingInputScheduler,
) {
    element.addEventListener("paste", (event: ClipboardEvent & { target: HTMLElement }) => {
        if (protyle.toolbar.isMultiSelectMode()) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        // https://github.com/siyuan-note/siyuan/issues/11241
        // 上游 #17098: 使用 hasClosestByAttribute 替代直接判断
        if (hasClosestByAttribute(event.target, "data-type", "av-search")) {
            return;
        }
        if (protyle.disabled) {
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        window.siyuan.ctrlIsPressed = false; // https://github.com/siyuan-note/siyuan/issues/6373
        // https://github.com/siyuan-note/siyuan/issues/4600
        if (event.target.tagName === "PROTYLE-HTML" || event.target.localName === "input") {
            event.stopPropagation();
            return;
        }
        if (!hasClosestByAttribute(event.target, "contenteditable", "true")) {
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        const blockElement = hasClosestBlock(event.target);
        if (blockElement && !getContenteditableElement(blockElement)) {
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        if (!blockElement) {
            return;
        }
        beforePaste(protyle, blockElement);
        paste(protyle, event);
    });

    // 输入法测试点 https://github.com/siyuan-note/siyuan/issues/3027
    let isComposition = false; // for iPhone
    // 记录组合开始时的光标位置，用于取消组合后恢复光标。
    let compositionRange: { range: Range } | { cell: HTMLElement; offset: number } | undefined;
    const isAfterInlineMath = (range: Range) => {
        let previousNode: Node;
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const text = range.startContainer.textContent || "";
            if (!/^[\\n\\u200B\\uFEFF]*$/.test(text.slice(0, range.startOffset))) {
                return false;
            }
            previousNode = range.startContainer.previousSibling;
        } else {
            previousNode = range.startContainer.childNodes[range.startOffset - 1];
        }
        return previousNode?.nodeType === Node.ELEMENT_NODE &&
            (previousNode as Element).getAttribute("data-type")?.split(" ").includes("inline-math");
    };
    element.addEventListener("compositionstart", (event) => {
        isComposition = true;
        // 微软双拼由于 focusByRange 导致无法输入文字，因此不再 keydown 中记录了，但 keyup 会记录拼音字符，因此使用 isComposition 阻止 keyup 记录。
        // 但搜狗输入法选中后继续输入不走 keydown，isComposition 阻止了 keyup 记录，因此需在此记录。
        const range = getEditorRange(protyle.wysiwyg.element);
        const nodeElement = hasClosestBlock(range.startContainer);
        // 记录组合开始时光标所在的可编辑单元格与偏移，供取消组合时恢复光标
        if (nodeElement) {
            const startCell = hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH");
            if (startCell && !isAfterInlineMath(range)) {
                compositionRange = {
                    cell: startCell as HTMLElement,
                    offset: getSelectionOffset(startCell as HTMLElement, nodeElement, range).start,
                };
            } else {
                compositionRange = {range: range.cloneRange()};
            }
        } else {
            compositionRange = undefined;
        }
        if (!isMac() && nodeElement) {
            setInsertWbrHTML(nodeElement, range, protyle);
        }
        event.stopPropagation();
    });

    element.addEventListener("compositionend", (event: InputEvent) => {
        event.stopPropagation();
        isComposition = false;
        //临时修复表格光标跳转问题
        protyle.wysiwyg.element.querySelectorAll(
            ".table"
        ).forEach(
            tableBlock => {
                tableBlock.firstElementChild?.setAttribute("contenteditable", "true");
                tableBlock.querySelector(".protyle-action__table")?.setAttribute("contenteditable", "false");
            }
        );
        const range = getEditorRange(element);
        const blockElement = hasClosestBlock(range.startContainer);
        if (!blockElement) {
            return;
        }
        if ("" !== event.data) {
            escapeInline(protyle, range, event);
            // 小鹤音形 ;k 不能使用 setTimeout;
            // wysiwyg.element contenteditable 为 false 时，连拼 needRender 必须为 false
            // hr 渲染；任务列表、粗体、数学公示结尾 needRender 必须为 true
            input(protyle, blockElement, range, true);
        } else {
            const id = blockElement.getAttribute("data-node-id");
            if (protyle.wysiwyg.lastHTMLs[id]) {
                // https://github.com/siyuan-note/siyuan/issues/4604
                updateTransaction(protyle, id, blockElement.outerHTML, protyle.wysiwyg.lastHTMLs[id]);
            }
            // https://github.com/siyuan-note/siyuan/issues/17584
            if (compositionRange) {
                if ("range" in compositionRange) {
                    // https://github.com/siyuan-note/siyuan/issues/14667
                    if (element.contains(compositionRange.range.startContainer)) {
                        focusByRange(compositionRange.range);
                    }
                } else {
                    const selection = getSelection();
                    if (selection.rangeCount > 0) {
                        const afterRange = selection.getRangeAt(0);
                        const currentCell = hasClosestByTag(afterRange.startContainer, "TD") || hasClosestByTag(afterRange.startContainer, "TH");
                        if (!currentCell || currentCell !== compositionRange.cell) {
                            focusByOffset(compositionRange.cell, compositionRange.offset, compositionRange.offset);
                        }
                    } else {
                        focusByOffset(compositionRange.cell, compositionRange.offset, compositionRange.offset);
                    }
                }
            }
            compositionRange = undefined;
        }
    });

    element.addEventListener("input", (event: InputEvent) => {
        if (isInputSuppressed()) {
            event.stopPropagation();
            return;
        }
        const target = event.target as HTMLElement;
        if (target.tagName === "VIDEO" || target.tagName === "AUDIO" || event.inputType === "historyRedo") {
            return;
        }
        if (event.inputType === "historyUndo") {
            if (isElectron) {
                ipcSend(Constants.SIYUAN_CMD, "redo");
            }
            window.siyuan.menus.menu.remove();
            return;
        }
        const range = getEditorRange(element);
        const blockElement = hasClosestBlock(range.startContainer);
        if (!blockElement) {
            return;
        }
        if ([":", "(", "【", "（", "[", "{", "「", "『", "#", "/", "、"].includes(event.data)) {
            protyle.hint.enableExtend = true;
        }
        if (event.isComposing || isComposition ||
            // https://github.com/siyuan-note/siyuan/issues/337 编辑器内容拖拽问题
            event.inputType === "deleteByDrag" || event.inputType === "insertFromDrop"
        ) {
            return;
        }
        escapeInline(protyle, range, event);

        if ((/^\d{1}$/.test(event.data) || event.data === "'" || event.data === "\u201c" ||
            // 百度输入法中文反双引号 https://github.com/siyuan-note/siyuan/issues/9686
            event.data === "\u201d" ||
            event.data === "「")) {
            scheduler.schedule(() => {
                input(protyle, blockElement, range, true); // 搜狗拼音数字后面句号变为点；Mac 反向双引号无法输入
            });
        } else {
            if (isMac() && event.data === "【】") {
                scheduler.schedule(() => {
                    input(protyle, blockElement, range, true, event);
                }, Constants.TIMEOUT_INPUT, false);
            } else {
                scheduler.schedule(() => {
                    input(protyle, blockElement, range, true, event);
                });
            }
        }
        event.stopPropagation();
    });

    element.addEventListener("keyup", (event) => {
        const range = getEditorRange(element).cloneRange();
        const nodeElement = hasClosestBlock(range.startContainer);
        if (event.key !== "PageUp" && event.key !== "PageDown" && event.key !== "Home" && event.key !== "End" &&
            event.key.indexOf("Arrow") === -1 && event.key !== "Escape" && event.key !== "Shift" &&
            event.key !== "Meta" && event.key !== "Alt" && event.key !== "Control" && event.key !== "CapsLock" &&
            !event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey &&
            !/^F\d{1,2}$/.test(event.key)) {
            // 搜狗输入法不走 keydown，没有选中字符后不走 compositionstart，需重新记录历史状态
            if (!isMac() && nodeElement &&
                // 微软双拼 keyup 会记录拼音字符，因此在 compositionstart 记录
                !isComposition &&
                (typeof protyle.wysiwyg.lastHTMLs[nodeElement.getAttribute("data-node-id")] === "undefined" || range.toString() !== "" || !getPreventKeyup())) {
                setInsertWbrHTML(nodeElement, range, protyle);
            }
            setPreventKeyup(false);
            return;
        }

        // 需放在 lastHTMLs 后，否则 https://github.com/siyuan-note/siyuan/issues/4388
        if (getPreventKeyup()) {
            setPreventKeyup(false);
            return;
        }

        if ((event.shiftKey || isOnlyMeta(event)) && !event.isComposing && range.toString() !== "") {
            // 工具栏
            protyle.toolbar.render(protyle, range, event);
            countSelectWord(range, protyle.block.rootID, protyle.options.status);
        }

        if (event.eventPhase !== 3 && !event.shiftKey && (event.key.indexOf("Arrow") > -1 || event.key === "Home" || event.key === "End" || event.key === "PageUp" || event.key === "PageDown") && !event.isComposing) {
            if (nodeElement) {
                clearSelect(["img", "av"], protyle.wysiwyg.element);
                setEmptyOutline(protyle, nodeElement);
                if (range.toString() === "" && !nodeElement.classList.contains("protyle-wysiwyg--select")) {
                    countSelectWord(range, protyle.block.rootID, protyle.options.status);
                }
                if (protyle.breadcrumb) {
                    const indentElement = protyle.breadcrumb.element.parentElement.querySelector('[data-type="indent"]');
                    if (indentElement) {
                        const outdentElement = protyle.breadcrumb.element.parentElement.querySelector('[data-type="outdent"]');
                        if (nodeElement.parentElement.classList.contains("li")) {
                            indentElement.removeAttribute("disabled");
                            outdentElement.removeAttribute("disabled");
                        } else {
                            indentElement.setAttribute("disabled", "true");
                            outdentElement.setAttribute("disabled", "true");
                        }
                    }
                }
            }
            event.stopPropagation();
        }

        // 按下方向键后块高亮跟随光标移动 https://github.com/siyuan-note/siyuan/issues/8918
        if ((event.key === "ArrowLeft" || event.key === "ArrowRight") &&
            nodeElement && !nodeElement.classList.contains("protyle-wysiwyg--select")) {
            const selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
            let containRange = false;
            selectElements.find(item => {
                if (item.contains(range.startContainer)) {
                    containRange = true;
                    return true;
                }
            });
            if (!containRange && selectElements.length > 0) {
                selectElements.forEach(item => {
                    item.classList.remove("protyle-wysiwyg--select");
                });
                nodeElement.classList.add("protyle-wysiwyg--select");
            }
        }
    });
}
