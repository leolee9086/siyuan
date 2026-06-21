import { countBlockWord } from "../../layout/status";
import { hideElements } from "../ui/hideElements";
import { Scroll } from "../scroll";
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
    if (!(event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight"))) {
        return;
    }

    // 检查编辑器中是否存在已选择的元素（.protyle-wysiwyg--select 类名的元素）
    const selectElements = protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--select");
    if (selectElements && selectElements.length > 0) {
        // 如果存在已选择的元素，阻止事件传播和默认行为，并中止后续处理
        // 这是为了防止在选择状态下进行扩展选择时出现意外的行为
        event.stopPropagation();
        event.preventDefault();
        controller.abort("阻止选择状态下的扩展选择");
        return;
    }

    // 有选中文本时不处理
    if (range.toString()) {
        return;
    }

    // 处理右箭头键：当光标在块末尾时，阻止默认行为（除非按下了 Option+Shift+右箭头）
    if (event.key === "ArrowRight" && isEndOfBlock(range) && !isIncludesHotKey("⌥⇧→")) {
        // 阻止浏览器默认的选择扩展行为，防止光标跳出当前块
        event.preventDefault();
        event.stopPropagation();
        controller.abort("阻止块末尾的右箭头扩展");
        return;
    }

    // 获取当前节点的可编辑元素
    const nodeEditableElement = getContenteditableElement(nodeElement);
    if (!nodeEditableElement) {
        return;
    }

    // 获取光标在可编辑元素中的位置信息
    const position = getSelectionOffset(nodeEditableElement, protyle.wysiwyg?.element, range);

    // 处理左箭头键：当光标在块开头时，阻止默认行为（除非按下了 Option+Shift+左箭头）
    if (position.start === 0 && range.startOffset === 0 && event.key === "ArrowLeft" && !isIncludesHotKey("⌥⇧←")) {
        // 阻止浏览器默认的选择扩展行为，防止光标跳出当前块
        event.preventDefault();
        event.stopPropagation();
        // 中止后续的键盘事件处理流程
        controller.abort("阻止块开头的左箭头扩展");
    }
};



/**
 * 尝试将 Element 转换为 HTMLElement
 */
const toHTMLElement = (element: Element | null): HTMLElement | null => {
    return element instanceof HTMLElement ? element : null;
};

/**
 * 获取下一个可选择的块元素
 *
 * 处理折叠块和超级块/引用块的特殊情况
 */
const getNextSelectableBlock = (currentElement: HTMLElement): HTMLElement => {
    const nextElement = toHTMLElement(getNextBlock(currentElement) || null);
    if (!nextElement) {
        return currentElement;
    }

    // 处理宽度为0的隐藏元素（折叠状态）
    // https://github.com/siyuan-note/siyuan/issues/4294
    const isHiddenElement = nextElement.getBoundingClientRect().width === 0;
    const foldElement = isHiddenElement
        ? hasTopClosestByAttribute(nextElement, "fold", "1")
        : null;

    // 隐藏元素但没有折叠容器，返回当前元素
    if (isHiddenElement && !foldElement) {
        return currentElement;
    }

    // 隐藏元素且有折叠容器的情况
    // 此时 TypeScript 知道 foldElement 是 HTMLElement（排除了 false）
    const afterFoldElement = isHiddenElement && foldElement
        ? toHTMLElement(getNextBlock(foldElement) || null)
        : null;

    // 隐藏元素有折叠容器但折叠容器后无元素，返回当前元素
    if (isHiddenElement && foldElement && !afterFoldElement) {
        return currentElement;
    }

    // 隐藏元素有折叠容器且折叠容器后有元素，跳到该元素的第一个子块
    if (isHiddenElement && foldElement && afterFoldElement) {
        return toHTMLElement(getFirstBlock(afterFoldElement)) ?? currentElement;
    }

    // 处理折叠的超级块或引用块
    // https://github.com/siyuan-note/siyuan/issues/3913
    const isFoldedSuperOrQuoteBlock = nextElement.getAttribute("fold") === "1"
        && (nextElement.classList.contains("sb") || nextElement.classList.contains("bq"));
    if (isFoldedSuperOrQuoteBlock) {
        return nextElement;
    }

    return toHTMLElement(getFirstBlock(nextElement)) ?? currentElement;
};

/**
 * 获取上一个可选择的块元素
 *
 * 处理折叠块和超级块/引用块的特殊情况
 */
const getPreviousSelectableBlock = (
    firstSelectedElement: Element,
    selectElements: NodeListOf<Element>
): HTMLElement | null => {
    const rawPrevBlock = getPreviousBlock(firstSelectedElement);
    // getPreviousBlock 可能返回 false | Element | undefined，统一转换为 Element | null
    const prevBlock = toHTMLElement(rawPrevBlock || null);
    if (!prevBlock) {
        return null;
    }

    const previousElement = toHTMLElement(getLastBlock(prevBlock));
    if (!previousElement) {
        return null;
    }

    // 处理宽度为0的隐藏元素（折叠状态）
    // https://github.com/siyuan-note/siyuan/issues/4294
    const isHiddenPreviousElement = previousElement.getBoundingClientRect().width === 0;
    const prevFoldElement = isHiddenPreviousElement
        ? hasTopClosestByAttribute(previousElement, "fold", "1")
        : null;

    if (isHiddenPreviousElement && prevFoldElement) {
        return toHTMLElement(getFirstBlock(prevFoldElement));
    }
    if (isHiddenPreviousElement && !prevFoldElement) {
        const firstSelected = selectElements[0];
        return firstSelected instanceof HTMLElement ? firstSelected : null;
    }

    // 处理折叠的超级块或引用块
    // https://github.com/siyuan-note/siyuan/issues/3913
    const foldElement = hasTopClosestByAttribute(previousElement, "fold", "1");
    const isFoldedSuperOrQuoteBlock = foldElement
        && (foldElement.classList.contains("sb") || foldElement.classList.contains("bq"));
    if (isFoldedSuperOrQuoteBlock) {
        return foldElement;
    }

    return previousElement;
};

