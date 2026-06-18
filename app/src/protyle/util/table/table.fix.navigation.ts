import { insertEmptyBlock } from "../../../block/util";
import { scrollCenter } from "../../../util/DOM/highlightById";
import { getSiyuanEditorGeneralKeymap } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isNotCtrl } from "../compatibility";
import { matchHotKey } from "../hotKey";
import { getSelectionOffset } from "../selection";
import { focusBlock } from "../selection.focus";
import { getSelectionPosition } from "../selection.position";
import { getColIndex, setTableAlign } from "./table";
import { goPreviousCell } from "./table.helpers";
import { TableFixContext } from "./table.fix.types";
import {
    isNotSelected, getNextRow, isLastRow,
    findNextCell, getPreviousRow,
    isCursorOnFirstLine, isCursorOnLastLine,
} from "./table.fix.navigation.helpers";
import { insertRow } from "./table.row";

/**
 * Enter键导航中间件：光标跳转到下一行同列
 *
 * 意图：在表格单元格内按Enter时，光标应跳转到下一行的同列单元格，
 *       而非创建新段落。若已在最后一行则在表格后插入空块
 * 调用时机：fixTable中间件链中，表格未被选中且按下纯Enter键时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleEnterNavigation = (ctx: TableFixContext) => {
    const { protyle, event, range, cellElement, nodeElement, controller } = ctx;
    // 仅处理纯Enter（无修饰键），且表格未被整块选中
    if (!(isNotCtrl(event) && !event.shiftKey && !event.altKey && event.key === "Enter")) {
        return;
    }
    if (!isNotSelected(nodeElement)) {
        return;
    }
    event.preventDefault();
    const trElement = cellElement.parentElement;
    // 父元素必须是表格行，否则DOM结构异常无法导航
    if (!(trElement instanceof HTMLTableRowElement)) {
        controller.abort("Enter导航：行元素类型异常");
        return;
    }
    // 最后一行时在表格后插入空块
    if (isLastRow(trElement)) {
        insertEmptyBlock(protyle, "afterend", nodeElement.getAttribute("data-node-id") ?? undefined);
        controller.abort("Enter导航：插入空块");
        return;
    }
    const nextRow = getNextRow(trElement);
    if (!nextRow) {
        controller.abort("Enter导航：无下一行");
        return;
    }
    const targetCell = nextRow.cells[getColIndex(cellElement)];
    if (!targetCell) {
        controller.abort("Enter导航：目标单元格不存在");
        return;
    }
    range.selectNodeContents(targetCell);
    range.collapse(true);
    scrollCenter(protyle);
    controller.abort("Enter导航");
};

/**
 * ArrowRight键导航中间件：表格末尾右键新建空块
 *
 * 意图：当光标在表格最后一个单元格的末尾按右箭头，且表格后无内容时，
 *       自动在表格后插入空块，避免光标无处可去
 * 调用时机：fixTable中间件链中，表格未被选中且按下ArrowRight时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleArrowRightNavigation = (ctx: TableFixContext) => {
    const { protyle, event, range, cellElement, nodeElement, controller } = ctx;
    // 仅处理ArrowRight且选区为空、表格后无兄弟元素
    if (event.key !== "ArrowRight" || range.toString() !== "") {
        return;
    }
    if (!isNotSelected(nodeElement) || nodeElement.nextElementSibling) {
        return;
    }
    const tableEl = nodeElement.querySelector("table");
    // 光标必须在表格最后一个单元格
    if (!tableEl || cellElement !== tableEl.lastElementChild?.lastElementChild?.lastElementChild) {
        return;
    }
    // wysiwyg不存在时无法判断偏移量
    if (!protyle.wysiwyg) {
        return;
    }
    // 光标必须在单元格文本末尾
    if (getSelectionOffset(cellElement, protyle.wysiwyg.element, range).start !== cellElement.innerText.length) {
        return;
    }
    event.preventDefault();
    insertEmptyBlock(protyle, "afterend", nodeElement.getAttribute("data-node-id") ?? undefined);
    controller.abort("ArrowRight导航：插入空块");
};

/**
 * Tab键导航中间件：光标在单元格间移动
 *
 * 意图：Tab键在表格中用于在单元格间前进导航，Shift+Tab用于后退导航。
 *       当Tab到达最后一个单元格时自动插入新行
 * 调用时机：fixTable中间件链中，表格未被选中且按下Tab键时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleTabNavigation = (ctx: TableFixContext) => {
    const { protyle, event, range, cellElement, nodeElement, controller } = ctx;
    // 仅处理Tab键（无Ctrl）
    if (!(event.key === "Tab" && isNotCtrl(event))) {
        return;
    }
    if (!isNotSelected(nodeElement)) {
        return;
    }
    // Shift+Tab：光标移动到前一个cell
    if (event.shiftKey) {
        goPreviousCell(cellElement, range);
        event.preventDefault();
        controller.abort("Tab导航：前一个cell");
        return;
    }
    const nextElement = findNextCell(cellElement);
    // 有下一个单元格则选中其内容
    if (nextElement) {
        range.selectNodeContents(nextElement);
        event.preventDefault();
        controller.abort("Tab导航：下一个cell");
        return;
    }
    // 无下一个单元格则在表格末尾插入新行
    const firstCellInRow = cellElement.parentElement?.firstElementChild;
    // insertRow需要HTMLTableCellElement作为参考位置，类型不匹配时跳过插入
    if (firstCellInRow instanceof HTMLTableCellElement) {
        insertRow(protyle, range, firstCellInRow, nodeElement);
    }
    event.preventDefault();
    controller.abort("Tab导航：插入新行");
};

/**
 * ArrowUp键导航中间件：光标跳转到上一行同列
 *
 * 意图：在表格单元格内按上箭头时，若光标已在单元格第一行，
 *       则跳转到上一行的同列单元格末尾
 * 调用时机：fixTable中间件链中，表格未被选中且按下ArrowUp时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleArrowUpNavigation = (ctx: TableFixContext) => {
    const { protyle, event, range, cellElement, nodeElement, controller } = ctx;
    // 仅处理纯ArrowUp（无修饰键）
    if (!(event.key === "ArrowUp" && isNotCtrl(event) && !event.shiftKey && !event.altKey)) {
        return;
    }
    if (!isNotSelected(nodeElement)) {
        return;
    }
    // 光标不在单元格第一行时交给浏览器默认行为
    if (!isCursorOnFirstLine(cellElement, range, getSelectionPosition)) {
        return;
    }
    const trElement = cellElement.parentElement;
    // 父元素必须是表格行
    if (!(trElement instanceof HTMLTableRowElement)) {
        return;
    }
    const previousRow = getPreviousRow(trElement);
    if (!previousRow) {
        return;
    }
    const targetCell = previousRow.cells[getColIndex(cellElement)];
    if (!targetCell) {
        return;
    }
    range.selectNodeContents(targetCell);
    range.collapse(false);
    scrollCenter(protyle);
    event.preventDefault();
    controller.abort("ArrowUp导航");
};

/**
 * ArrowDown键导航中间件：光标跳转到下一行同列
 *
 * 意图：在表格单元格内按下箭头时，若光标已在单元格最后一行，
 *       则跳转到下一行的同列单元格开头。若已在最后一行则不处理
 * 调用时机：fixTable中间件链中，表格未被选中且按下ArrowDown时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleArrowDownNavigation = (ctx: TableFixContext) => {
    const { protyle, event, range, cellElement, nodeElement, controller } = ctx;
    // 仅处理纯ArrowDown（无修饰键）
    if (!(event.key === "ArrowDown" && isNotCtrl(event) && !event.shiftKey && !event.altKey)) {
        return;
    }
    if (!isNotSelected(nodeElement)) {
        return;
    }
    // 光标不在单元格最后一行时交给浏览器默认行为
    if (!isCursorOnLastLine(cellElement, range, getSelectionPosition)) {
        return;
    }
    const trElement = cellElement.parentElement;
    // 父元素必须是表格行
    if (!(trElement instanceof HTMLTableRowElement)) {
        return;
    }
    // 已在最后一行则不处理，交给浏览器默认行为
    if (isLastRow(trElement)) {
        return;
    }
    const nextRow = getNextRow(trElement);
    if (!nextRow) {
        return;
    }
    const targetCell = nextRow.cells[getColIndex(cellElement)];
    if (!targetCell) {
        return;
    }
    range.selectNodeContents(targetCell);
    range.collapse(true);
    scrollCenter(protyle);
    event.preventDefault();
    controller.abort("ArrowDown导航");
};

/**
 * Backspace键导航中间件：光标在单元格开头时移动到前一个cell
 *
 * 意图：当光标在单元格开头按Backspace时，不应删除单元格内容，
 *       而是将光标移动到前一个单元格末尾。若无前一个单元格则聚焦表格前方块
 * 调用时机：fixTable中间件链中，表格未被选中且按下纯Backspace时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleBackspaceNavigation = (ctx: TableFixContext) => {
    const { protyle, event, range, cellElement, nodeElement, controller } = ctx;
    // 仅处理纯Backspace（无修饰键）
    if (!(isNotCtrl(event) && !event.shiftKey && !event.altKey && event.key === "Backspace")) {
        return;
    }
    if (!isNotSelected(nodeElement)) {
        return;
    }
    // 选区非空时不处理
    if (range.toString() !== "") {
        return;
    }
    // wysiwyg不存在时无法判断偏移量
    if (!protyle.wysiwyg) {
        return;
    }
    // 光标必须在单元格开头
    if (getSelectionOffset(cellElement, protyle.wysiwyg.element, range).start !== 0) {
        return;
    }
    // 空换行无法删除 https://github.com/siyuan-note/siyuan/issues/2732
    const brElements = cellElement.querySelectorAll("br");
    const brCount = brElements.length;
    if (range.startOffset !== 0 && !(range.startOffset === 1 && brCount === 1)) {
        return;
    }
    const previousCellElement = goPreviousCell(cellElement, range, false);
    // 无前一个单元格且表格前有兄弟块时聚焦前方块
    if (!previousCellElement && nodeElement.previousElementSibling) {
        focusBlock(nodeElement.previousElementSibling, undefined, false);
    }
    scrollCenter(protyle);
    event.preventDefault();
    controller.abort("Backspace导航");
};

/**
 * 对齐快捷键中间件：居左/居中/居右
 *
 * 意图：在表格单元格内按对齐快捷键时设置单元格对齐方式
 * 调用时机：fixTable中间件链中，表格未被选中且按下对齐快捷键时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleAlignNavigation = (ctx: TableFixContext) => {
    const { event, range, cellElement, nodeElement, controller } = ctx;
    if (!isNotSelected(nodeElement)) {
        return;
    }
    const generalKeymap = getSiyuanEditorGeneralKeymap();
    if (!generalKeymap) {
        return;
    }
    // 居左
    if (matchHotKey(generalKeymap.alignLeft.custom, event)) {
        setTableAlign(ctx.protyle, [cellElement], nodeElement, "left", range);
        event.preventDefault();
        controller.abort("对齐：居左");
        return;
    }
    // 居中
    if (matchHotKey(generalKeymap.alignCenter.custom, event)) {
        setTableAlign(ctx.protyle, [cellElement], nodeElement, "center", range);
        event.preventDefault();
        controller.abort("对齐：居中");
        return;
    }
    // 居右
    if (matchHotKey(generalKeymap.alignRight.custom, event)) {
        setTableAlign(ctx.protyle, [cellElement], nodeElement, "right", range);
        event.preventDefault();
        controller.abort("对齐：居右");
        return;
    }
};
