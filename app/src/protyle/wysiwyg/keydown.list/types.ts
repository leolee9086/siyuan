/**
 * listRouter 类型定义
 *
 * 本文件定义列表路由系统的共享状态类型与 Schema。
 * 用于状态验证和类型安全
 */

/**
 * 用途：通过同层依赖网关引入 Arktype 的运行时 schema 构造函数，供当前文件中独立的 CheckToggle、Outdent、Indent 与 Transform 状态 Schema 使用。
 * 使用范围：不参与 `UnifiedListStateSchema` 及 unified Calibur 路由；统一路由使用 Zod 形式化后端。
 * 解耦评估：这些 schema 是静态模块定义的一部分，无法通过事件发射替代。理论上可把 schema 实例改为由外部工厂创建后传入，但那会打散当前类型文件中“schema + infer 类型”同源维护的结构，增加装配复杂度且不减少真实耦合；继续经由 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 单点转发第三方 DSL 更合适。
 */
import { type } from "./imports";
/**
 * 用途：通过同层依赖网关引入 Arktype 的 schema 类型接口，供当前类型文件为状态 schema 常量提供精确的泛型约束。
 * 使用范围：仅用于上述独立 Arktype Schema 的编译期标注；边界是不参与统一 Zod 路由。
 * 解耦评估：[`Type`](app/src/protyle/wysiwyg/keydown.list/imports.ts:90) 属于编译期契约，无法通过依赖注入或事件发射获得更低耦合；若在本文件重复声明这些 schema 的目标结构，会导致类型与 schema 推断分离。通过同层网关统一转发第三方类型导出，能把外部包路径耦合限制在单点。
 */
import type { Type } from "./imports";
import {zodState} from "./imports";
/**
 * 日志级别枚举
 */
export enum LogLevel {
    /** 简洁模式：只输出基本信息 */
    SIMPLE = "simple",
    /** 详细模式：输出完整的执行上下文 */
    VERBOSE = "verbose"
}

/**
 * 命令执行日志参数接口
 */
export interface CommandLogParams {
    /** 命令标识符 */
    command: ListCommand;
    /** 键盘事件对象 */
    event: KeyboardEvent;
    /** 块元素 */
    nodeElement: HTMLElement;
    /** 执行结果描述（可选） */
    result?: string;
    /** 额外的上下文信息（可选） */
    context?: Record<string, unknown>;
}

/**
 * 任务列表完成状态
 *
 * `todo` 表示未完成，`done` 表示已完成。
 */
export type TaskStatus = "todo" | "done";

/**
 * 任务列表状态空间中的状态值。
 *
 * 非任务列表项时为 `null`。
 */
export type TaskStatusState = TaskStatus | null;

/**
 * 统一列表状态空间 Schema
 *
 * 本 schema 收敛统一列表中间件的全部输入状态，
 * 供 unified 路由器、状态提取器与执行器共享同一份契约。
 */
const taskStatusState = zodState.union(
    zodState.enumerated("todo", "done"),
    zodState.literal(null),
);

export const UnifiedListStateSchema = zodState.object({
    hotkeys: zodState.object({
        checkToggle: zodState.boolean(),
        outdent: zodState.boolean(),
        indent: zodState.boolean(),
        list: zodState.boolean(),
        oList: zodState.boolean(),
        check: zodState.boolean(),
        quote: zodState.boolean(),
    }),
    selection: zodState.object({
        hasMultiple: zodState.boolean(),
        isContinuous: zodState.boolean(),
        firstInList: zodState.boolean(),
        hasListItem: zodState.boolean(),
        isSingle: zodState.boolean(),
    }),
    context: zodState.object({
        inListItem: zodState.boolean(),
        inCodeBlock: zodState.boolean(),
        hasTaskItem: zodState.boolean(),
        taskStatus: taskStatusState,
        nextTaskStatus: taskStatusState,
        hasPreviousSibling: zodState.boolean(),
        blockType: zodState.enumerated("NodeParagraph", "NodeList", "NodeHeading", "other"),
        listSubtype: zodState.union(
            zodState.enumerated("u", "o", "t"),
            zodState.literal(null),
        ),
    }),
});

