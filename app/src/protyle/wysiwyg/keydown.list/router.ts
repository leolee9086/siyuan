/**
 * listRouter 路由定义
 *
 * 本文件使用 CalibURRouter 模式构建列表操作的路由决策树
 * 路由器根据状态空间进行决策，返回对应的命令
 */

import { calibur } from "calibur-router";
import { type } from "arktype";
import { LIST_COMMANDS } from "./commands";
import { CheckToggleStateSchema, OutdentStateSchema, IndentStateSchema, TransformStateSchema } from "./types";

/**
 * Phase 1: 任务列表切换路由器
 * 
 * 用途：根据任务列表切换状态决定执行的命令
 * 使用场景：在 listCheckToggleMiddleware 中调用
 * 
 * 路由决策树：
 * ```
 * 状态输入
 *     │
 *     ├─ isCheckToggleKey = false ──> IGNORE
 *     │
 *     ├─ isCheckToggleKey = true
 *     │   │
 *     │   ├─ hasTaskItem = false ──> IGNORE
 *     │   │
 *     │   └─ hasTaskItem = true ──> CHECK_TOGGLE
 * ```
 * 
 * 路由规则说明：
 * 1. 未按快捷键 -> IGNORE（快速路径）
 * 2. 按了快捷键但不在任务列表中 -> IGNORE
 * 3. 按了快捷键且在任务列表中 -> CHECK_TOGGLE（执行切换）
 */
