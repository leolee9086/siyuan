/**
 * listRouter 路由定义
 * 
 * 本文件使用 CalibURRouter 模式构建列表操作的路由决策树
 * 路由器根据状态空间进行决策，返回对应的命令
 */

import { calibur } from "calibur-router";
import { type } from "arktype";
import { LIST_COMMANDS } from "./commands";
import { CheckToggleStateSchema } from "./types";

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
