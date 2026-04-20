/**
 * listRouter 日志工具
 * 
 * 本文件提供详细的命令执行日志功能
 * 在 verbose 模式下输出极其详细的执行信息
 */
//@AIDONE 这个工具应该是一个公共工具,你应该把它抽离到一个公共模块中,以便其他模块也能使用它

/**
 * 用途：引入公共日志核心实现，供当前列表键盘模块统一转发日志级别读写与命令执行日志函数。
 * 使用范围：仅用于 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 这个列表键盘日志网关文件向 [`executors.ts`](app/src/protyle/wysiwyg/keydown.list/executors.ts)、[`executors.transform.ts`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts)、[`executors.transform.helpers.ts`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts) 以及 [`index.ts`](app/src/protyle/wysiwyg/keydown.list/index.ts) 转发统一日志入口；边界是这里只暴露既有日志能力，不负责日志格式化实现细节、命令路由判断或编辑器状态提取。
 * 解耦评估：理论上可把 [`logCommandExecution()`](app/src/util/lib/logger/core.ts:68)、[`logTaskToggle()`](app/src/util/lib/logger/core.ts:117)、[`setLogLevel()`](app/src/util/lib/logger/core.ts:35)、[`getLogLevel()`](app/src/util/lib/logger/core.ts:50) 作为参数注入各执行器，但当前多个列表执行器文件都稳定依赖同一套日志 API；若改成逐层参数传递，需要沿键盘处理与模块导出链扩散样板代码，而事件发射也无法自然覆盖同步返回的日志级别读写接口。现阶段通过单一 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 收敛 util 路径依赖，已经比让每个业务文件直接耦合深层 logger 路径更低耦合。
 */
import {
    getLogLevel,
    logCommandExecution,
    logTaskToggle,
    setLogLevel,
} from "../../../util/lib/logger/core";
/**
 * 用途：引入公共日志模块暴露的日志级别枚举与命令日志参数契约，并在当前列表键盘模块的日志转发层统一对外再导出。
 * 使用范围：仅用于 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 这个列表键盘日志网关文件向 [`executors.ts`](app/src/protyle/wysiwyg/keydown.list/executors.ts)、[`executors.transform.ts`](app/src/protyle/wysiwyg/keydown.list/executors.transform.ts)、[`executors.transform.helpers.ts`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts) 以及 [`index.ts`](app/src/protyle/wysiwyg/keydown.list/index.ts) 的公开 API 复用统一日志契约；边界是这里只转发共享类型/枚举，不承载任何日志格式化、命令执行或路由判断逻辑。
 * 解耦评估：理论上运行时函数可通过依赖注入或参数传递解耦，但这里导入的 [`LogLevel`](app/src/util/lib/logger/types.ts:11) 是运行时枚举公开契约、[`CommandLogParams`](app/src/util/lib/logger/types.ts:21) 是编译期类型契约，它们都需要与 [`core.ts`](app/src/util/lib/logger/core.ts:8) 保持同源定义；若改为在列表模块内重复声明、通过事件发射传递，或让每个调用方直接访问深层 util 路径，都会造成契约分叉或把路径耦合扩散到更多业务文件。当前通过本文件集中转发公共日志契约，已经是在现有架构下比业务文件直接硬连 util 路径更低耦合的方案。
 */
import {
    LogLevel,
    type CommandLogParams,
} from "../../../util/lib/logger/types";

/**
 * 用途：对外暴露公共日志级别枚举，供列表模块调用方配置日志详细程度。
 */
export { LogLevel };
/**
 * 用途：对外暴露命令日志参数类型，供列表模块的类型声明与调用方约束复用。
 */
export type { CommandLogParams };
/**
 * 用途：对外暴露日志级别设置函数，供列表模块入口与外部调试流程统一配置日志行为。
 */
export { setLogLevel };
/**
 * 用途：对外暴露日志级别读取函数，供列表模块调用方观察当前日志配置。
 */
export { getLogLevel };
/**
 * 用途：对外暴露命令执行日志函数，供列表执行器记录统一格式的命令日志。
 */
export { logCommandExecution };
/**
 * 用途：对外暴露任务勾选日志函数，供任务列表切换执行器记录状态变更日志。
 */
export { logTaskToggle };