/**
 * 选中块元素并滚动到可见区域
 */
const selectAndScrollToBlock = (
    element: HTMLElement,
    contentElement: HTMLElement,
    scrollRecord: Scroll,
    direction: "up" | "down"
): void => {
    element.classList.add("protyle-wysiwyg--select");

    const dataNodeId = element.getAttribute("data-node-id");
    if (!dataNodeId) {
        throw new Error("块元素缺少data-node-id属性");
    }
    countBlockWord([dataNodeId]);

    const contentRect = contentElement.getBoundingClientRect();

    // 处理向下滚动
    if (direction === "down") {
        const bottom = element.getBoundingClientRect().bottom - contentRect.bottom;
        const 需要向下滚动 = bottom > 0;
        contentElement.scrollTop += 需要向下滚动 ? bottom : 0;
        scrollRecord.lastScrollTop = 需要向下滚动
            ? contentElement.scrollTop - 1
            : scrollRecord.lastScrollTop;
        focusBlock(element);
        return;
    }

    // 处理向上滚动
    const top = element.getBoundingClientRect().top - contentRect.top;
    if (top < 0) {
        contentElement.scrollTop = contentElement.scrollTop + top;
        scrollRecord.lastScrollTop = contentElement.scrollTop + 1;
    }

    focusBlock(element);
};

/**
 * 处理向下箭头键的选择逻辑
 */
const handleArrowDown = (
    selectElements: NodeListOf<Element>,
    contentElement: HTMLElement,
    scrollRecord: Scroll
): void => {
    const lastElement = selectElements[selectElements.length - 1];
    if (!(lastElement instanceof HTMLElement)) {
        throw new Error("selectElements 中的元素不是 HTMLElement");
    }
    const nextElement = getNextSelectableBlock(lastElement);
    selectAndScrollToBlock(nextElement, contentElement, scrollRecord, "down");
};

/**
 * 处理向上箭头键的选择逻辑
 *
 * @returns 是否已完成处理（用于判断是否需要中止事件传播）
 */
const handleArrowUp = (
    event: KeyboardEvent,
    protyle: IProtyle,
    range: Range,
    selectElements: NodeListOf<Element>,
    contentElement: HTMLElement,
    scrollRecord: Scroll
): boolean => {
    const firstSelectedElement = selectElements[0];
    if (!firstSelectedElement) {
        throw new Error("找不到选中元素");
    }

    const previousElement = getPreviousSelectableBlock(firstSelectedElement, selectElements);

    if (previousElement) {
        selectAndScrollToBlock(previousElement, contentElement, scrollRecord, "up");
        return true;
    }

    // 处理到达顶部的特殊情况
    if (protyle.title?.editElement &&
        (protyle.wysiwyg?.element.firstElementChild?.getAttribute("data-eof") === "1"
            || contentElement.scrollTop === 0)) {
        const titleRange = setLastNodeRange(protyle.title.editElement, range, false);
        titleRange.collapse(false);
        focusByRange(titleRange);
        event.stopPropagation();
        event.preventDefault();
        return true;
    }

    if (contentElement.scrollTop !== 0) {
        contentElement.scrollTop = 0;
        scrollRecord.lastScrollTop = 8;
        return true;
    }

    // 保持当前选中元素
    const firstElement = selectElements[0];
    if (!(firstElement instanceof HTMLElement)) {
        throw new Error("selectElements 中的元素不是 HTMLElement");
    }
    selectAndScrollToBlock(firstElement, contentElement, scrollRecord, "up");
    return true;
};

/**
 * 上下方向键选区扩展中间件
 *
 * 该函数处理上下方向键的块选择行为，在有选中块的情况下，
 * 控制选择移动到上一个或下一个块。
 */
export const arrowUpDownMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
): void => {
    // 只处理不带修饰键的上下方向键
    const isArrowUpDown = event.key === "ArrowDown" || event.key === "ArrowUp";
    if (event.altKey || event.shiftKey || !isNotCtrl(event) || !isArrowUpDown) {
        return;
    }

    if (!protyle.wysiwyg) {
        throw new Error("protyle结构错误");
    }

    const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    if (selectElements.length === 0) {
        return;
    }

    const contentElement = protyle.contentElement;
    if (!contentElement) {
        throw new Error("protyle结构错误,缺少contentElement");
    }

    const scrollRecord = protyle.scroll;
    if (!scrollRecord) {
        throw new Error("protyle结构错误,缺少scroll");
    }

    event.preventDefault();
    event.stopPropagation();
    hideElements(["select"], protyle);

    if (event.key === "ArrowDown") {
        handleArrowDown(selectElements, contentElement, scrollRecord);
        controller.abort("上下箭头：向下选择块");
        return;
    }

    // ArrowUp
    handleArrowUp(event, protyle, range, selectElements, contentElement, scrollRecord);
    controller.abort("上下箭头：向上选择块");
};
