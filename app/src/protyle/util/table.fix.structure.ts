/**
 * 表格结构操作中间件
 *
 * 处理表格行/列的移动、插入、删除快捷键操作
 * 每个操作为独立中间件，共享 prepareStructureContext 预分析
 */

import { matchHotKey } from "./hotKey";
import { TableFixContext } from "./table.fix.types";
import { moveRowToUp, moveRowToDown, insertRow, insertRowAbove, deleteRow } from "./table.row";
import { moveColumnToLeft, moveColumnToRight, insertColumn, deleteColumn } from "./table.column";
import {
    isRowSafe, isRowDeletable, prepareStructureContext,
} from "./table.fix.structure.helpers";

/**
 * 行上移中间件
 *
 * 意图：将当前行与上一行交换位置
 * 调用时机：按下表格行上移快捷键时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleMoveRowUp = (ctx: TableFixContext) => {
    const sc = prepareStructureContext(ctx);
    // 无结构分析上下文时跳过
    if (!sc) {
        return;
    }
    // 不匹配行上移快捷键时跳过
    if (!matchHotKey(sc.tableKeymap.moveToUp.custom, ctx.event)) {
        return;
    }
    // 当前行和上一行都安全时执行移动
    if (isRowSafe(sc.currentRowInfo) && sc.prevRowInfo && isRowSafe(sc.prevRowInfo)) {
        moveRowToUp(ctx.protyle, ctx.range, ctx.cellElement, ctx.nodeElement);
    }
    ctx.event.preventDefault();
    ctx.controller.abort("行上移");
};

/**
 * 行下移中间件
 *
 * 意图：将当前行与下一行交换位置
 * 调用时机：按下表格行下移快捷键时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleMoveRowDown = (ctx: TableFixContext) => {
    const sc = prepareStructureContext(ctx);
    // 无结构分析上下文时跳过
    if (!sc) {
        return;
    }
    // 不匹配行下移快捷键时跳过
    if (!matchHotKey(sc.tableKeymap.moveToDown.custom, ctx.event)) {
        return;
    }
    // 当前行和下一行都安全时执行移动
    if (isRowSafe(sc.currentRowInfo) && sc.nextRowInfo && isRowSafe(sc.nextRowInfo)) {
        moveRowToDown(ctx.protyle, ctx.range, ctx.cellElement, ctx.nodeElement);
    }
    ctx.event.preventDefault();
    ctx.controller.abort("行下移");
};

/**
 * 列左移中间件
 *
 * 意图：将当前列与左侧列交换位置
 * 调用时机：按下表格列左移快捷键时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleMoveColumnLeft = (ctx: TableFixContext) => {
    const sc = prepareStructureContext(ctx);
    // 无结构分析上下文时跳过
    if (!sc) {
        return;
    }
    // 不匹配列左移快捷键时跳过
    if (!matchHotKey(sc.tableKeymap.moveToLeft.custom, ctx.event)) {
        return;
    }
    // 当前列和左侧列都纯净时执行移动
    if (sc.colPure && sc.prevColPure) {
        moveColumnToLeft(ctx.protyle, ctx.range, ctx.cellElement, ctx.nodeElement);
    }
    ctx.event.preventDefault();
    ctx.controller.abort("列左移");
};

/**
 * 列右移中间件
 *
 * 意图：将当前列与右侧列交换位置
 * 调用时机：按下表格列右移快捷键时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleMoveColumnRight = (ctx: TableFixContext) => {
    const sc = prepareStructureContext(ctx);
    // 无结构分析上下文时跳过
    if (!sc) {
        return;
    }
    // 不匹配列右移快捷键时跳过
    if (!matchHotKey(sc.tableKeymap.moveToRight.custom, ctx.event)) {
        return;
    }
    // 当前列和右侧列都纯净时执行移动
    if (sc.colPure && sc.nextColPure) {
        moveColumnToRight(ctx.protyle, ctx.range, ctx.cellElement, ctx.nodeElement);
    }
    ctx.event.preventDefault();
    ctx.controller.abort("列右移");
};

/**
 * 上方插入行中间件
 *
 * 意图：在当前行上方插入新行
 * 调用时机：按下表格上方插入行快捷键时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleInsertRowAbove = (ctx: TableFixContext) => {
    const sc = prepareStructureContext(ctx);
    // 无结构分析上下文时跳过
    if (!sc) {
        return;
    }
    // 不匹配上方插入行快捷键时跳过
    if (!matchHotKey(sc.tableKeymap.insertRowAbove.custom, ctx.event)) {
        return;
    }
    insertRowAbove(ctx.protyle, ctx.range, ctx.cellElement, ctx.nodeElement);
    ctx.event.preventDefault();
    ctx.event.stopPropagation();
    ctx.controller.abort("上方插入行");
};

/**
 * 下方插入行中间件
 *
 * 意图：在当前行下方插入新行
 * 调用时机：按下表格下方插入行快捷键时
 * 参考：https://github.com/Vanessa219/vditor/issues/46
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleInsertRowBelow = (ctx: TableFixContext) => {
    const sc = prepareStructureContext(ctx);
    // 无结构分析上下文时跳过
    if (!sc) {
        return;
    }
    // 不匹配下方插入行快捷键时跳过
    if (!matchHotKey(sc.tableKeymap.insertRowBelow.custom, ctx.event)) {
        return;
    }
    // 下一行安全时才执行插入（无下一行也可插入）
    if (!sc.nextRowInfo || isRowSafe(sc.nextRowInfo)) {
        insertRow(ctx.protyle, ctx.range, ctx.cellElement, ctx.nodeElement);
    }
    ctx.event.preventDefault();
    ctx.controller.abort("下方插入行");
};

/**
 * 左方插入列中间件
 *
 * 意图：在当前列左方插入新列
 * 调用时机：按下表格左方插入列快捷键时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleInsertColumnLeft = (ctx: TableFixContext) => {
    const sc = prepareStructureContext(ctx);
    // 无结构分析上下文时跳过
    if (!sc) {
        return;
    }
    // 不匹配左方插入列快捷键时跳过
    if (!matchHotKey(sc.tableKeymap.insertColumnLeft.custom, ctx.event)) {
        return;
    }
    // 当前列或左侧列纯净时执行插入
    if (sc.colPure || sc.prevColPure) {
        insertColumn(ctx.protyle, ctx.nodeElement, ctx.cellElement, "beforebegin", ctx.range);
    }
    ctx.event.preventDefault();
    ctx.controller.abort("左方插入列");
};

/**
 * 右方插入列中间件
 *
 * 意图：在当前列右方插入新列
 * 调用时机：按下表格右方插入列快捷键时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleInsertColumnRight = (ctx: TableFixContext) => {
    const sc = prepareStructureContext(ctx);
    // 无结构分析上下文时跳过
    if (!sc) {
        return;
    }
    // 不匹配右方插入列快捷键时跳过
    if (!matchHotKey(sc.tableKeymap.insertColumnRight.custom, ctx.event)) {
        return;
    }
    // 当前列或右侧列纯净时执行插入
    if (sc.colPure || sc.nextColPure) {
        insertColumn(ctx.protyle, ctx.nodeElement, ctx.cellElement, "afterend", ctx.range);
    }
    ctx.event.preventDefault();
    ctx.controller.abort("右方插入列");
};

/**
 * 删除当前行中间件
 *
 * 意图：删除当前行
 * 调用时机：按下表格删除行快捷键时
 * 参考：https://github.com/siyuan-note/siyuan/issues/5045
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleDeleteRow = (ctx: TableFixContext) => {
    const sc = prepareStructureContext(ctx);
    // 无结构分析上下文时跳过
    if (!sc) {
        return;
    }
    const deleteRowKey = sc.tableKeymap["delete-row"];
    // 不匹配删除行快捷键时跳过
    if (!matchHotKey(deleteRowKey.custom, ctx.event)) {
        return;
    }
    // 行可安全删除时执行
    if (isRowDeletable(sc.currentRowInfo)) {
        deleteRow(ctx.protyle, ctx.range, ctx.cellElement, ctx.nodeElement);
    }
    ctx.event.preventDefault();
    ctx.event.stopPropagation();
    ctx.controller.abort("删除行");
};

/**
 * 删除当前列中间件
 *
 * 意图：删除当前列
 * 调用时机：按下表格删除列快捷键时
 *
 * @param ctx 表格修复上下文
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleDeleteColumn = (ctx: TableFixContext) => {
    const sc = prepareStructureContext(ctx);
    // 无结构分析上下文时跳过
    if (!sc) {
        return;
    }
    const deleteColKey = sc.tableKeymap["delete-column"];
    // 不匹配删除列快捷键时跳过
    if (!matchHotKey(deleteColKey.custom, ctx.event)) {
        return;
    }
    // 当前列纯净时执行删除
    if (sc.colPure) {
        deleteColumn(ctx.protyle, ctx.range, ctx.nodeElement, ctx.cellElement);
    }
    ctx.event.preventDefault();
    ctx.controller.abort("删除列");
};
