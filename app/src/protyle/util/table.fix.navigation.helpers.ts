import { hasClosestByClassName } from "./hasClosest";

/**
 * 检查表格块是否处于非选中状态
 *
 * 意图：导航类中间件仅在表格未被整块选中时生效，
 *       选中状态下的键盘事件由其他模块处理
 * 调用时机：每个导航中间件的前置守卫
 *
 * @param nodeElement 表格块级元素
 * @returns true表示未选中（可以处理导航），false表示已选中（跳过）
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const isNotSelected = (nodeElement: HTMLElement): boolean => {
    return !nodeElement.classList.contains("protyle-wysiwyg--select")
        && !hasClosestByClassName(nodeElement, "protyle-wysiwyg--select");
};

/**
 * 获取当前行的下一行元素，跨越thead/tbody边界
 *
 * 意图：表格的行可能分布在thead和tbody中，需要跨越这两个容器查找下一行
 * 调用时机：Enter导航和ArrowDown导航时需要定位下一行
 *
 * @param trElement 当前行元素
 * @returns 下一行元素，不存在则返回null
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const getNextRow = (trElement: HTMLTableRowElement): HTMLTableRowElement | null => {
    // 优先取同容器内的下一个兄弟行
    if (trElement.nextElementSibling instanceof HTMLTableRowElement) {
        return trElement.nextElementSibling;
    }
    // 跨越thead→tbody边界
    const nextSection = trElement.parentElement?.nextElementSibling;
    const firstChild = nextSection?.firstChild;
    if (firstChild instanceof HTMLTableRowElement) {
        return firstChild;
    }
    return null;
};

/**
 * 判断当前行是否为表格最后一行（含thead/tbody边界）
 *
 * 意图：在最后一行按Enter时需要在表格后插入空块而非跳转
 * 调用时机：handleEnterNavigation中判断是否需要插入空块
 *
 * @param trElement 当前行元素
 * @returns true表示是最后一行
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const isLastRow = (trElement: HTMLTableRowElement): boolean => {
    // tbody中无下一行
    if (!trElement.nextElementSibling && trElement.parentElement?.tagName === "TBODY") {
        return true;
    }
    // thead中且无tbody
    if (trElement.parentElement?.tagName === "THEAD" && !trElement.parentElement.nextElementSibling) {
        return true;
    }
    return false;
};

/**
 * 查找当前单元格的下一个单元格，跨越行和thead/tbody边界
 *
 * 意图：Tab导航需要按顺序遍历所有单元格，包括跨行和跨thead/tbody边界
 * 调用时机：handleTabNavigation中查找Tab前进方向的目标单元格
 *
 * @param cellElement 当前单元格
 * @returns 下一个单元格元素，不存在则返回null
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const findNextCell = (cellElement: HTMLElement): Element | null => {
    // 同行下一个单元格
    if (cellElement.nextElementSibling) {
        return cellElement.nextElementSibling;
    }
    const parentRow = cellElement.parentElement;
    // 同容器下一行的第一个单元格
    if (parentRow?.nextElementSibling) {
        return parentRow.nextElementSibling.firstElementChild;
    }
    // 跨越thead→tbody边界的第一个单元格
    if (parentRow?.parentElement?.tagName === "THEAD"
        && parentRow.parentElement.nextElementSibling) {
        return parentRow.parentElement.nextElementSibling
            .firstElementChild?.firstElementChild ?? null;
    }
    return null;
};

/**
 * 跳过单元格开头的空文本节点，找到第一个有内容的子节点
 *
 * 意图：单元格内可能存在空文本节点（如换行产生的空白），
 *       需要跳过这些节点才能正确判断光标是否在第一行
 * 调用时机：ArrowUp导航中判断光标是否在单元格第一行
 *
 * @param cellElement 单元格元素
 * @returns 第一个有内容的子节点，不存在则返回null
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const findFirstContentChild = (cellElement: HTMLElement): ChildNode | null => {
    let child = cellElement.firstChild;
    while (child) {
        // 空文本节点跳过
        if (child.textContent === "" && child.nodeType === 3) {
            child = child.nextSibling;
            continue;
        }
        return child;
    }
    return null;
};

/**
 * 跳过单元格末尾的空文本节点，找到最后一个有内容的子节点
 *
 * 意图：与findFirstContentChild对称，用于ArrowDown判断光标是否在最后一行
 * 调用时机：ArrowDown导航中判断光标是否在单元格最后一行
 *
 * @param cellElement 单元格元素
 * @returns 最后一个有内容的子节点，不存在则返回null
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const findLastContentChild = (cellElement: HTMLElement): ChildNode | null => {
    let child = cellElement.lastChild;
    while (child) {
        // 空文本节点跳过
        if (child.textContent === "" && child.nodeType === 3) {
            child = child.previousSibling;
            continue;
        }
        return child;
    }
    return null;
};

/**
 * 获取当前行的上一行元素，跨越tbody/thead边界
 *
 * 意图：ArrowUp导航需要跨越tbody→thead边界查找上一行
 * 调用时机：handleArrowUpNavigation中定位上一行
 *
 * @param trElement 当前行元素
 * @returns 上一行元素，不存在则返回null
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const getPreviousRow = (trElement: HTMLTableRowElement): HTMLTableRowElement | null => {
    // 同容器内的上一个兄弟行
    if (trElement.previousElementSibling instanceof HTMLTableRowElement) {
        return trElement.previousElementSibling;
    }
    // 跨越tbody→thead边界
    const prevSection = trElement.parentElement?.previousElementSibling;
    const lastChild = prevSection?.lastElementChild;
    if (lastChild instanceof HTMLTableRowElement) {
        return lastChild;
    }
    return null;
};

/**
 * 检查光标是否在单元格的第一行
 *
 * 意图：ArrowUp导航需要判断光标是否已在单元格第一行，
 *       只有在第一行时才跳转到上一行，否则交给浏览器默认行为
 * 调用时机：handleArrowUpNavigation中判断是否需要跨行导航
 *
 * @param cellElement 单元格元素
 * @param range 当前选区
 * @param getPosition 获取选区位置的函数
 * @returns true表示光标在第一行或无法判断
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const isCursorOnFirstLine = (
    cellElement: HTMLElement,
    range: Range,
    getPosition: (el: Element, r: Range) => { top: number },
): boolean => {
    const firstChild = findFirstContentChild(cellElement);
    if (!firstChild) {
        return true;
    }
    const rangeTemp = document.createRange();
    rangeTemp.selectNodeContents(firstChild);
    rangeTemp.collapse(true);
    const cursorRect = range.getClientRects()[0] ?? getPosition(cellElement, range);
    const firstRect = rangeTemp.getClientRects()[0] ?? getPosition(cellElement, rangeTemp);
    // 第一个内容子节点的top小于光标top，说明光标不在第一行
    if (firstRect && cursorRect && firstRect.top < cursorRect.top) {
        return false;
    }
    return true;
};

/**
 * 检查光标是否在单元格的最后一行
 *
 * 意图：ArrowDown导航需要判断光标是否已在单元格最后一行，
 *       只有在最后一行时才跳转到下一行，否则交给浏览器默认行为
 * 调用时机：handleArrowDownNavigation中判断是否需要跨行导航
 *
 * @param cellElement 单元格元素
 * @param range 当前选区
 * @param getPosition 获取选区位置的函数
 * @returns true表示光标在最后一行或无法判断
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const isCursorOnLastLine = (
    cellElement: HTMLElement,
    range: Range,
    getPosition: (el: Element, r: Range) => { top: number },
): boolean => {
    const lastChild = findLastContentChild(cellElement);
    if (!lastChild) {
        return true;
    }
    const rangeTemp = document.createRange();
    rangeTemp.selectNodeContents(lastChild);
    rangeTemp.collapse(false);
    const lastRect = rangeTemp.getClientRects()[0] ?? getPosition(cellElement, rangeTemp);
    const cursorRect = range.getClientRects()[0] ?? getPosition(cellElement, range);
    // 最后一个内容子节点的top大于光标top，说明光标不在最后一行
    if (lastRect && cursorRect && lastRect.top > cursorRect.top) {
        return false;
    }
    return true;
};