/**
 * 统一列表状态类型
 */
export type UnifiedListState = typeof UnifiedListStateSchema.infer;

/**
 * 快捷键状态类型
 */
export type HotkeysState = UnifiedListState["hotkeys"];

/**
 * 选区状态类型
 */
export type SelectionState = UnifiedListState["selection"];

/**
 * 上下文状态类型
 */
export type ContextState = UnifiedListState["context"];

/**
 * Phase 1: 任务列表切换状态 Schema
 *
 * 用于 listCheckToggleMiddleware 的状态空间
 * 这是最简单的状态，只需要两个布尔字段
 */
export const CheckToggleStateSchema: Type<{
    isCheckToggleKey: boolean;
    hasTaskItem: boolean;
}> = type({
    /** 是否按下任务列表切换快捷键 */
    isCheckToggleKey: "boolean",
    /** 光标是否在任务列表项中 */
    hasTaskItem: "boolean"
});

/**
 * 任务列表切换状态类型
 *
 * 用途：表示任务列表切换操作的状态空间
 * 使用场景：在 listCheckToggleMiddleware 中用于路由决策
 * 关联类型：由 CheckToggleStateSchema 推断而来
 *
 * @property isCheckToggleKey - 是否按下任务列表切换快捷键
 * @property hasTaskItem - 光标是否在任务列表项中
 */
export type CheckToggleState = typeof CheckToggleStateSchema.infer;

/**
 * Phase 2: 列表缩出状态（预留）
 * 
 * 用于 listOutdentMiddleware 的状态空间
 */
export const OutdentStateSchema: Type<{
    isOutdentKey: boolean;
    hasSelectElements: boolean;
    isContinuousSelection: boolean;
    isFirstSelectInList: boolean;
    isInListItem: boolean;
    isInCodeBlock: boolean;
}> = type({
    /** 是否按下列表缩出快捷键 */
    isOutdentKey: "boolean",
    /** 是否有多选元素 */
    hasSelectElements: "boolean",
    /** 多选元素是否连续 */
    isContinuousSelection: "boolean",
    /** 第一个选中元素是否在列表中 */
    isFirstSelectInList: "boolean",
    /** 当前元素是否在列表项中 */
    isInListItem: "boolean",
    /** 当前元素是否在代码块中 */
    isInCodeBlock: "boolean"
});

/**
 * 列表缩出状态类型
 *
 * 用途：表示列表缩出操作的状态空间
 * 使用场景：在 listOutdentMiddleware 中用于路由决策（Phase 2 预留）
 * 关联类型：由 OutdentStateSchema 推断而来
 */
export type OutdentState = typeof OutdentStateSchema.infer;

/**
 * Phase 3: 列表缩进状态（预留）
 * 
 * 用于 listIndentMiddleware 的状态空间
 */
export const IndentStateSchema: Type<{
    isIndentKey: boolean;
    hasSelectElements: boolean;
    isContinuousSelection: boolean;
    isFirstSelectInList: boolean;
    isInListItem: boolean;
    isInCodeBlock: boolean;
    hasPreviousSibling: boolean;
}> = type({
    /** 是否按下列表缩进快捷键 */
    isIndentKey: "boolean",
    /** 是否有多选元素 */
    hasSelectElements: "boolean",
    /** 多选元素是否连续 */
    isContinuousSelection: "boolean",
    /** 第一个选中元素是否在列表中 */
    isFirstSelectInList: "boolean",
    /** 当前元素是否在列表项中 */
    isInListItem: "boolean",
    /** 当前元素是否在代码块中 */
    isInCodeBlock: "boolean",
    /** 是否有前一个兄弟元素（缩进需要） */
    hasPreviousSibling: "boolean"
});

/**
 * 列表缩进状态类型
 *
 * 用途：表示列表缩进操作的状态空间
 * 使用场景：在 listIndentMiddleware 中用于路由决策（Phase 3 预留）
 * 关联类型：由 IndentStateSchema 推断而来
 */
