import {scrollCenter} from "../../../util/DOM/highlightById";

/**
 * 将表格行滚动到视图中可见位置
 * @作用: 确保用户在表格中操作时能清晰看到当前行
 * @意图: 解决大表格中当前行可能被滚动条遮挡的问题
 * @调用时机: 插入/删除/移动行后，需要将焦点行滚动到视图中心
 * @参数说明:
 *   - nodeElement: 表格块元素
 *   - rowElement: 需要滚动到视图的行元素
 *   - protyle: 编辑器实例
 * @问题/改进: 需要考虑自定义冻结表头(custom-pinthead)的特殊处理
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 直接操作DOM滚动位置 */
export const scrollToView = (nodeElement: Element, rowElement: HTMLElement, protyle: IProtyle) => {
    // 检查是否启用了自定义冻结表头功能
    const hasCustomPinhead = nodeElement.getAttribute("custom-pinthead") === "true";

    // 无自定义冻结表头时，使用通用的居中滚动
    if (!hasCustomPinhead) {
        scrollCenter(protyle, rowElement);
        return;
    }

    // 自定义冻结表头模式：计算精确的滚动位置
    const tableElement = nodeElement.querySelector("table");
    if (!tableElement) {
        return;
    }

    const isBelowViewport = tableElement.clientHeight + tableElement.scrollTop < rowElement.offsetTop + rowElement.clientHeight;
    const isAboveViewport = tableElement.scrollTop > rowElement.offsetTop - rowElement.clientHeight;

    // 行在视口下方：向下滚动以显示该行
    if (isBelowViewport) {
        tableElement.scrollTop = rowElement.offsetTop - tableElement.clientHeight + rowElement.clientHeight + 1;
        return;
    }

    // 行在视口上方：向上滚动以显示该行
    if (isAboveViewport) {
        tableElement.scrollTop = rowElement.offsetTop - rowElement.clientHeight + 1;
    }
};

/**
 * 将光标移动到前一个单元格
 * @作用: 处理表格中光标向上一格移动的逻辑
 * @意图: 支持键盘导航（如Shift+Tab、Backspace等场景）
 * @调用时机: 用户在表格中使用键盘快捷键移动焦点时
 * @参数说明:
 *   - cellElement: 当前单元格元素
 *   - range: 选区范围对象
 *   - isSelected: 是否选中新单元格的全部内容
 * @returns: 前一个单元格元素，如果不存在则返回null
 * @问题/改进: 跨THEAD/TBODY边界的逻辑较复杂，需要仔细测试
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 直接操作Range和DOM元素 */
export const goPreviousCell = (cellElement: HTMLElement, range: Range, isSelected = true): Element | null => {
    // 尝试获取同一行的前一个单元格
    let previousElement = cellElement.previousElementSibling;

    // 当前行没有前一个单元格时，尝试跳到上一行的最后一个单元格
    const parentRow = cellElement.parentElement;
    const hasPreviousRow = !previousElement && parentRow?.previousElementSibling;

    // 同一行内没有前一个单元格，但存在上一行时，跳转到上一行最后一个单元格
    if (hasPreviousRow) {
        previousElement = parentRow.previousElementSibling.lastElementChild;
    }

    // 跨越THEAD/TBODY边界的情况：从TBODY第一行跳到THEAD最后一行
    const parentTbody = parentRow?.parentElement;
    const isInTbody = parentTbody?.tagName === "TBODY";
    const hasPreviousSibling = parentTbody?.previousElementSibling !== null;
    const needsCrossBoundary = !previousElement && isInTbody && hasPreviousSibling;

    // 需要跨THEAD/TBODY边界跳转时，获取THEAD的最后一行的最后一个单元格
    if (needsCrossBoundary) {
        const theadLastRow = parentTbody.previousElementSibling.lastElementChild;
        previousElement = theadLastRow?.lastElementChild ?? null;
    }

    // 未找到前一个单元格时，直接返回null
    if (!previousElement) {
        return null;
    }

    // 设置光标到新单元格
    range.selectNodeContents(previousElement);

    // 不需要选中全部内容时，将光标折叠到末尾
    if (!isSelected) {
        range.collapse(false);
    }

    return previousElement;
};
