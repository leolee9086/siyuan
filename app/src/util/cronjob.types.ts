/**
 * cronjob.types.ts - 定时任务相关类型定义
 */

/**
 * 任务状态类型
 * - idle: 未运行
 * - running: 运行中
 * - paused: 已暂停
 * - error: 出错
 */
export type 任务状态类型 = "idle" | "running" | "paused" | "error";

/**
 * 任务运行时信息
 * 描述一个定时任务的当前状态和配置
 */
export interface 任务运行时信息 {
    /** 文档ID */
    docId: string;
    /** 任务名称 */
    name: string;
    /** 调度表达式 (cron 格式) */
    schedule: string;
    /** 任务描述 */
    description: string;
    /** 当前状态 */
    status: 任务状态类型;
    /** 上次运行时间戳 (秒) */
    lastRun: number;
    /** 下次运行时间戳 (秒) */
    nextRun: number;
    /** 上次错误信息 */
    lastError: string;
    /** 累计运行次数 */
    runCount: number;
}

/**
 * 执行日志条目
 * 记录任务执行的日志信息
 */
export interface 执行日志 {
    /** 时间戳 */
    time: number;
    /** 日志内容 */
    message: string;
    /** 日志级别 */
    level: "info" | "error" | "warn";
}

/**
 * 编译结果
 * 文档编译后的结果信息
 */
export interface 编译结果 {
    /** 编译后的代码 */
    code: string;
    /** 文档ID */
    docId: string;
    /** 输出文件路径 */
    output: string;
}

// 英文别名导出
export type TaskStatusType = 任务状态类型;
export type TaskRuntimeInfo = 任务运行时信息;
export type ExecutionLog = 执行日志;
export type CompileResult = 编译结果;
