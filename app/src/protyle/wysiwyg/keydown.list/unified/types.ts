/**
 * 统一列表状态空间类型定义
 *
 * 本文件定义了归并后的统一列表状态空间 Schema
 * 将原有 4 个独立状态（CheckToggle、Outdent、Indent、Transform）合并为一个三层嵌套结构
 *
 * 设计原则：
 * 1. 快捷键状态（hotkeys）：所有快捷键检测结果
 * 2. 选区状态（selection）：多选、连续性、位置等
 * 3. 上下文状态（context）：当前块类型、列表类型等
 *
 * @see docs/ttt/键盘事件处理重构-列表归并设计.md
 */

import { type, type Type } from "arktype";

/**
 * 统一列表状态空间 Schema
 *
 * 用途：定义列表操作的完整状态空间
 * 使用场景：在 listUnifiedMiddleware 中用于路由决策
 *
 * 状态分组说明：
 * - hotkeys: 快捷键检测结果，决定进入哪个子路由器
 * - selection: 选区状态，决定操作范围和可行性
 * - context: 上下文状态，决定具体操作行为
 */
export const UnifiedListStateSchema: Type<{
    hotkeys: {
        checkToggle: boolean;
        outdent: boolean;
        indent: boolean;
        list: boolean;
        oList: boolean;
        check: boolean;
        quote: boolean;
    };
    selection: {
        hasMultiple: boolean;
        isContinuous: boolean;
        firstInList: boolean;
        hasListItem: boolean;
        isSingle: boolean;
    };
    context: {
        inListItem: boolean;
        inCodeBlock: boolean;
        hasTaskItem: boolean;
        hasPreviousSibling: boolean;
        blockType: "NodeParagraph" | "NodeList" | "NodeHeading" | "other";
        listSubtype: "u" | "o" | "t" | null;
    };
}> = type({
    /**
     * 快捷键状态
     * 用于快速路径判断和子路由器分发
     */
    hotkeys: {
        /** 任务列表切换快捷键 */
        checkToggle: "boolean",
        /** 列表缩出快捷键 */
        outdent: "boolean",
        /** 列表缩进快捷键 */
        indent: "boolean",
        /** 无序列表快捷键 */
        list: "boolean",
        /** 有序列表快捷键 */
        oList: "boolean",
        /** 任务列表快捷键 */
        check: "boolean",
        /** 引用快捷键 */
        quote: "boolean"
    },
    /**
     * 选区状态
     * 用于判断操作范围和可行性
     */
    selection: {
        /** 是否有多选元素（selectCount > 0） */
        hasMultiple: "boolean",
        /** 多选元素是否连续 */
        isContinuous: "boolean",
        /** 第一个选中元素是否在列表中 */
        firstInList: "boolean",
        /** 选中元素中是否包含列表项 */
        hasListItem: "boolean",
        /** 是否单选（selectCount <= 1） */
        isSingle: "boolean"
    },
    /**
     * 上下文状态
     * 用于决定具体操作行为
     */
    context: {
        /** 当前元素是否在列表项中 */
        inListItem: "boolean",
        /** 当前元素是否在代码块中 */
        inCodeBlock: "boolean",
        /** 光标是否在任务列表项中（data-subtype="t"） */
        hasTaskItem: "boolean",
        /** 是否有前一个兄弟元素（缩进需要） */
        hasPreviousSibling: "boolean",
        /** 当前块类型 */
        blockType: "'NodeParagraph' | 'NodeList' | 'NodeHeading' | 'other'",
        /** 当前列表子类型（如果是列表） */
        listSubtype: "'u' | 'o' | 't' | null"
    }
});

/**
 * 统一列表状态类型
 *
 * 用途：表示列表操作的完整状态空间
 * 使用场景：在状态提取函数返回值和路由器输入中使用
 * 关联类型：由 UnifiedListStateSchema 推断而来
 */
export type UnifiedListState = typeof UnifiedListStateSchema.infer;

/**
 * 快捷键状态类型
 *
 * 用途：表示所有快捷键的检测结果
 * 使用场景：在快速路径判断和子路由器分发中使用
 */
export type HotkeysState = UnifiedListState["hotkeys"];

/**
 * 选区状态类型
 *
 * 用途：表示选区相关的状态
 * 使用场景：在判断操作范围和可行性时使用
 */
export type SelectionState = UnifiedListState["selection"];

/**
 * 上下文状态类型
 *
 * 用途：表示当前编辑上下文的状态
 * 使用场景：在决定具体操作行为时使用
 */
export type ContextState = UnifiedListState["context"];
