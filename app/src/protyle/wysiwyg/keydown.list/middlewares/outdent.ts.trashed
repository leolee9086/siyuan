/**
 * 列表缩出中间件（Phase 2）
 * 
 * 本文件实现了使用 CalibURRouter 模式的列表缩出中间件
 * 这是 listRouter 重构的 Phase 2 实现
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
 * 新实现与原 listOutdentMiddleware 的行为完全一致
 */

import { outdentRouter } from "../router";
import { extractOutdentState } from "../state";
import { executeCommand } from "../executors";
import { LIST_COMMANDS } from "../commands";

/**
 * 列表缩出中间件
 * 
 * 用途：处理列表项的缩出操作（减少缩进层级）
 * 使用场景：在键盘事件处理流程中调用
 * 
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @param range - 当前选区对象
 * @param controller - 中止控制器，用于终止后续处理
 * 
 * 执行流程：
 * 1. 提取状态：调用 extractOutdentState 获取决策所需状态
 * 2. 路由决策：调用 outdentRouter 根据状态决定命令
 * 3. 执行命令：如果命令不是 IGNORE，则调用 executeCommand 执行
 * 
 * 状态空间：
 * - isOutdentKey: 是否按下列表缩出快捷键
 * - hasSelectElements: 是否有多选元素
 * - isContinuousSelection: 多选元素是否连续
 * - isFirstSelectInList: 第一个选中元素是否在列表中
 * - isInListItem: 当前元素是否在列表项中
 * - isInCodeBlock: 当前元素是否在代码块中
 * 
 * 命令空间：
 * - OUTDENT: 执行缩出操作
 * - IGNORE: 不执行任何操作
 */
export const listOutdentMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 步骤 1: 提取状态
    const state = extractOutdentState(event, protyle, nodeElement);
    
    // 步骤 2: 路由决策
    const command = outdentRouter(state);
    
    // 步骤 3: 执行命令
    if (command !== LIST_COMMANDS.IGNORE) {
        await executeCommand(command, event, protyle, nodeElement, range, controller);
    }
};