export type IndentState = typeof IndentStateSchema.infer;

/**
 * Phase 4: 列表转换状态（预留）
 *
 * 用于 listTransformMiddleware 的状态空间
 * 这是最复杂的状态，需要处理多种列表类型转换
 */
export const TransformStateSchema: Type<{
    isListKey: boolean;
    isOListKey: boolean;
    isCheckKey: boolean;
    isQuoteKey: boolean;
    isSingleSelect: boolean;
    isContinuousSelection: boolean;
    hasListItem: boolean;
    currentType: "NodeParagraph" | "NodeList" | "NodeHeading" | "other";
    currentSubtype?: "u" | "o" | "t" | null;
}> = type({
    /** 是否按下无序列表快捷键 */
    isListKey: "boolean",
    /** 是否按下有序列表快捷键 */
    isOListKey: "boolean",
    /** 是否按下任务列表快捷键 */
    isCheckKey: "boolean",
    /** 是否按下引用快捷键 */
    isQuoteKey: "boolean",
    /** 是否单选（selectCount <= 1） */
    isSingleSelect: "boolean",
    /** 选中元素是否连续 */
    isContinuousSelection: "boolean",
    /** 选中元素中是否包含列表项 */
    hasListItem: "boolean",
    /** 当前块类型 */
    currentType: "'NodeParagraph' | 'NodeList' | 'NodeHeading' | 'other'",
    /** 当前列表子类型（如果是列表） */
    "currentSubtype?": "'u' | 'o' | 't' | null"
});

/**
 * 列表转换状态类型
 *
 * 用途：表示列表类型转换操作的状态空间
 * 使用场景：在 listTransformMiddleware 中用于路由决策（Phase 4 预留）
 * 关联类型：由 TransformStateSchema 推断而来
 */
export type TransformState = typeof TransformStateSchema.infer;

/**
 * 列表转换事务类型
 *
 * 用途：表示列表转换辅助流程传递给事务层的目标转换动作标识。
 * 使用场景：在 [`executors.transform.helpers.ts`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts) 中约束段落转列表与批量转换时的 `targetType` 参数，并为对应的结果描述映射提供键空间。
 * 关联类型：与 [`ListCommand`](app/src/protyle/wysiwyg/keydown.list/types.ts:201) 同属列表键盘模块的共享类型契约，但它描述的是底层事务动作，而非对外暴露的命令语义。
 * 问题/改进：当前仅覆盖无序列表、有序列表和任务列表三类转换；若后续补充引用块或其他批量转换事务，应在保证事务层同步支持的前提下扩展该联合类型，避免业务层与事务层标识失配。
 */
export type TransformTransactionType =
    | "Blocks2ULs"
    | "Blocks2OLs"
    | "Blocks2TLs";

/**
 * 列表命令类型
 *
 * 用途：表示所有可能的列表操作命令
 * 使用场景：在路由器返回值和命令执行器参数中使用
 * 关联类型：与 LIST_COMMANDS 常量对象对应
 */
export type ListCommand =
    | "CHECK_TOGGLE"
    | "OUTDENT"
    | "INDENT"
    | "TRANSFORM_TO_UL"
    | "TRANSFORM_TO_OL"
    | "TRANSFORM_TO_TL"
    | "TRANSFORM_TO_QUOTE"
    | "IGNORE";

/**
 * 命令执行器函数接口
 *
 * 用途：定义所有命令执行器的统一接口
 * 使用场景：在命令执行器映射表和执行函数中使用
 *
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @param range - 当前选区对象
 * @param controller - 中止控制器，用于终止后续处理
 * @param state - 已收集的统一列表状态
 */
export interface CommandExecutor {
    (
        event: KeyboardEvent,
        protyle: IProtyle,
        nodeElement: HTMLElement,
        range: Range,
        controller: AbortController,
        state: UnifiedListState
    ): Promise<void>;
}
