import {scrollToView} from "./table.helpers";
import {updateTransaction} from "../../wysiwyg/transaction";
import {
    focusByWbr,
    focusByRange,
} from "./selection";
import {scrollCenter} from "../../../util/DOM/highlightById";
import {getColIndex} from "./table";
import {
    buildRowAboveHTML,
    adjustRowSpanForInsert,
    insertAboveInThead,
    swapRowUpToThead,
    swapRowDownToTbody,
} from "./table.row.helpers";

/**
 * 在当前行下方插入新行
 *
 * 作用：在表格中指定单元格所在行的下方插入一行或多行空行
 * 意图：提供表格行追加能力，支持 Tab 到末尾自动新增行、快捷键插入行等场景
 * 调用时机：
 *   - 用户在表格最后一个单元格按 Tab 时自动追加新行
 *   - 用户按下"下方插入行"快捷键时（通过 fixTable 分发）
 *   - 右键菜单"下方插入行"操作（通过 menus/protyle.ts）
 *
 * @param protyle - 编辑器实例
 * @param range - 当前选区
 * @param cellElement - 当前单元格元素
 * @param nodeElement - 表格所在的块级节点元素
 * @param count - 插入行数，默认1
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 表格行插入需要同步修改DOM结构、更新选区位置并立即提交事务，异步会导致DOM状态不一致 */
export const insertRow = (protyle: IProtyle, range: Range, cellElement: HTMLElement, nodeElement: Element, count = 1) => {
    const wbrElement = document.createElement("wbr");
    range.insertNode(wbrElement);
    const html = nodeElement.outerHTML;
    wbrElement.remove();

    let rowHTML = "";
    const parentEl = cellElement.parentElement;
    if (!parentEl) {
        return;
    }
    for (let m = 0; m < parentEl.childElementCount; m++) {
        const childEl = parentEl.children[m];
        rowHTML += `<td align="${childEl?.getAttribute("align") ?? ""}"></td>`;
    }
    let newRowElement: HTMLTableRowElement | undefined;
    const tbodyElement = nodeElement.querySelector("tbody");
    // TH 单元格且 tbody 已存在：直接在 tbody 开头插入新行
    if (cellElement.tagName === "TH" && tbodyElement) {
        tbodyElement.insertAdjacentHTML("afterbegin", `<tr>${rowHTML}</tr>`.repeat(count));
        const firstChild = tbodyElement.firstElementChild;
        newRowElement = firstChild instanceof HTMLTableRowElement ? firstChild : undefined;
    }
    // TH 单元格且 tbody 不存在：需要在 thead 后创建新的 tbody
    if (cellElement.tagName === "TH" && !tbodyElement && parentEl.parentElement) {
        parentEl.parentElement.insertAdjacentHTML("afterend", `<tbody>${`<tr>${rowHTML}</tr>`.repeat(count)}</tbody>`);
        const nextSibling = parentEl.parentElement.nextElementSibling?.firstElementChild;
        newRowElement = nextSibling instanceof HTMLTableRowElement ? nextSibling : undefined;
    }
    // TD 单元格直接在当前行后插入
    if (cellElement.tagName !== "TH") {
        parentEl.insertAdjacentHTML("afterend", `<tr>${rowHTML}</tr>`.repeat(count));
        const nextSibling = parentEl.nextElementSibling;
        newRowElement = nextSibling instanceof HTMLTableRowElement ? nextSibling : undefined;
    }
    if (!newRowElement) {
        return;
    }
    const targetCell = newRowElement.cells[getColIndex(cellElement)];
    // 将光标定位到新行的对应列单元格
    if (targetCell) {
        range.selectNodeContents(targetCell);
        range.collapse(true);
    }
    focusByRange(range);
    const nodeId = nodeElement.getAttribute("data-node-id");
    // 提交事务记录操作
    if (nodeId) {
        updateTransaction(protyle, nodeId, nodeElement.outerHTML, html);
    }
    scrollToView(nodeElement, newRowElement, protyle);
};

