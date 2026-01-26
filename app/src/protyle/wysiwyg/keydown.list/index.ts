/**
 * listRouter 模块主入口
 * 
 * 本文件统一导出列表路由系统的所有公共接口
 * 用于渐进式迁移和模块化管理
 */

// ============================================================================
// Phase 1: 任务列表切换（已实现）
// ============================================================================

/**
 * 导出 Phase 1 中间件
 * 
 * listCheckToggleMiddleware: 使用 CalibURRouter 模式的任务列表切换中间件
 * 这是试点实现，展示完整的状态驱动路由模式
 */
export { listCheckToggleMiddleware } from "./middlewares/checkToggle";

// ============================================================================
// Phase 2: 列表缩出中间件（已实现）
// ============================================================================

/**
 * 导出 Phase 2 中间件
 *
 * listOutdentMiddleware: 使用 CalibURRouter 模式的列表缩出中间件
 * 处理列表项的缩出操作（减少缩进层级）
 */
export { listOutdentMiddleware } from "./middlewares/outdent";

// ============================================================================
// Phase 3: 列表缩进中间件（已实现）
// ============================================================================

/**
 * 导出 Phase 3 中间件
 *
 * listIndentMiddleware: 使用 CalibURRouter 模式的列表缩进中间件
 * 处理列表项的缩进操作（增加缩进层级）
 */
export { listIndentMiddleware } from "./middlewares/indent";

// ============================================================================
// Phase 4: 列表转换中间件（已实现）
// ============================================================================

/**
 * 导出 Phase 4 中间件
 *
 * listTransformMiddleware: 使用 CalibURRouter 模式的列表转换中间件
 * 处理列表类型转换操作（无序列表、有序列表、任务列表、引用之间的转换）
 */
export { listTransformMiddleware } from "./middlewares/transform";

// ============================================================================
// 类型导出
// ============================================================================

/**
 * 导出类型定义
 * 
 * 供外部使用的类型，包括：
 * - 状态类型：CheckToggleState, OutdentState, IndentState, TransformState
 * - 命令类型：ListCommand
 * - 执行器接口：CommandExecutor
 */
export type {
    CheckToggleState,
    OutdentState,
    IndentState,
    TransformState,
    ListCommand,
    CommandExecutor,
    LogLevel,
    CommandLogParams
} from "./types";

// ============================================================================
// 路由器导出（可选）
// ============================================================================

/**
 * 导出路由器实例
 *
 * 供测试和调试使用，一般情况下不需要直接使用路由器
 */
export { checkToggleRouter, outdentRouter, indentRouter } from "./router";
export { transformRouter } from "./router.transform";

// ============================================================================
// 日志工具导出
// ============================================================================

/**
 * 导出日志工具函数
 *
 * 供外部使用的日志功能，包括：
 * - setLogLevel: 设置日志级别
 * - getLogLevel: 获取当前日志级别
 * - logCommandExecution: 记录命令执行日志
 * - logTaskToggle: 记录任务状态切换日志
 */
export { setLogLevel, getLogLevel, logCommandExecution, logTaskToggle } from "./logger";

// ============================================================================
// 命令常量导出（可选）
// ============================================================================

/**
 * 导出命令常量
 * 
 * 供测试和扩展使用
 */
export { LIST_COMMANDS } from "./commands";
