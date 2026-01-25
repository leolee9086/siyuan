/**
 * 列表缩进中间件（Phase 3）
 * 
 * 本文件实现了使用 CalibURRouter 模式的列表缩进中间件
 * 这是 listRouter 重构的 Phase 3 实现
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
 * 新实现与原 listIndentMiddleware 的行为完全一致
 */

import { indentRouter } from "../router";
import { extractIndentState } from "../state";
import { executeCommand } from "../executors";
import { LIST_COMMANDS } from "../commands";

/**
 * 列表缩进中间件
 * 
 * 用途：处理列表项的缩进操作（增加缩进层级）
 * 使用场景：在键盘事件处理流程中调用
 * 
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @param range - 当前选区对象
 * @param controller - 中止控制器，用于终止后续处理
 * 
 * 执行流程：
 * 1. 提取状态：调用 extractIndentState 获取决策所需状态
 * 2. 路由决策：调用 indentRouter 根据状态决定命令
 * 3. 执行命令：如果命令不是 IGNORE，则调用 executeCommand 执行
 * 
 * 状态空间：
 * - isIndentKey: 是否按下列表缩进快捷键
 * - hasSelectElements: 是否有多选元素
 * - isContinuousSelection: 多选元素是否连续
 * - isFirstSelectInList: 第一个选中元素是否在列表中
 * - isInListItem: 当前元素是否在列表项中
 * - isInCodeBlock: 当前元素是否在代码块中
 * - hasPreviousSibling: 是否有前一个兄弟元素（缩进需要）
 * 
 * 命令空间：
 * - INDENT: 执行缩进操作
 * - IGNORE: 不执行任何操作
 */
export const listIndentMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 步骤 1: 提取状态
    const state = extractIndentState(event, protyle, nodeElement);
    
    // 步骤 2: 路由决策
    const command = indentRouter(state);
    
    // 步骤 3: 执行命令
    if (command !== LIST_COMMANDS.IGNORE) {
        await executeCommand(command, event, protyle, nodeElement, range, controller);
    }
};
