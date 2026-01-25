/**
 * listRouter 命令执行器
 *
 * 本文件包含根据命令执行具体操作的执行器函数
 * 执行器负责复用现有业务逻辑，处理事件和控制器
 */

import { hasClosestByAttribute } from "../../util/hasClosest";
import { updateTransaction } from "../transaction";
import { listOutdent, listIndent } from "../list";
import * as dayjs from "dayjs";
import { LIST_COMMANDS } from "./commands";
import type { ListCommand, CommandExecutor } from "./types";
import { logTaskToggle, logCommandExecution } from "./logger";

/**
 * 切换任务状态的 DOM 操作
 *
 * @param taskItemElement - 任务列表项元素
 * @param useElement - use 元素（用于显示图标）
 * @returns 切换后的状态
 */
const toggleTaskStatusDOM = (
    taskItemElement: HTMLElement,
    useElement: SVGUseElement
): boolean => {
    const isDone = taskItemElement.classList.contains("protyle-task--done");
    
    if (isDone) {
        useElement.setAttribute("xlink:href", "#iconUncheck");
        taskItemElement.classList.remove("protyle-task--done");
        return false;
    }
    
    useElement.setAttribute("xlink:href", "#iconCheck");
    taskItemElement.classList.add("protyle-task--done");
    return true;
};

/**
 * 执行任务列表切换命令（Phase 1）
 *
 * 用途：切换任务列表项的完成状态
 * 使用场景：当路由器返回 CHECK_TOGGLE 命令时调用
 *
 * 实现逻辑：
 * 1. 查找光标所在的任务列表项元素
 * 2. 保存原始 HTML 用于事务回滚
 * 3. 切换任务状态（已完成 <-> 未完成）
 * 4. 更新图标和 CSS 类
 * 5. 更新时间戳
 * 6. 提交事务
 * 7. 记录详细日志
 * 8. 阻止事件传播并中止后续处理
 */
const executeToggleTaskStatus: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const taskItemElement = hasClosestByAttribute(
        range.startContainer,
        "data-subtype",
        "t"
    );
    
    if (!taskItemElement) {
        return;
    }
    
    const html = taskItemElement.outerHTML;
    const useElement = taskItemElement.querySelector("use");
    if (!useElement) {
        return;
    }
    
    const nodeId = taskItemElement.getAttribute("data-node-id");
    if (!nodeId) {
        return;
    }
    
    // 记录切换前的状态
    const oldStatus = taskItemElement.classList.contains("protyle-task--done");
    
    // 切换任务状态
    const newStatus = toggleTaskStatusDOM(taskItemElement, useElement);
    
    // 更新时间戳并提交事务
    taskItemElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    updateTransaction(protyle, nodeId, taskItemElement.outerHTML, html);
    
    // 记录详细的执行日志
    logTaskToggle(
        {
            command: LIST_COMMANDS.CHECK_TOGGLE,
            event,
            nodeElement: taskItemElement,
        },
        oldStatus,
        newStatus
    );
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("任务列表状态切换操作");
};

/**
 * 执行列表缩出命令（Phase 2）
 *
 * 用途：减少列表项的缩进层级
 * 使用场景：当路由器返回 OUTDENT 命令时调用
 *
 * 实现逻辑：
 * 1. 检查是否有多选元素
 * 2. 如果有多选，使用多选元素执行缩出
 * 3. 如果无多选，使用当前元素的父列表项执行缩出
 * 4. 调用现有的 listOutdent 业务逻辑
 * 5. 记录详细日志
 * 6. 阻止事件传播并中止后续处理
 */
const executeOutdent: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectElements = protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--select");
    
    // 场景 1: 有多选元素，使用多选元素执行缩出
    if (selectElements && selectElements.length > 0) {
        const elementsArray: HTMLElement[] = [];
        for (let i = 0; i < selectElements.length; i++) {
            const element = selectElements[i];
            // querySelectorAll 返回的是 Element 类型，需要确保是 HTMLElement 才能传递给 listOutdent
            // 这个检查过滤掉可能的 SVGElement 等非 HTML 元素
            if (element instanceof HTMLElement) {
                elementsArray.push(element);
            }
        }
        
        listOutdent(protyle, elementsArray, range);
        
        logCommandExecution({
            command: LIST_COMMANDS.OUTDENT,
            event,
            nodeElement,
            result: `多选缩出: ${elementsArray.length} 个元素`,
            context: {
                selectCount: elementsArray.length
            }
        });
        
        event.preventDefault();
        event.stopPropagation();
        controller.abort("列表缩出操作");
        return;
    }
    
    // 场景 2: 无多选，使用当前元素的父列表项
    const parentLi = nodeElement.parentElement;
    if (!parentLi) {
        return;
    }
    
    listOutdent(protyle, [parentLi], range);
    
    logCommandExecution({
        command: LIST_COMMANDS.OUTDENT,
        event,
        nodeElement,
        result: "单个元素缩出",
        context: {
            parentId: parentLi.getAttribute("data-node-id")
        }
    });
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("列表缩出操作");
};

