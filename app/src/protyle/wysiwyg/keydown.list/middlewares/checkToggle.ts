/**
 * 任务列表切换中间件（Phase 1）
 * 
 * 本文件实现了使用 CalibURRouter 模式的任务列表切换中间件
 * 这是 listRouter 重构的试点实现，展示完整的状态驱动路由模式
 * 
 * 架构模式：
 * 1. 状态提取：从事件和 DOM 中提取决策所需的状态
 * 2. 路由决策：使用 CalibURRouter 根据状态决定命令
 * 3. 命令执行：根据命令执行具体操作
 * 
 * 与原实现的对比：
 * - 原实现：命令式编程，逻辑耦合在一起
 * - 新实现：声明式路由，状态提取、决策、执行分离
 * 
 * 行为等价性：
 * 新实现与原 listCheckToggleMiddleware 的行为完全一致
 */

import { checkToggleRouter } from "../router";
import { extractCheckToggleState } from "../state";
import { executeCommand } from "../executors";
import { LIST_COMMANDS } from "../commands";

/**
 * 任务列表切换中间件
 * 
 * 用途：处理任务列表项的完成状态切换
 * 使用场景：在键盘事件处理流程中调用
 * 
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @param range - 当前选区对象
 * @param controller - 中止控制器，用于终止后续处理
 * 
 * 执行流程：
 * 1. 提取状态：调用 extractCheckToggleState 获取决策所需状态
 * 2. 路由决策：调用 checkToggleRouter 根据状态决定命令
 * 3. 执行命令：如果命令不是 IGNORE，则调用 executeCommand 执行
 * 
 * 状态空间：
 * - isCheckToggleKey: 是否按下任务列表切换快捷键
 * - hasTaskItem: 光标是否在任务列表项中
 * 
 * 命令空间：
 * - CHECK_TOGGLE: 切换任务状态
 * - IGNORE: 不执行任何操作
 */
export const listCheckToggleMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 步骤 1: 提取状态
    const state = extractCheckToggleState(event, range);
    
    // 步骤 2: 路由决策
    const command = checkToggleRouter(state);
    
    // 步骤 3: 执行命令
    if (command !== LIST_COMMANDS.IGNORE) {
        await executeCommand(command, event, protyle, nodeElement, range, controller);
    }
};
