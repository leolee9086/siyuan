/**
 * listTransformMiddleware - 列表转换中间件（Phase 4）
 *
 * 用途：处理列表类型转换操作（无序列表、有序列表、任务列表、引用之间的转换）
 * 使用场景：在 keydown.ts 中作为中间件调用
 *
 * 架构：
 * 1. 提取状态 (extractTransformState)
 * 2. 路由决策 (transformRouter)
 * 3. 执行命令 (executeCommand)
 *
 * 这是 CalibURRouter 模式的标准实现，替代了原有的 if/else 分发逻辑
 */

import { extractTransformState } from "../state.transform";
import { transformRouter } from "../router.transform";
import { executeCommand } from "../executors";
import { LIST_COMMANDS } from "../commands";

/**
 * 列表转换中间件
 *
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @param range - 当前选区对象
 * @param controller - 中止控制器，用于终止后续处理
 *
 * 实现逻辑：
 * 1. 提取列表转换状态（快捷键、选中元素、块类型等）
 * 2. 使用路由器决定执行的命令
 * 3. 如果命令不是 IGNORE，则执行对应的操作
 */
export const listTransformMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 步骤 1: 提取状态
    const state = extractTransformState(event, protyle, nodeElement);
    
    // 步骤 2: 路由决策
    const command = transformRouter(state);
    
    // 步骤 3: 执行命令（如果不是 IGNORE）
    if (command !== LIST_COMMANDS.IGNORE) {
        await executeCommand(command, event, protyle, nodeElement, range, controller);
    }
};
