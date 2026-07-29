/**
 * 表格修复主调度器
 *
 * 替代关系：本模块是原 `protyle/util/table.ts` 中 `fixTable` 的唯一现行所有者。
 * 意图：将原始的单体fixTable函数拆分为中间件链模式，
 *       每个子模块处理特定类别的表格快捷键操作
 * 调用时机：由keydown.table.ts中的fixTableMiddleware调用
 *
 * 中间件执行顺序：
 * 1. editing: BR修复、软换行
 * 2. navigation: Enter/Arrow/Tab/Backspace导航、对齐
 * 3. structure: 行列移动、插入、删除
 * @同步豁免: 需要绝对同步的DOM访问
 */

import { hasClosestByTag, hasClosestBlock } from "../hasClosest";
import { TableFixContext } from "./table.fix.types";
import { handleBackspaceBrFix, handleShiftEnter } from "./table.fix.editing";
import {
    handleEnterNavigation, handleArrowRightNavigation,
    handleTabNavigation, handleArrowUpNavigation,
    handleArrowDownNavigation, handleBackspaceNavigation,
    handleAlignNavigation,
} from "./table.fix.navigation";
import {
    handleMoveRowUp, handleMoveRowDown,
    handleMoveColumnLeft, handleMoveColumnRight,
    handleInsertRowAbove, handleInsertRowBelow,
    handleInsertColumnLeft, handleInsertColumnRight,
    handleDeleteRow, handleDeleteColumn,
} from "./table.fix.structure";

/**
 * 所有中间件按执行顺序排列
 *
 * 意图：中间件链的执行顺序决定了快捷键的优先级，
 *       editing最先（修复DOM结构），navigation其次，structure最后
 */
const middlewares: ReadonlyArray<(ctx: TableFixContext) => void> = [
    // editing: BR修复不abort，仅修复DOM
    handleBackspaceBrFix,
    // editing: 软换行会abort
    handleShiftEnter,
    // navigation: 各种导航操作
    handleEnterNavigation,
    handleArrowRightNavigation,
    handleTabNavigation,
    handleArrowUpNavigation,
    handleArrowDownNavigation,
    handleBackspaceNavigation,
    handleAlignNavigation,
    // structure: 行列结构操作
    handleMoveRowUp,
    handleMoveRowDown,
    handleMoveColumnLeft,
    handleMoveColumnRight,
    handleInsertRowAbove,
    handleInsertRowBelow,
    handleInsertColumnLeft,
    handleInsertColumnRight,
    handleDeleteRow,
    handleDeleteColumn,
];

/**
 * 表格修复入口函数
 *
 * 意图：检测光标是否在表格单元格内，构造上下文后依次执行中间件链，
 *       任一中间件abort后终止后续执行
 * 调用时机：每次键盘事件触发时由keydown.table.ts调用
 *
 * @param protyle 编辑器实例
 * @param event 键盘事件
 * @param range 当前选区
 * @returns true表示事件已被表格修复处理，false表示未处理
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const fixTable = (protyle: IProtyle, event: KeyboardEvent, range: Range): boolean => {
    const cellElement = hasClosestByTag(range.startContainer, "TD")
        || hasClosestByTag(range.startContainer, "TH");
    const nodeElement = hasClosestBlock(range.startContainer);
    // 光标不在表格单元格或块级元素内时不处理
    if (!cellElement || !nodeElement) {
        return false;
    }
    const controller = new AbortController();
    const rawAbort = controller.abort.bind(controller);
    controller.abort = (reason?: string) => {
        // 打印中止理由，便于调试快捷键匹配
        console.log(`fixTable中止: ${reason ?? "未知原因"}`);
        rawAbort.call(controller, reason);
    };
    const ctx: TableFixContext = {
        protyle,
        event,
        range,
        cellElement,
        nodeElement,
        controller,
    };
    // 依次执行中间件，任一abort后终止
    for (const middleware of middlewares) {
        middleware(ctx);
        // 中间件abort后终止链式执行
        if (controller.signal.aborted) {
            return true;
        }
    }
    return false;
};
