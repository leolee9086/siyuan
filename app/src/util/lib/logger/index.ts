/**
 * 公共日志模块统一导出
 * 
 * 本文件统一导出所有日志功能，提供简洁的导入接口
 */

/** 用途：日志级别枚举。使用范围：日志模块类型定义。解耦评估：同目录类型文件。 */
import { LogLevel } from "./types";
/** 用途：命令日志参数类型。使用范围：日志模块类型定义。解耦评估：同目录类型文件。 */
import type { CommandLogParams } from "./types";
/** 用途：日志格式化工具函数。使用范围：日志模块格式化输出。解耦评估：同目录工具模块。 */
import { formatHotkey } from "./formatters";
/** 用途：调用者信息提取。使用范围：日志模块格式化。解耦评估：同目录工具模块。 */
import { extractCallerInfo } from "./formatters";
/** 用途：块类型描述。使用范围：日志模块格式化。解耦评估：同目录工具模块。 */
import { getBlockTypeDescription } from "./formatters";
/** 用途：命令描述。使用范围：日志模块格式化。解耦评估：同目录工具模块。 */
import { getCommandDescription } from "./formatters";
/** 用途：任务状态描述。使用范围：日志模块格式化。解耦评估：同目录工具模块。 */
import { getTaskStatusDescription } from "./formatters";
/** 用途：设置日志级别。使用范围：日志模块核心。解耦评估：同目录核心模块。 */
import { setLogLevel } from "./core";
/** 用途：获取日志级别。使用范围：日志模块核心。解耦评估：同目录核心模块。 */
import { getLogLevel } from "./core";
/** 用途：记录命令执行。使用范围：日志模块核心。解耦评估：同目录核心模块。 */
import { logCommandExecution } from "./core";
/** 用途：记录任务切换。使用范围：日志模块核心。解耦评估：同目录核心模块。 */
import { logTaskToggle } from "./core";

/** 导出日志级别枚举 */
export { LogLevel };
/** 导出命令日志参数类型 */
export type { CommandLogParams };
/** 导出格式化工具函数 */
export { formatHotkey, extractCallerInfo, getBlockTypeDescription, getCommandDescription, getTaskStatusDescription };
/** 导出核心日志功能 */
export { setLogLevel, getLogLevel, logCommandExecution, logTaskToggle };