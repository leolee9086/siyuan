// ============================================================================
// 命令定义
// ============================================================================

/**
 * goEnd 操作命令
 *
 * 用于路由器决策后的命令分发，指示应执行的具体操作类型。
 * 命令在状态空间路由器中生成，由执行器消费。
 */
export const enum GoEndCommand {
    /** 无操作（前置条件不满足） */
    IGNORE = "IGNORE",
    /** 动态加载更多内容 */
    DYNAMIC_LOAD = "DYNAMIC_LOAD",
    /** 滚动到文档末尾 */
    SCROLL_TO_END = "SCROLL_TO_END"
}

// ============================================================================
// 状态空间定义
// ============================================================================

/**
 * goEnd 操作状态空间
 *
 * 描述影响 goEnd 行为的所有状态维度：
 * - hasLastElement: 是否存在最后一个元素（前置条件）
 * - needsDynamicLoad: 是否需要动态加载（scrollVisible && !isEOF 的派生状态）
 * - canScroll: 是否可以滚动（即 contentElement 是否存在）
 *
 * 设计说明：
 * - needsDynamicLoad 和 canScroll 是派生状态，从原始状态计算得到
 * - 这种设计确保路由器模式互斥，避免复杂的条件重叠问题
 */
export interface GoEndState {
    hasLastElement: boolean;
    needsDynamicLoad: boolean;
    canScroll: boolean;
}