export const checkToggleRouter = calibur
    .universe(CheckToggleStateSchema)
    // 规则 1: 未按快捷键，忽略
    .split(
        type({ isCheckToggleKey: "false" }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 2: 按了快捷键但不在任务列表中，忽略
    .split(
        type({ isCheckToggleKey: "true", hasTaskItem: "false" }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 3: 按了快捷键且在任务列表中，切换状态
    .remain(() => LIST_COMMANDS.CHECK_TOGGLE)
    .build();

/**
 * Phase 2: 列表缩出路由器
 *
 * 用途：根据列表缩出状态决定执行的命令
 * 使用场景：在 listOutdentMiddleware 中调用
 *
 * 路由决策树：
 * ```
 * 状态输入
 *     │
 *     ├─ isOutdentKey = false ──> IGNORE
 *     │
 *     ├─ isOutdentKey = true
 *     │   │
 *     │   ├─ hasSelectElements = true
 *     │   │   │
 *     │   │   ├─ isContinuousSelection = false ──> IGNORE
 *     │   │   │
 *     │   │   ├─ isContinuousSelection = true
 *     │   │   │   │
 *     │   │   │   ├─ isFirstSelectInList = false ──> IGNORE
 *     │   │   │   │
 *     │   │   │   └─ isFirstSelectInList = true ──> OUTDENT
 *     │   │
 *     │   └─ hasSelectElements = false
 *     │       │
 *     │       ├─ isInCodeBlock = true ──> IGNORE
 *     │       │
 *     │       ├─ isInCodeBlock = false
 *     │       │   │
 *     │       │   ├─ isInListItem = false ──> IGNORE
 *     │       │   │
 *     │       │   └─ isInListItem = true ──> OUTDENT
 * ```
 *
 * 路由规则说明：
 * 1. 未按快捷键 -> IGNORE（快速路径）
 * 2. 有多选但不连续 -> IGNORE
 * 3. 有多选且连续但第一个不在列表中 -> IGNORE
 * 4. 有多选且连续且第一个在列表中 -> OUTDENT
 * 5. 无多选但在代码块中 -> IGNORE
 * 6. 无多选且不在列表项中 -> IGNORE
 * 7. 无多选且在列表项中 -> OUTDENT
 */
export const outdentRouter = calibur
    .universe(OutdentStateSchema)
    // 规则 1: 未按快捷键，忽略
    .split(
        type({ isOutdentKey: "false" }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 2: 有多选但不连续，忽略
    .split(
        type({
            isOutdentKey: "true",
            hasSelectElements: "true",
            isContinuousSelection: "false"
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 3: 有多选且连续但第一个不在列表中，忽略
    .split(
        type({
            isOutdentKey: "true",
            hasSelectElements: "true",
            isContinuousSelection: "true",
            isFirstSelectInList: "false"
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 4: 有多选且连续且第一个在列表中，执行缩出
    .split(
        type({
            isOutdentKey: "true",
            hasSelectElements: "true",
            isContinuousSelection: "true",
            isFirstSelectInList: "true"
        }),
        () => LIST_COMMANDS.OUTDENT
    )
    // 规则 5: 无多选但在代码块中，忽略
    .split(
        type({
            isOutdentKey: "true",
            hasSelectElements: "false",
            isInCodeBlock: "true"
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 6: 无多选且不在列表项中，忽略
    .split(
        type({
            isOutdentKey: "true",
            hasSelectElements: "false",
            isInCodeBlock: "false",
            isInListItem: "false"
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 7: 无多选且在列表项中，执行缩出
    .remain(() => LIST_COMMANDS.OUTDENT)
    .build();

/**
 * Phase 3: 列表缩进路由器
 *
 * 用途：根据列表缩进状态决定执行的命令
 * 使用场景：在 listIndentMiddleware 中调用
 *
 * 路由决策树：
 * ```
 * 状态输入
 *     │
 *     ├─ isIndentKey = false ──> IGNORE
 *     │
 *     ├─ isIndentKey = true
 *     │   │
 *     │   ├─ hasSelectElements = true
 *     │   │   │
 *     │   │   ├─ isContinuousSelection = false ──> IGNORE
 *     │   │   │
 *     │   │   ├─ isContinuousSelection = true
 *     │   │   │   │
 *     │   │   │   ├─ isFirstSelectInList = false ──> IGNORE
 *     │   │   │   │
 *     │   │   │   └─ isFirstSelectInList = true ──> INDENT
 *     │   │
 *     │   └─ hasSelectElements = false
 *     │       │
 *     │       ├─ isInCodeBlock = true ──> IGNORE
 *     │       │
 *     │       ├─ isInCodeBlock = false
 *     │       │   │
 *     │       │   ├─ isInListItem = false ──> IGNORE
 *     │       │   │
 *     │       │   └─ isInListItem = true ──> INDENT
 * ```
 *
 * 路由规则说明：
 * 1. 未按快捷键 -> IGNORE（快速路径）
 * 2. 有多选但不连续 -> IGNORE
 * 3. 有多选且连续但第一个不在列表中 -> IGNORE
 * 4. 有多选且连续且第一个在列表中 -> INDENT
 * 5. 无多选但在代码块中 -> IGNORE
 * 6. 无多选且不在列表项中 -> IGNORE
 * 7. 无多选且在列表项中 -> INDENT
 */
export const indentRouter = calibur
    .universe(IndentStateSchema)
    // 规则 1: 未按快捷键，忽略
    .split(
        type({ isIndentKey: "false" }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 2: 有多选但不连续，忽略
    .split(
        type({
            isIndentKey: "true",
            hasSelectElements: "true",
            isContinuousSelection: "false"
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 3: 有多选且连续但第一个不在列表中，忽略
    .split(
        type({
            isIndentKey: "true",
            hasSelectElements: "true",
            isContinuousSelection: "true",
            isFirstSelectInList: "false"
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 4: 有多选且连续且第一个在列表中，执行缩进
    .split(
        type({
            isIndentKey: "true",
            hasSelectElements: "true",
            isContinuousSelection: "true",
            isFirstSelectInList: "true"
        }),
        () => LIST_COMMANDS.INDENT
    )
    // 规则 5: 无多选但在代码块中，忽略
    .split(
        type({
            isIndentKey: "true",
            hasSelectElements: "false",
            isInCodeBlock: "true"
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 6: 无多选且不在列表项中，忽略
    .split(
        type({
            isIndentKey: "true",
            hasSelectElements: "false",
            isInCodeBlock: "false",
            isInListItem: "false"
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 规则 7: 无多选且在列表项中，执行缩进
    .remain(() => LIST_COMMANDS.INDENT)
    .build();
