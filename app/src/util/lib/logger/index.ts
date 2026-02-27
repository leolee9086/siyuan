/**
 * 公共日志模块统一导出
 * 
 * 本文件统一导出所有日志功能，提供简洁的导入接口
 */

// 导出类型定义
export { LogLevel, type CommandLogParams } from "./types";

// 导出格式化工具函数
export {
    formatHotkey,
    extractCallerInfo,
    getBlockTypeDescription,
    getCommandDescription,
    getTaskStatusDescription
} from "./formatters";

// 导出核心日志功能
export {
    setLogLevel,
    getLogLevel,
    logCommandExecution,
    logTaskToggle
} from "./core";