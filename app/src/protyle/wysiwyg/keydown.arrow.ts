import { countBlockWord } from "../../layout/status";
import { hideElements } from "../ui/hideElements";
import { isNotCtrl } from "../util/compatibility";
import { hasTopClosestByAttribute } from "../util/hasClosest";
import { isIncludesHotKey } from "../util/hotKey";
import { focusBlock, focusByRange, getSelectionOffset, setLastNodeRange } from "../util/selection";
import { getContenteditableElement, getFirstBlock, getLastBlock, getNextBlock, getPreviousBlock, isEndOfBlock } from "./getBlock";


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
            controller.abort("阻止选择状态下的扩展选择");
            return
        }

        // 检查当前是否有选中的文本内容
        if (!range.toString()) {
            // 处理右箭头键：当光标在块末尾时，阻止默认行为（除非按下了 Option+Shift+右箭头）
            if (event.key === "ArrowRight" && isEndOfBlock(range) && !isIncludesHotKey("⌥⇧→")) {
                // 阻止浏览器默认的选择扩展行为，防止光标跳出当前块
                event.preventDefault();
                event.stopPropagation();
                controller.abort("阻止块末尾的右箭头扩展");
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
                    controller.abort("阻止块开头的左箭头扩展");
                    return
                }
            }
        }
    }
}



export const arrowUpDownMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (!event.altKey && !event.shiftKey && isNotCtrl(event) && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        if (
            !protyle.wysiwyg
        ) {
            throw new Error("protyle结构错误")
        }
        const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
        const firstSelectedElement = selectElements[0]
        if (!firstSelectedElement) {
            throw new Error("找不到选中元素")
        }
        const contentElement = protyle.contentElement
        if (!contentElement) {
            throw ("protyle结构错误,缺少contentElement")
        }
        const scrollRecord = protyle.scroll
        if (!scrollRecord) {
            throw new Error("protyle结构错误,缺少scroll")
        }

        if (selectElements.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            hideElements(["select"], protyle);
            if (event.key === "ArrowDown") {
                const currentSelectElement = selectElements[selectElements.length - 1] as HTMLElement;
                let nextElement = getNextBlock(currentSelectElement) as HTMLElement;
                if (nextElement) {
                    if (nextElement.getBoundingClientRect().width === 0) {
                        // https://github.com/siyuan-note/siyuan/issues/4294
                        const foldElement = hasTopClosestByAttribute(nextElement, "fold", "1");
                        if (foldElement) {
                            nextElement = getNextBlock(foldElement) as HTMLElement;
                            if (nextElement) {
                                nextElement = getFirstBlock(nextElement) as HTMLElement;
                            } else {
                                nextElement = currentSelectElement;
                            }
                        } else {
                            nextElement = currentSelectElement;
                        }
                    } else if (nextElement.getAttribute("fold") === "1"
                        && (nextElement.classList.contains("sb") || nextElement.classList.contains("bq"))) {
                        // https://github.com/siyuan-note/siyuan/issues/3913
                    } else {
                        nextElement = getFirstBlock(nextElement) as HTMLElement;
                    }
                } else {
                    nextElement = currentSelectElement;
                }

                nextElement.classList.add("protyle-wysiwyg--select");
                const nexDataNodeId = nextElement.getAttribute("data-node-id")
                if (!nexDataNodeId) {
                    throw new Error("块元素缺少data-node-id属性")
                }
                countBlockWord([nexDataNodeId]);

                const bottom = nextElement.getBoundingClientRect().bottom - contentElement.getBoundingClientRect().bottom;
                if (bottom > 0) {
                    contentElement.scrollTop = contentElement.scrollTop + bottom;
                    scrollRecord.lastScrollTop = contentElement.scrollTop - 1;
                }
                focusBlock(nextElement);
            } else if (event.key === "ArrowUp") {

                let previousElement: HTMLElement = getPreviousBlock(firstSelectedElement) as HTMLElement;
                if (previousElement) {
                    previousElement = getLastBlock(previousElement) as HTMLElement;
                    if (previousElement.getBoundingClientRect().width === 0) {
                        // https://github.com/siyuan-note/siyuan/issues/4294
                        const foldElement = hasTopClosestByAttribute(previousElement, "fold", "1");
                        if (foldElement) {
                            previousElement = getFirstBlock(foldElement) as HTMLElement;
                        } else {
                            previousElement = selectElements[0] as HTMLElement;
                        }
                    } else if (previousElement) {
                        // https://github.com/siyuan-note/siyuan/issues/3913
                        const foldElement = hasTopClosestByAttribute(previousElement, "fold", "1");
                        if (foldElement && (foldElement.classList.contains("sb") || foldElement.classList.contains("bq"))) {
                            previousElement = foldElement;
                        }
                    }
                } else if (protyle.title && protyle.title.editElement &&
                    (protyle.wysiwyg.element.firstElementChild?.getAttribute("data-eof") === "1" || contentElement.scrollTop === 0)) {
                    const titleRange = setLastNodeRange(protyle.title.editElement, range, false);
                    titleRange.collapse(false);
                    focusByRange(titleRange);
                    event.stopPropagation();
                    event.preventDefault();
                } else if (contentElement.scrollTop !== 0) {
                    contentElement.scrollTop = 0;
                    scrollRecord.lastScrollTop = 8;
                } else {
                    previousElement = selectElements[0] as HTMLElement;
                }
                if (previousElement) {
                    previousElement.classList.add("protyle-wysiwyg--select");
                    const previousDataNodeId = previousElement.getAttribute("data-node-id")
                    if (!previousDataNodeId) {
                        throw new Error("DOM结构错误,缺少data-node-id")
                    }
                    countBlockWord([previousDataNodeId]);
                    const top = previousElement.getBoundingClientRect().top - contentElement.getBoundingClientRect().top;
                    if (top < 0) {
                        contentElement.scrollTop = contentElement.scrollTop + top;
                        scrollRecord.lastScrollTop = contentElement.scrollTop + 1;
                    }
                    focusBlock(previousElement);
                }
            }
            controller.abort()
            return;
        }
    }
}