/**
 * 在当前行上方插入新行
 *
 * 作用：在表格中指定单元格所在行的上方插入一行或多行
 * 意图：提供表格行前插能力，处理 thead/tbody 边界、合并单元格 rowSpan 调整等复杂场景
 * 调用时机：用户按下"上方插入行"快捷键时（通过 fixTable 分发），或右键菜单操作
 * 问题/改进：当在 thead 第一行上方插入时，需要将原 thead 行降级为 tbody 行，逻辑较复杂
 *
 * @param protyle - 编辑器实例
 * @param range - 当前选区
 * @param cellElement - 当前单元格元素
 * @param nodeElement - 表格所在的块级节点元素
 * @param count - 插入行数，默认1
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 表格行插入涉及 thead/tbody 结构变更和 rowSpan 调整，必须同步完成以保证DOM一致性 */
export const insertRowAbove = (protyle: IProtyle, range: Range, cellElement: HTMLElement, nodeElement: Element, count = 1) => {
    const wbrElement = document.createElement("wbr");
    range.insertNode(wbrElement);
    const html = nodeElement.outerHTML;
    wbrElement.remove();

    const parentEl = cellElement.parentElement;
    if (!parentEl) {
        return;
    }
    const {rowHTML, hasNone} = buildRowAboveHTML(parentEl, cellElement.tagName);
    // 存在合并单元格时，需要调整上方行中跨越当前行的 rowSpan 值
    if (hasNone) {
        adjustRowSpanForInsert(parentEl);
    }
    const grandParent = parentEl.parentElement;
    let newRowElement: HTMLTableRowElement | undefined;
    // 在 thead 第一行上方插入时，需要创建新的 thead 并将原行降级到 tbody
    if (grandParent && grandParent.tagName === "THEAD" && !parentEl.previousElementSibling) {
        newRowElement = insertAboveInThead(grandParent, nodeElement, rowHTML, count);
    }
    // 非 thead 第一行的普通情况：直接在当前行前插入
    if (!newRowElement) {
        parentEl.insertAdjacentHTML("beforebegin", `<tr>${rowHTML}</tr>`.repeat(count));
        const prevSibling = parentEl.previousElementSibling;
        newRowElement = prevSibling instanceof HTMLTableRowElement ? prevSibling : undefined;
    }
    if (!newRowElement) {
        return;
    }
    const targetCell = newRowElement.cells[getColIndex(cellElement)];
    // 将光标定位到新行的对应列单元格
    if (targetCell) {
        range.selectNodeContents(targetCell);
        range.collapse(true);
    }
    focusByRange(range);
    const nodeId = nodeElement.getAttribute("data-node-id");
    // 提交事务记录操作
    if (nodeId) {
        updateTransaction(protyle, nodeId, nodeElement.outerHTML, html);
    }
    scrollToView(nodeElement, newRowElement, protyle);
};

/**
 * 删除当前行
 *
 * 作用：删除表格中指定单元格所在的行，并将光标移动到上一行同列位置
 * 意图：提供表格行删除能力，处理 tbody 只剩一行时整体移除 tbody 的边界情况
 * 调用时机：用户按下"删除行"快捷键时（通过 fixTable 分发），或右键菜单操作
 * 注意：thead 行不允许删除，仅 tbody 行可删除
 *
 * @param protyle - 编辑器实例
 * @param range - 当前选区
 * @param cellElement - 当前单元格元素
 * @param nodeElement - 表格所在的块级节点元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 删除行后需要同步移动光标到上一行，异步会导致光标位置错误 */
export const deleteRow = (protyle: IProtyle, range: Range, cellElement: HTMLElement, nodeElement: Element) => {
    const parentEl = cellElement.parentElement;
    if (!parentEl || !parentEl.parentElement) {
        return;
    }
    // thead 行不允许删除
    if (parentEl.parentElement.tagName === "THEAD") {
        return;
    }
    const wbrElement = document.createElement("wbr");
    range.insertNode(wbrElement);
    const html = nodeElement.outerHTML;
    wbrElement.remove();
    const index = getColIndex(cellElement);
    const tbodyElement = parentEl.parentElement;
    const prevSiblingEl = tbodyElement.previousElementSibling;
    const lastElOfPrev = prevSiblingEl?.lastElementChild;
    let previousTrElement: Element | undefined = lastElOfPrev instanceof HTMLTableRowElement ? lastElOfPrev : undefined;
    // 同 tbody 内有前驱行时，优先使用前驱行作为光标目标
    if (parentEl.previousElementSibling instanceof HTMLTableRowElement) {
        previousTrElement = parentEl.previousElementSibling;
    }
    // tbody 只剩一行时，删除整个 tbody 节点
    if (tbodyElement.childElementCount === 1) {
        tbodyElement.remove();
    }
    // tbody 有多行时，仅删除当前行
    if (tbodyElement.childElementCount > 1) {
        parentEl.remove();
    }
    const targetCell = previousTrElement instanceof HTMLTableRowElement ? previousTrElement.cells[index] : undefined;
    // 上一行存在且对应列单元格有效时，将光标移动到该位置
    if (targetCell && previousTrElement instanceof HTMLTableRowElement) {
        range.selectNodeContents(targetCell);
        range.collapse(true);
        focusByRange(range);
        scrollToView(nodeElement, previousTrElement, protyle);
    }
    const nodeId = nodeElement.getAttribute("data-node-id");
    // 提交事务记录操作
    if (nodeId) {
        updateTransaction(protyle, nodeId, nodeElement.outerHTML, html);
    }
};

