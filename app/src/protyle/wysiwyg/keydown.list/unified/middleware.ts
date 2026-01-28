/**
 * 统一列表中间件
 *
 * 本文件实现了统一的列表操作中间件
 * 替代原有的 4 个独立中间件：
 * - listCheckToggleMiddleware
 * - listOutdentMiddleware
 * - listIndentMiddleware
 * - listTransformMiddleware
 *
 * @see docs/ttt/键盘事件处理重构-列表归并设计.md
 */

import { listMasterRouter } from "./router";
import { extractUnifiedListState } from "./state";
import { executeCommand } from "../executors";
import { LIST_COMMANDS } from "../commands";

/**
 * 统一列表中间件
 *
 * 用途：处理所有列表相关的键盘操作
 * 使用场景：在键盘事件处理流程中调用，替代原有 4 个独立中间件
 *
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @param range - 当前选区对象
 * @param controller - 中止控制器，用于终止后续处理
 *
 * 执行流程：
 * 1. 提取统一状态：调用 extractUnifiedListState 一次性获取所有决策所需状态
 * 2. 路由决策：调用 listMasterRouter 根据状态决定命令
 * 3. 执行命令：如果命令不是 IGNORE，则调用 executeCommand 执行
 *
 * 优势：
 * - 单次状态提取，避免重复计算
 * - 统一入口，简化调用方代码
 * - 快速路径优化，大多数按键事件能快速返回
 */
export const listUnifiedMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 步骤 1: 提取统一状态
    const state = extractUnifiedListState(event, protyle, nodeElement, range);

    // 步骤 2: 路由决策
    const command = listMasterRouter(state);

    // 步骤 3: 执行命令
    if (command !== LIST_COMMANDS.IGNORE) {
        await executeCommand(command, event, protyle, nodeElement, range, controller);
    }
};
