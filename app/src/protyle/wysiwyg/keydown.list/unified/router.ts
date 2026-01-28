/**
 * 统一列表主路由器
 *
 * 本文件实现了列表操作的主路由器和基础子路由器
 * 使用 .split() + 子分发器模式，根据快捷键类型委托给对应的子路由器
 *
 * @see docs/ttt/键盘事件处理重构-列表归并设计.md
 */

import { calibur } from "calibur-router";
import { type } from "arktype";
import { LIST_COMMANDS } from "../commands";
import { UnifiedListStateSchema } from "./types";
import type { UnifiedListState } from "./types";
import { transformSubRouter } from "./router.transform";

// ============================================================================
// 基础子路由器定义
// ============================================================================

/**
 * 任务列表切换子路由器
 *
 * 前置条件：hotkeys.checkToggle = true
 * 决策逻辑：
 * - 在任务列表项中 -> CHECK_TOGGLE
 * - 否则 -> IGNORE
 */
const checkToggleSubRouter = calibur
    .universe(type({
        context: {
            hasTaskItem: "boolean"
        }
    }))
    .split(
        type({ context: { hasTaskItem: "false" } }),
        () => LIST_COMMANDS.IGNORE
    )
    .remain(() => LIST_COMMANDS.CHECK_TOGGLE)
    .build();

/**
 * 列表缩出子路由器
 *
 * 前置条件：hotkeys.outdent = true
 * 决策逻辑：
 * - 有多选 + 不连续 -> IGNORE
 * - 有多选 + 连续 + 第一个不在列表 -> IGNORE
 * - 有多选 + 连续 + 第一个在列表 -> OUTDENT
 * - 无多选 + 在代码块 -> IGNORE
 * - 无多选 + 不在列表项 -> IGNORE
 * - 无多选 + 在列表项 -> OUTDENT
 */
const outdentSubRouter = calibur
    .universe(type({
        selection: {
            hasMultiple: "boolean",
            isContinuous: "boolean",
            firstInList: "boolean"
        },
        context: {
            inListItem: "boolean",
            inCodeBlock: "boolean"
        }
    }))
    // 有多选但不连续
    .split(
        type({ selection: { hasMultiple: "true", isContinuous: "false" } }),
        () => LIST_COMMANDS.IGNORE
    )
    // 有多选且连续但第一个不在列表
    .split(
        type({
            selection: { hasMultiple: "true", isContinuous: "true", firstInList: "false" }
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 有多选且连续且第一个在列表
    .split(
        type({
            selection: { hasMultiple: "true", isContinuous: "true", firstInList: "true" }
        }),
        () => LIST_COMMANDS.OUTDENT
    )
    // 无多选但在代码块
    .split(
        type({
            selection: { hasMultiple: "false" },
            context: { inCodeBlock: "true" }
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 无多选且不在列表项
    .split(
        type({
            selection: { hasMultiple: "false" },
            context: { inCodeBlock: "false", inListItem: "false" }
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 无多选且在列表项
    .remain(() => LIST_COMMANDS.OUTDENT)
    .build();

/**
 * 列表缩进子路由器
 *
 * 前置条件：hotkeys.indent = true
 * 决策逻辑：与 outdent 类似
 */
const indentSubRouter = calibur
    .universe(type({
        selection: {
            hasMultiple: "boolean",
            isContinuous: "boolean",
            firstInList: "boolean"
        },
        context: {
            inListItem: "boolean",
            inCodeBlock: "boolean"
        }
    }))
    // 有多选但不连续
    .split(
        type({ selection: { hasMultiple: "true", isContinuous: "false" } }),
        () => LIST_COMMANDS.IGNORE
    )
    // 有多选且连续但第一个不在列表
    .split(
        type({
            selection: { hasMultiple: "true", isContinuous: "true", firstInList: "false" }
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 有多选且连续且第一个在列表
    .split(
        type({
            selection: { hasMultiple: "true", isContinuous: "true", firstInList: "true" }
        }),
        () => LIST_COMMANDS.INDENT
    )
    // 无多选但在代码块
    .split(
        type({
            selection: { hasMultiple: "false" },
            context: { inCodeBlock: "true" }
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 无多选且不在列表项
    .split(
        type({
            selection: { hasMultiple: "false" },
            context: { inCodeBlock: "false", inListItem: "false" }
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 无多选且在列表项
    .remain(() => LIST_COMMANDS.INDENT)
    .build();

// ============================================================================
// 主路由器定义
// ============================================================================

/**
 * 列表主路由器
 *
 * 使用 .split() + 子分发器模式
 * 根据快捷键类型委托给对应的子路由器
 *
 * 路由决策流程：
 * 1. 快速路径：所有快捷键为 false 时返回 IGNORE
 * 2. checkToggle 快捷键 -> checkToggleSubRouter
 * 3. outdent 快捷键 -> outdentSubRouter
 * 4. indent 快捷键 -> indentSubRouter
 * 5. transform 快捷键 -> transformSubRouter
 */
export const listMasterRouter = calibur
    .universe(UnifiedListStateSchema)
    // 快速路径：没有按下任何列表相关快捷键
    .split(
        type({
            hotkeys: {
                checkToggle: "false",
                outdent: "false",
                indent: "false",
                list: "false",
                oList: "false",
                check: "false",
                quote: "false"
            }
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // CheckToggle 快捷键 - 委托给子路由器
    .split(
        type({
            hotkeys: {
                checkToggle: "true",
                outdent: "false",
                indent: "false",
                list: "false",
                oList: "false",
                check: "false",
                quote: "false"
            }
        }),
        (state: UnifiedListState) => checkToggleSubRouter({ context: state.context })
    )
    // Outdent 快捷键 - 委托给子路由器
    .split(
        type({
            hotkeys: {
                checkToggle: "false",
                outdent: "true",
                indent: "false",
                list: "false",
                oList: "false",
                check: "false",
                quote: "false"
            }
        }),
        (state: UnifiedListState) => outdentSubRouter({
            selection: state.selection,
            context: state.context
        })
    )
    // Indent 快捷键 - 委托给子路由器
    .split(
        type({
            hotkeys: {
                checkToggle: "false",
                outdent: "false",
                indent: "true",
                list: "false",
                oList: "false",
                check: "false",
                quote: "false"
            }
        }),
        (state: UnifiedListState) => indentSubRouter({
            selection: state.selection,
            context: state.context
        })
    )
    // Transform 快捷键（list/oList/check/quote 任一为 true）
    .remain((state: UnifiedListState) => transformSubRouter({
        hotkeys: state.hotkeys,
        selection: state.selection,
        context: state.context
    }))
    .build();

// ============================================================================
// 导出子路由器（供测试使用）
// ============================================================================

export {
    checkToggleSubRouter,
    outdentSubRouter,
    indentSubRouter,
    transformSubRouter
};