/**
 * 执行列表缩进命令（Phase 3）
 *
 * 用途：增加列表项的缩进层级
 * 使用场景：当路由器返回 INDENT 命令时调用
 *
 * 实现逻辑：
 * 1. 检查是否有多选元素
 * 2. 如果有多选，使用多选元素执行缩进
 * 3. 如果无多选，使用当前元素的父列表项执行缩进
 * 4. 调用现有的 listIndent 业务逻辑
 * 5. 记录详细日志
 * 6. 阻止事件传播并中止后续处理
 */
const executeIndent: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectElements = protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--select");
    
    // 场景 1: 有多选元素，使用多选元素执行缩进
    if (selectElements && selectElements.length > 0) {
        const elementsArray: HTMLElement[] = [];
        for (let i = 0; i < selectElements.length; i++) {
            const element = selectElements[i];
            // querySelectorAll 返回的是 Element 类型，需要确保是 HTMLElement 才能传递给 listIndent
            // 这个检查过滤掉可能的 SVGElement 等非 HTML 元素
            if (element instanceof HTMLElement) {
                elementsArray.push(element);
            }
        }
        
        listIndent(protyle, elementsArray, range);
        
        logCommandExecution({
            command: LIST_COMMANDS.INDENT,
            event,
            nodeElement,
            result: `多选缩进: ${elementsArray.length} 个元素`,
            context: {
                selectCount: elementsArray.length
            }
        });
        
        event.preventDefault();
        event.stopPropagation();
        controller.abort("列表缩进操作");
        return;
    }
    
    // 场景 2: 无多选，使用当前元素的父列表项
    const parentLi = nodeElement.parentElement;
    if (!parentLi) {
        return;
    }
    
    listIndent(protyle, [parentLi], range);
    
    logCommandExecution({
        command: LIST_COMMANDS.INDENT,
        event,
        nodeElement,
        result: "单个元素缩进",
        context: {
            parentId: parentLi.getAttribute("data-node-id")
        }
    });
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("列表缩进操作");
};

/**
 * 命令执行器映射表
 *
 * 用途：将命令映射到对应的执行器函数
 * 使用场景：在 executeCommand 函数中根据命令查找执行器
 *
 * Phase 1 实现：
 * - CHECK_TOGGLE: executeToggleTaskStatus
 * - IGNORE: null（不需要执行器）
 *
 * Phase 2-4 预留：
 * - OUTDENT, INDENT, TRANSFORM_* 命令的执行器将在后续阶段实现
 */
const executorMap: Record<ListCommand, CommandExecutor | null> = {
    [LIST_COMMANDS.CHECK_TOGGLE]: executeToggleTaskStatus,
    [LIST_COMMANDS.OUTDENT]: executeOutdent,  // Phase 2 已实现
    [LIST_COMMANDS.INDENT]: executeIndent,  // Phase 3 已实现
    [LIST_COMMANDS.TRANSFORM_TO_UL]: null,  // Phase 4 实现
    [LIST_COMMANDS.TRANSFORM_TO_OL]: null,  // Phase 4 实现
    [LIST_COMMANDS.TRANSFORM_TO_TL]: null,  // Phase 4 实现
    [LIST_COMMANDS.TRANSFORM_TO_QUOTE]: null,  // Phase 4 实现
    [LIST_COMMANDS.IGNORE]: null  // 不需要执行器
};

/**
 * 执行命令
 *
 * 用途：根据命令类型执行对应的操作
 * 使用场景：在中间件中调用，执行路由器返回的命令
 *
 * @param command - 要执行的命令
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @param range - 当前选区对象
 * @param controller - 中止控制器
 *
 * 实现逻辑：
 * 1. 从映射表中查找命令对应的执行器
 * 2. 如果执行器存在，则调用执行器
 * 3. 如果执行器不存在（如 IGNORE 命令），则不执行任何操作
 */
export const executeCommand = async (
    command: ListCommand,
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    const executor = executorMap[command];
    
    if (executor) {
        await executor(event, protyle, nodeElement, range, controller);
    }
    // IGNORE 命令或未实现的命令不执行任何操作
};
