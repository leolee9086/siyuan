/**
 * listRouter Transform 执行器辅助函数
 *
 * 本文件包含列表转换操作的辅助函数
 */

/**
 * 用途：通过同层依赖网关引入列表转换所需的事务包装器，保证段落转列表、列表互转与批量转换都复用既有事务提交逻辑。
 * 使用范围：仅用于 [`transformParagraphToList()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:76)、[`transformListType()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:110) 与 [`transformBatch()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:140) 这三个转换辅助流程；边界是不在本文件内新增事务编排策略，也不把事务 API 继续向更上层业务流程扩散。
 * 解耦评估：这两个事务函数是列表转换落库与 DOM/事务一致性的既有稳定契约，理论上可以通过参数传递把执行函数从 [`executors.transform.ts`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts:23) 等调用处注入进来；但当前这些 helper 本身就是为压缩转换分支重复代码而存在，若再把事务函数逐层透传，会把同一底层依赖扩散到所有转换执行器与测试装配点，增加样板且不减少真实业务耦合。事件发射也不适合这种需要同步等待完成的命令式转换调用。因此当前通过同层 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 集中转发事务依赖，是比直接从父级路径导入更低耦合的方案。
 */
import { turnsIntoOneTransaction } from "./imports";
/**
 * 用途：通过同层依赖网关引入单列表节点互转事务函数，供列表类型互转辅助流程复用既有事务实现。
 * 使用范围：仅用于 [`transformListType()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:110) 内执行单节点列表类型转换；边界是不在当前辅助层封装新的事务协议，也不改变调用方的转换决策逻辑。
 * 解耦评估：[`turnsOneInto()`](app/src/protyle/transaction.ts:936) 与 [`turnsIntoOneTransaction()`](app/src/protyle/transaction.ts:881) 同属转换事务能力，若仅把其中一个留在参数层注入，调用方仍需理解底层事务实现细节，helper 的抽象边界会被破坏。保持经由同层网关统一引入，可将父级事务模块路径耦合限制在单点；这比在多个 helper/执行器文件中散落直接依赖更利于后续替换实现。
 */
import { turnsOneInto } from "./imports";
/**
 * 用途：引入列表转换事务目标类型，约束段落转列表与批量转换仅能传递事务层已支持的转换动作标识。
 * 使用范围：仅用于 [`transformParagraphToList()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:79) 与 [`transformBatch()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:143) 的参数类型声明，以及对应结果描述映射的键约束；边界是只参与编译期约束，不参与运行时事务调度。
 * 解耦评估：这是纯类型契约，无法通过事件发射替代。理论上也可以在当前文件内联联合字面量，但会把与事务层动作标识相关的契约复制到业务文件，导致后续扩展转换类型时容易遗漏。继续从 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts) 的单一类型源导入，更符合低耦合与一致性要求。
 */
import type { TransformTransactionType } from "./types";
/**
 * 用途：引入列表命令字面量类型，约束转换辅助函数记录日志时的命令参数必须与列表命令集合保持一致。
 * 使用范围：仅用于 [`transformParagraphToList()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:79)、[`transformListType()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:113) 与 [`transformBatch()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:143) 的参数类型声明；边界是只参与编译期约束，不承担任何运行时命令分发。
 * 解耦评估：这是纯类型契约，运行时并不存在可通过事件发射替代的对象。理论上可在本文件重复声明相同联合类型，但那会导致 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts:205) 与当前 helper 之间出现重复契约，后续新增命令时容易失配；继续从单一类型源导入是更低耦合且更可维护的方案。
 */
import type { ListCommand } from "./types";
/**
 * 用途：通过同层日志网关引入统一命令执行日志函数，供列表转换辅助流程在完成事务后输出一致格式的诊断日志。
 * 使用范围：仅用于 [`transformParagraphToList()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:76)、[`transformListType()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:110) 与 [`transformBatch()`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts:140) 在事务执行成功后的日志记录；边界是不在本文件内决定日志级别策略，也不负责日志核心实现。
 * 解耦评估：理论上可把日志函数从调用方参数传入，但当前三个 helper 都稳定需要同一日志能力，而执行器层本身已经通过 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 收敛日志依赖；若在这里再做参数透传，只会把日志耦合从单点路径依赖转成多层签名耦合。事件发射同样不适合替代这种需要同步携带上下文的直接记录行为。因此继续经由同层日志网关导入，是当前架构下耦合面更小的实现。
 */
import { logCommandExecution } from "./imports";

/**
 * 获取选中元素列表
 * 如果没有多选元素，返回包含当前元素的数组
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const getSelectElements = (
    protyle: IProtyle,
    nodeElement: HTMLElement
) => {
    const selectsElement: HTMLElement[] = Array.from(
        protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--select") || []
    );

    // 如果没有多选元素，使用当前元素作为默认选择
    if (selectsElement.length === 0) {
        selectsElement.push(nodeElement);
    }

    return selectsElement;
};

/**
 * 提取元素的类型信息
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const extractElementInfo = (element: HTMLElement | undefined) => {
    if (!element) {
        return { type: null, subType: null, nodeId: null };
    }

    return {
        type: element.getAttribute("data-type"),
        subType: element.getAttribute("data-subtype"),
        nodeId: element.getAttribute("data-node-id")
    };
};

/**
 * 执行段落到列表的转换
 */
export const transformParagraphToList = async (
    protyle: IProtyle,
    selectsElement: HTMLElement[],
    targetType: TransformTransactionType,
    event: KeyboardEvent,
    nodeElement: HTMLElement,
    command: ListCommand,
    nodeId: string | null,
    type: string | null
) => {
    await turnsIntoOneTransaction({
        protyle,
        selectsElement,
        type: targetType
    });

    const typeNames: Record<TransformTransactionType, string> = {
        "Blocks2ULs": "无序列表",
        "Blocks2OLs": "有序列表",
        "Blocks2TLs": "任务列表"
    };

    logCommandExecution({
        command,
        event,
        nodeElement,
        result: `段落转换为${typeNames[targetType]}`,
        context: { nodeId, sourceType: type }
    });
};

/**
 * 执行列表类型之间的转换
 */
export const transformListType = async (
    protyle: IProtyle,
    targetElement: HTMLElement,
    nodeId: string,
    transformType: "OL2UL" | "TL2UL" | "UL2OL" | "TL2OL" | "OL2TL" | "UL2TL",
    event: KeyboardEvent,
    nodeElement: HTMLElement,
    command: ListCommand,
    subType: string | null,
    description: string
) => {
    await turnsOneInto({
        protyle,
        nodeElement: targetElement,
        id: nodeId,
        type: transformType
    });

    logCommandExecution({
        command,
        event,
        nodeElement,
        result: description,
        context: { nodeId, sourceSubtype: subType }
    });
};

/**
 * 执行批量转换
 */
export const transformBatch = async (
    protyle: IProtyle,
    selectsElement: HTMLElement[],
    targetType: TransformTransactionType,
    event: KeyboardEvent,
    nodeElement: HTMLElement,
    command: ListCommand
) => {
    await turnsIntoOneTransaction({
        protyle,
        selectsElement,
        type: targetType
    });

    const typeNames: Record<TransformTransactionType, string> = {
        "Blocks2ULs": "无序列表",
        "Blocks2OLs": "有序列表",
        "Blocks2TLs": "任务列表"
    };

    logCommandExecution({
        command,
        event,
        nodeElement,
        result: `批量转换为${typeNames[targetType]}: ${selectsElement.length} 个元素`,
        context: { selectCount: selectsElement.length }
    });
};
