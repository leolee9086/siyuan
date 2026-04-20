/**
 * listRouter 模块主入口
 *
 * 本文件统一导出列表路由系统的所有公共接口
 * 已完成统一中间件迁移，所有列表操作由 listUnifiedMiddleware 统一处理
 */

// ============================================================================
// 统一列表中间件（已完成迁移）
// ============================================================================

/**
 * 导出统一列表中间件
 *
 * listUnifiedMiddleware: 统一处理所有列表操作的中间件
 * 合并了以下功能：
 * - 任务列表勾选切换
 * - 列表减少缩进（outdent）
 * - 列表增加缩进（indent）
 * - 列表类型转换（无序、有序、任务、引用之间的转换）
 */
export { listUnifiedMiddleware } from "./unified";

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
 * 导出统一路由器实例
 *
 * 供测试和调试使用，一般情况下不需要直接使用路由器
 */
export {
    listMasterRouter,
    checkToggleSubRouter,
    outdentSubRouter,
    indentSubRouter,
    transformSubRouter
} from "./unified";

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
export { setLogLevel, getLogLevel, logCommandExecution, logTaskToggle } from "./imports";

// ============================================================================
// 命令常量导出（可选）
// ============================================================================

/**
 * 导出命令常量
 * 
 * 供测试和扩展使用
 */
export { LIST_COMMANDS } from "./commands";
