/**
 * listRouter 日志工具
 * 
 * 本文件提供详细的命令执行日志功能
 * 在 verbose 模式下输出极其详细的执行信息
 */
//@AIDONE 这个工具应该是一个公共工具,你应该把它抽离到一个公共模块中,以便其他模块也能使用它

// 从公共日志模块导出所有功能
export { 
    LogLevel, 
    type CommandLogParams,
    setLogLevel,
    getLogLevel,
    logCommandExecution,
    logTaskToggle
} from "../../../util/logger";
