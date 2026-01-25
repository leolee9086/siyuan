/**
 * listRouter 类型定义
 *
 * 本文件定义了列表路由系统中使用的所有类型和 arktype schemas
 * 用于状态验证和类型安全
 */

import { type, type Type } from "arktype";

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
    selectCount: number;
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
    /** 选中元素数量 */
    selectCount: "number",
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
 */
export interface CommandExecutor {
    (
        event: KeyboardEvent,
        protyle: IProtyle,
        nodeElement: HTMLElement,
        range: Range,
        controller: AbortController
    ): Promise<void>;
}
