/**
 * 表格结构操作辅助函数
 *
 * 提供行跨度分析和列纯净度检查，供 table.fix.structure.ts 中间件使用
 */

import { RowSpanInfo, StructureContext, TableFixContext } from "./table.fix.types";
import { getSiyuanEditorTableKeymap } from "../../../util/siyuanEnvironments/getSiyuanKeymap.environment";
import { getColIndex } from "./table";

/**
 * 分析一行中所有单元格的跨度情况
 *
 * 意图：表格结构操作（移动行/列、插入/删除）需要知道行中是否存在
 *       合并单元格（colSpan/rowSpan）或隐藏单元格（fn__none），
 *       以决定操作是否安全可执行
 * 调用时机：每个结构操作中间件执行前的前置检查
 *
 * @param rowElement 表格行元素
 * @returns 行跨度分析结果
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const analyzeRowSpans = (rowElement: Element): RowSpanInfo => {
    let hasNone = false;
    let hasColSpan = false;
    let hasRowSpan = false;
    const children = rowElement.children;
    for (let i = 0; i < children.length; i++) {
        const cell = children[i];
        if (!cell) {
            continue;
        }
        // 隐藏单元格表示存在合并
        if (cell.classList.contains("fn__none")) {
            hasNone = true;
        }
        // HTMLTableCellElement才有colSpan/rowSpan属性
        // 列合并：colSpan > 1 表示单元格横跨多列
        if (cell instanceof HTMLTableCellElement && cell.colSpan > 1) {
            hasColSpan = true;
        }
        // 行合并：rowSpan > 1 表示单元格纵跨多行
        if (cell instanceof HTMLTableCellElement && cell.rowSpan > 1) {
            hasRowSpan = true;
        }
    }
    return { hasNone, hasColSpan, hasRowSpan };
};

/**
 * 检查指定列索引处所有单元格是否"纯净"（无合并/隐藏）
 *
 * 意图：列操作（移动/插入/删除）要求目标列中所有单元格都是普通单元格，
 *       存在合并单元格时操作可能破坏表格结构
 * 调用时机：列移动、列插入、列删除操作的前置检查
 *
 * @param tableElement 表格元素
 * @param colIndex 列索引
 * @returns true表示该列所有单元格都是纯净的
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const isColumnPure = (tableElement: HTMLTableElement, colIndex: number): boolean => {
    const rows = tableElement.rows;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) {
            continue;
        }
        const cell = row.cells[colIndex];
        // 列索引越界时视为纯净（不存在的列不影响操作）
        if (!cell) {
            continue;
        }
        // 隐藏单元格或存在跨度的单元格都不纯净
        if (cell.classList.contains("fn__none") || cell.colSpan > 1 || cell.rowSpan > 1) {
            return false;
        }
    }
    return true;
};

/**
 * 获取当前行的上一行元素，跨越tbody/thead边界
 *
 * 意图：结构操作需要分析上一行的跨度情况，需要跨越tbody→thead边界
 * 调用时机：行上移、行下方插入等操作的前置分析
 *
 * @param rowElement 当前行元素
 * @param tableElement 表格元素
 * @returns 上一行元素，不存在则返回null
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const getStructurePreviousRow = (
    rowElement: Element,
    tableElement: HTMLTableElement,
): Element | null => {
    // 同容器内的上一个兄弟行
    if (rowElement.previousElementSibling) {
        return rowElement.previousElementSibling;
    }
    // 跨越tbody→thead边界
    if (rowElement.parentElement?.tagName === "TBODY") {
        const thead = tableElement.querySelector("thead");
        return thead?.lastElementChild ?? null;
    }
    return null;
};

/**
 * 获取当前行的下一行元素，跨越thead/tbody边界
 *
 * 意图：结构操作需要分析下一行的跨度情况，需要跨越thead→tbody边界
 * 调用时机：行下移、行下方插入等操作的前置分析
 *
 * @param rowElement 当前行元素
 * @param tableElement 表格元素
 * @returns 下一行元素，不存在则返回null
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const getStructureNextRow = (
    rowElement: Element,
    tableElement: HTMLTableElement,
): Element | null => {
    // 同容器内的下一个兄弟行
    if (rowElement.nextElementSibling) {
        return rowElement.nextElementSibling;
    }
    // 跨越thead→tbody边界
    if (rowElement.parentElement?.tagName === "THEAD") {
        const tbody = tableElement.querySelector("tbody");
        return tbody?.firstElementChild ?? null;
    }
    return null;
};

/**
 * 判断行是否安全可操作（无rowSpan冲突）
 *
 * 意图：行操作的安全条件为：无隐藏单元格，或有隐藏但无rowSpan且有colSpan
 * 调用时机：行移动/删除操作的前置安全检查
 *
 * @param info 行跨度分析结果
 * @returns true表示行安全可操作
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const isRowSafe = (info: RowSpanInfo): boolean => {
    return !info.hasNone || (info.hasNone && !info.hasRowSpan && info.hasColSpan);
};

/**
 * 判断行是否可删除（无rowSpan冲突，更严格的条件）
 *
 * 意图：删除行要求无rowSpan，且无隐藏单元格或仅有colSpan隐藏
 * 调用时机：删除行操作的前置安全检查
 *
 * @param info 行跨度分析结果
 * @returns true表示行可安全删除
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const isRowDeletable = (info: RowSpanInfo): boolean => {
    // https://github.com/siyuan-note/siyuan/issues/5045
    return (!info.hasNone && !info.hasRowSpan)
        || (info.hasNone && !info.hasRowSpan && info.hasColSpan);
};

/**
 * 准备结构操作的共享分析上下文
 *
 * 意图：所有结构操作中间件共享相同的前置分析（行跨度、列纯净度），
 *       提取为独立函数避免每个中间件重复计算
 * 调用时机：每个结构操作中间件的入口处
 *
 * @param ctx 表格修复上下文
 * @returns 结构分析上下文，准备失败时返回null
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const prepareStructureContext = (ctx: TableFixContext): StructureContext | null => {
    const tableKeymap = getSiyuanEditorTableKeymap();
    // 无表格快捷键配置时无法匹配
    if (!tableKeymap) {
        return null;
    }
    const tableElement = ctx.nodeElement.querySelector("table");
    // 无表格DOM元素时无法操作
    if (!tableElement) {
        return null;
    }
    const rowElement = ctx.cellElement.parentElement;
    // 无父行时无法操作
    if (!rowElement) {
        return null;
    }
    const currentRowInfo = analyzeRowSpans(rowElement);
    const prevRow = getStructurePreviousRow(rowElement, tableElement);
    const nextRow = getStructureNextRow(rowElement, tableElement);
    const colIndex = getColIndex(ctx.cellElement);
    return {
        tableKeymap,
        tableElement,
        rowElement,
        currentRowInfo,
        prevRowInfo: prevRow ? analyzeRowSpans(prevRow) : null,
        nextRowInfo: nextRow ? analyzeRowSpans(nextRow) : null,
        colIndex,
        colPure: isColumnPure(tableElement, colIndex),
        prevColPure: isColumnPure(tableElement, colIndex - 1),
        nextColPure: isColumnPure(tableElement, colIndex + 1),
    };
};
