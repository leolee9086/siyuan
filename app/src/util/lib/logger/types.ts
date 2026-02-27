/**
 * 公共日志模块类型定义
 * 
 * 本文件定义了日志系统中使用的所有类型和接口
 * 用于类型安全和统一的日志功能
 */

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
    command: string;
    /** 键盘事件对象 */
    event: KeyboardEvent;
    /** 块元素 */
    nodeElement: HTMLElement;
    /** 执行结果描述（可选） */
    result?: string;
    /** 额外的上下文信息（可选） */
    context?: Record<string, unknown>;
}