/**
 * 将当前行上移一行
 *
 * 作用：将表格中指定单元格所在行与上一行交换位置
 * 意图：提供表格行排序能力，处理 tbody 首行与 thead 行交换时的 th/td 标签转换
 * 调用时机：用户按下"上移行"快捷键时（通过 fixTable 分发），或右键菜单操作
 * 注意：thead 行不允许上移
 *
 * @param protyle - 编辑器实例
 * @param range - 当前选区
 * @param cellElement - 当前单元格元素
 * @param nodeElement - 表格所在的块级节点元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 行移动涉及多个DOM节点的同步重排和 th/td 标签转换，必须原子性完成 */
export const moveRowToUp = (protyle: IProtyle, range: Range, cellElement: HTMLElement, nodeElement: Element) => {
    const rowElement = cellElement.parentElement;
    if (!rowElement?.parentElement) {
        return;
    }
    // thead 行不允许上移
    if (rowElement.parentElement.tagName === "THEAD") {
        return;
    }
    range.insertNode(document.createElement("wbr"));
    const html = nodeElement.outerHTML;
    // 有上一行兄弟时直接交换
    if (rowElement.previousElementSibling) {
        rowElement.after(rowElement.previousElementSibling);
    }
    // tbody 首行上移需要与 thead 行交换，涉及 th↔td 标签转换
    if (!rowElement.previousElementSibling) {
        swapRowUpToThead(rowElement);
    }
    const nodeId = nodeElement.getAttribute("data-node-id");
    // 提交事务记录操作
    if (nodeId) {
        updateTransaction(protyle, nodeId, nodeElement.outerHTML, html);
    }
    focusByWbr(nodeElement, range);
    scrollCenter(protyle, rowElement);
};

/**
 * 将当前行下移一行
 *
 * 作用：将表格中指定单元格所在行与下一行交换位置
 * 意图：提供表格行排序能力，处理 thead 行下移到 tbody 时的 th/td 标签转换
 * 调用时机：用户按下"下移行"快捷键时（通过 fixTable 分发），或右键菜单操作
 * 注意：tbody 末行和无 tbody 的 thead 行不允许下移
 *
 * @param protyle - 编辑器实例
 * @param range - 当前选区
 * @param cellElement - 当前单元格元素
 * @param nodeElement - 表格所在的块级节点元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 行移动涉及多个DOM节点的同步重排和 th/td 标签转换，必须原子性完成 */
export const moveRowToDown = (protyle: IProtyle, range: Range, cellElement: HTMLElement, nodeElement: Element) => {
    const rowElement = cellElement.parentElement;
    if (!rowElement?.parentElement) {
        return;
    }
    // tbody 末行或无后续 section 的 thead 行不允许下移
    if (rowElement.parentElement.tagName === "TBODY" && !rowElement.nextElementSibling) {
        return;
    }
    if (rowElement.parentElement.tagName === "THEAD" && !rowElement.parentElement.nextElementSibling) {
        return;
    }
    range.insertNode(document.createElement("wbr"));
    const html = nodeElement.outerHTML;
    // 有下一行兄弟时直接交换
    if (rowElement.nextElementSibling) {
        rowElement.before(rowElement.nextElementSibling);
    }
    // thead 行下移需要与 tbody 首行交换，涉及 td↔th 标签转换
    if (!rowElement.nextElementSibling && rowElement.parentElement.nextElementSibling) {
        swapRowDownToTbody(rowElement);
    }
    const nodeId = nodeElement.getAttribute("data-node-id");
    // 提交事务记录操作
    if (nodeId) {
        updateTransaction(protyle, nodeId, nodeElement.outerHTML, html);
    }
    focusByWbr(nodeElement, range);
    scrollCenter(protyle, rowElement);
};


