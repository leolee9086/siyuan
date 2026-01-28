/**
 * 统一列表模块入口
 *
 * 本文件统一导出列表状态空间归并后的所有公共接口
 *
 * @see docs/ttt/键盘事件处理重构-列表归并设计.md
 */

// ============================================================================
// 中间件导出
// ============================================================================

/**
 * 导出统一列表中间件
 *
 * listUnifiedMiddleware: 替代原有 4 个独立中间件的统一入口
 * - listCheckToggleMiddleware
 * - listOutdentMiddleware
 * - listIndentMiddleware
 * - listTransformMiddleware
 */
export { listUnifiedMiddleware } from "./middleware";

// ============================================================================
// 类型导出
// ============================================================================

/**
 * 导出类型定义
 *
 * 供外部使用的类型，包括：
 * - UnifiedListState: 统一列表状态
 * - HotkeysState: 快捷键状态
 * - SelectionState: 选区状态
 * - ContextState: 上下文状态
 */
export type {
    UnifiedListState,
    HotkeysState,
    SelectionState,
    ContextState
} from "./types";

// ============================================================================
// Schema 导出
// ============================================================================

/**
 * 导出 Schema 定义
 *
 * 供测试和扩展使用
 */
export { UnifiedListStateSchema } from "./types";

// ============================================================================
// 路由器导出（供测试使用）
// ============================================================================

/**
 * 导出路由器实例
 *
 * 供测试和调试使用，一般情况下不需要直接使用路由器
 */
export {
    listMasterRouter,
    checkToggleSubRouter,
    outdentSubRouter,
    indentSubRouter,
    transformSubRouter
} from "./router";

// ============================================================================
// 状态提取函数导出（供测试使用）
// ============================================================================

/**
 * 导出状态提取函数
 *
 * 供测试和调试使用
 */
export { extractUnifiedListState } from "./state";
