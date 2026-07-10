/* 用途：在拖拽结束时提交表格列宽变更事务，使撤销/重做能正确恢复旧宽度。
 * 使用范围：仅在表格列拖拽的 mouseup 回调中调用。
 * 解耦评估：transaction 是 wysiwyg 层的事务引擎，表格列宽属于同级模块，通过函数直接调用合理。无法通过 DI 消除。 */
import {updateTransaction} from "./transaction";
/* 用途：导入列宽拖拽上下文的类型定义。
 * 使用范围：仅被本文件的 createTableColResizeContext 函数使用。
 * 解耦评估：类型定义是编译时产物，不产生运行时依赖。 */
import {TableColResizeContext} from "./index.mousedown.resize.types";
/* 用途：导入 mouseup 清理选项的类型定义。
 * 使用范围：仅被本文件的 handleTableColMouseup 函数使用。
 * 解耦评估：类型定义是编译时产物，不产生运行时依赖。 */
import {TableColMouseupOptions} from "./index.mousedown.resize.types";

/**
 * @同步豁免: 需要绝对同步的DOM访问 — 必须在 mousedown 事件处理过程中同步读取列宽和 DOM 属性（colIndex、colElement），
 *   异步执行会导致拖拽手柄响应延迟，用户感知卡顿。
 *
 * 初始化表格列宽拖拽上下文：解析列索引、列元素，清空最小宽度与单元格限制。
 * 列索引缺失或列元素不存在时返回空值，由调用方终止拖拽。
 */
export function createTableColResizeContext(
    target: HTMLElement,
    nodeElement: HTMLElement,
    clientX: number,
) {
    const colIndexAttr = target.getAttribute("data-col-index");
    if (colIndexAttr === null) {
        return;
    }
    const colIndex = parseInt(colIndexAttr);
    const colElements = nodeElement.querySelectorAll("table col");
    const colElement = colElements[colIndex];
    if (!(colElement instanceof HTMLElement)) {
        return;
    }
    // 清空初始化 table 时的最小宽度
    if (colElement.style.minWidth) {
        const cellElements = nodeElement.querySelectorAll("table td, table th");
        const cellElement = cellElements[colIndex];
        colElement.style.width = (cellElement instanceof HTMLElement ? cellElement.offsetWidth : colElement.clientWidth) + "px";
        colElement.style.minWidth = "";
    }
    // 移除 cell 上的宽度限制 https://github.com/siyuan-note/siyuan/issues/7795
    const trItems = nodeElement.querySelectorAll("tr");
    for (let trIndex = 0; trIndex < trItems.length; trIndex++) {
        const row = trItems[trIndex];
        if (!row) {
            continue;
        }
        const cells = row.cells;
        const cell = cells[colIndex];
        // 该行可能不包含当前索引的单元格（如表格包含行合并），跳过避免触发异常
        if (cell) {
            cell.style.width = "";
        }
    }
    const oldWidth = colElement.clientWidth;
    // 判断表格内容是否溢出容器，影响居中对齐时的倍率修正
    const firstChild = nodeElement.firstElementChild;
    const hasScroll = firstChild instanceof HTMLElement ? firstChild.clientWidth < firstChild.scrollWidth : false;
    return {colElement, html: nodeElement.outerHTML, oldWidth, x: clientX, hasScroll};
}

/**
 * @同步豁免: 需要绝对同步的DOM访问 — 该函数作为 document.onmousemove 回调，鼠标移动时必须同步更新 col 宽度；
 *   异步更新会导致拖拽过程中视觉闪烁，用户感知明显卡顿，直接影响列宽拖拽的流畅度。
 *
 * 拖拽过程中根据鼠标位移增量更新表格列宽
 */
export function updateTableColDragWidth(
    moveEvent: MouseEvent,
    context: TableColResizeContext,
    nodeElement: HTMLElement,
) {
    const isCenter = nodeElement.style.textAlign === "center" && !context.hasScroll;
    const multiplier = isCenter ? 2 : 1;
    context.colElement.style.width = (context.oldWidth + (moveEvent.clientX - context.x) * multiplier) + "px";
}

/**
 * @同步豁免: 需要绝对同步的DOM访问 — 该函数作为 document.onmouseup 回调，必须在同一事件循环内清除 onmousemove/onmouseup
 *   等处理器，防止拖拽结束后残留的回调继续执行；异步延迟清理会导致后续鼠标交互被意外拦截。
 *
 * 表格列宽拖拽结束后的清理与事务提交
 */
export function finalizeTableColDrag(options: TableColMouseupOptions) {
    const {protyle, nodeElement, html, documentSelf} = options;
    const firstChild = nodeElement.firstElementChild;
    // 恢复拖拽期间设置的 webkitUserModify 只读属性；表格被清空时 firstElementChild 可能为 null
    if (firstChild instanceof HTMLElement) {
        // @ts-ignore -- webkitUserModify 为 WebKit 私有属性，TypeScript 声明未覆盖
        firstChild.style.webkitUserModify = "";
    }
    nodeElement.style.cursor = "";
    documentSelf.onmousemove = null;
    documentSelf.onmouseup = null;
    documentSelf.ondragstart = null;
    documentSelf.onselectstart = null;
    documentSelf.onselect = null;
    updateTransaction(protyle, nodeElement, html);
}

