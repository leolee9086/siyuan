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
 * 用途：引入段落/批量列表转换所需的事务合并函数，供当前列表键盘模块的转换执行器经由同层网关复用既有事务能力。
 * 使用范围：仅用于 [`executors.transform.helpers.ts`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts) 等列表转换辅助流程在键盘命令执行阶段提交批量转换事务；边界是不在本文件内承担事务参数组装、路由判断或编辑器状态提取。
 * 解耦评估：理论上可以把事务函数从转换执行器逐层作为参数注入，但当前列表转换调用链是静态模块组合，若强行透传会把同一事务依赖扩散到多个 helper 和执行器签名，增加样板且不减少真实耦合；事件发射也无法替代这种必须 await 的同步转换调用。因此通过本同层 imports 网关集中转发，是现有架构下更低耦合的方案。
 */
import {turnsIntoOneTransaction} from "../transaction/turns/container";
/**
 * 用途：引入单节点列表类型互转事务函数，供当前列表键盘模块的转换辅助流程复用既有单节点转换实现。
 * 使用范围：仅用于 [`executors.transform.helpers.ts`](app/src/protyle/wysiwyg/keydown.list/executors.transform.helpers.ts) 在列表类型互转流程中提交单节点转换事务；边界是不在本文件内扩展事务语义，也不负责决定何时触发互转。
 * 解耦评估：理论上可把该函数由调用方参数传入，但 [`turnsOneInto()`](app/src/protyle/transaction.ts:936) 与 [`turnsIntoOneTransaction()`](app/src/protyle/transaction.ts:881) 共同构成当前列表转换层的稳定事务契约；若只对其中一部分做注入，helper 仍需了解事务细节，抽象边界不会更清晰。继续经由同层网关统一暴露，能把父级事务模块路径耦合限制在单点。
 */
import {turnsOneInto} from "../transaction/turns/single";
/**
 * 用途：引入基于属性的最近祖先查找函数，供列表执行器与 unified 状态提取流程复用统一的任务列表项定位逻辑。
 * 使用范围：仅用于 [`executors.ts`](app/src/protyle/wysiwyg/keydown.list/executors.ts) 的任务勾选执行路径，以及 [`unified/state.ts`](app/src/protyle/wysiwyg/keydown.list/unified/state.ts:21) 的状态提取流程；边界是不在本文件内扩展 DOM 遍历策略，也不承担事务提交或命令路由判断。
 * 解耦评估：理论上可由调用方先把匹配结果作为参数传入执行器或状态提取器，但当前两个流程都直接依赖实时 DOM 与 Range 上下文做同步判断；若改成透传，会把同一遍历职责扩散到更多入口，不能降低真实耦合。通过同层网关集中转发 [`hasClosestByAttribute`](app/src/protyle/util/hasClosest.ts:73)，可以把父级 util 路径依赖限制在单点。
 */
import { hasClosestByAttribute } from "../../util/hasClosest";
/**
 * 用途：引入块级 HTML 更新事务函数，供列表执行器在任务勾选场景提交更新后的列表项 HTML。
 * 使用范围：仅用于 [`executors.ts`](app/src/protyle/wysiwyg/keydown.list/executors.ts) 的任务状态切换流程；边界是不在本文件内承担批量事务编排，也不负责列表类型转换。
 * 解耦评估：理论上可把 [`updateTransaction()`](app/src/protyle/transaction.ts:382) 作为参数注入执行器，但当前执行器由静态映射表直接调度，若改成注入会把事务依赖继续扩散到命令分发层与装配层；事件发射也不适合这种需要立即提交事务的同步调用。经由同层网关转发该事务接口，比业务文件直接依赖父级路径更低耦合。
 */
import {updateTransaction} from "../transaction/update";
/**
 * 用途：引入列表缩出业务函数，供当前目录执行器在列表缩出命令中复用既有列表结构调整实现。
 * 使用范围：仅用于 [`executors.ts`](app/src/protyle/wysiwyg/keydown.list/executors.ts) 的缩出执行流程；边界是不在本文件内决定命令触发条件，也不负责日志记录。
 * 解耦评估：理论上可把 [`listOutdent()`](app/src/protyle/wysiwyg/list.ts:65) 作为参数注入执行器，但缩出逻辑本身就是列表编辑域的稳定底层动作，改为透传只会增加映射表与测试装配样板，不会减少真实耦合。通过 imports 网关集中暴露该能力，能把父级模块路径依赖限制在单点。
 */
import { listOutdent, toggleTaskListItem } from "../list";
/**
 * 用途：引入列表缩进业务函数，供当前目录执行器在列表缩进命令中复用既有列表结构调整实现。
 * 使用范围：仅用于 [`executors.ts`](app/src/protyle/wysiwyg/keydown.list/executors.ts) 的缩进执行流程；边界是不在本文件内承担命令路由判断、多选筛选或日志格式化。
 * 解耦评估：与 [`listOutdent()`](app/src/protyle/wysiwyg/list.ts:65) 相同，[`listIndent()`](app/src/protyle/wysiwyg/list.ts:514) 属于列表编辑域的稳定底层动作；若改成参数注入，调用方仍需理解相同列表编辑契约，只会增加样板并扩散耦合。继续通过同层网关统一转发，是现有架构下更低耦合的方案。
 */
import { listIndent } from "../list";
/**
 * 用途：引入 Arktype 的运行时 schema 构造函数，供当前列表键盘模块的类型定义文件构建状态 schema。
 * 使用范围：仅用于 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts) 这类同目录类型定义文件在声明 [`UnifiedListStateSchema`](app/src/protyle/wysiwyg/keydown.list/types.ts:66)、[`CheckToggleStateSchema`](app/src/protyle/wysiwyg/keydown.list/types.ts:148)、[`OutdentStateSchema`](app/src/protyle/wysiwyg/keydown.list/types.ts:175)、[`IndentStateSchema`](app/src/protyle/wysiwyg/keydown.list/types.ts:211) 与 [`TransformStateSchema`](app/src/protyle/wysiwyg/keydown.list/types.ts:251) 时复用；边界是不在本文件封装新的 schema DSL，也不承担任何路由判断或状态提取逻辑。
 * 解耦评估：理论上可把 schema 结果直接内联为普通 TypeScript 类型，或把 schema 从外部工厂传入；但当前这些状态既需要编译期类型推断，也需要 Arktype 提供的运行时声明能力，简单参数传递无法替代其静态定义角色。通过本同层网关集中转发第三方 DSL，比让多个业务/类型文件直接耦合外部包路径更低耦合。
 */
import { type } from "arktype";
/**
 * 用途：引入 Arktype 的 schema 类型接口，供当前列表键盘模块在声明状态 schema 常量时约束其推断结果。
 * 使用范围：仅用于 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts) 中各状态 schema 常量的泛型标注；边界是只参与编译期类型约束，不引入新的运行时行为。
 * 解耦评估：这是编译期类型契约，无法通过事件发射替代。若在 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts) 内直接依赖第三方类型导出，会把外部包路径耦合扩散到业务目录中的多个文件；继续通过本 imports 网关集中转发，仍是当前目录层级下更低耦合的方案。
 */
import type { Type } from "arktype";
import {zodState} from "calibur-router/zod";
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
 * 用途：引入 Day.js 日期工厂函数，供当前列表键盘模块在任务状态切换等场景生成统一格式的更新时间戳。
 * 使用范围：仅通过本 imports 网关转发给 [`executors.ts`](app/src/protyle/wysiwyg/keydown.list/executors.ts) 等同目录业务文件；边界是不在本文件内封装日期格式化策略或扩展插件注册逻辑。
 * 解耦评估：理论上可让各业务文件直接从 `dayjs` 包导入，但当前目录已经通过同层网关集中收敛第三方与父级依赖；继续在这里单点转发可以把外部包路径耦合限制在一个文件内，也避免重复出现不兼容的命名空间导入写法。
 */
import dayjs from "dayjs";

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
/**
 * 用途：对外暴露段落/批量列表转换事务函数，供列表转换辅助流程复用既有事务提交能力。
 */
export { turnsIntoOneTransaction };
/**
 * 用途：对外暴露单节点列表互转事务函数，供列表转换辅助流程复用既有互转事务能力。
 */
export { turnsOneInto };
/**
 * 用途：对外暴露祖先节点属性匹配工具，供列表执行器与状态提取流程复用统一的任务列表项定位逻辑。
 */
export { hasClosestByAttribute };
/**
 * 用途：对外暴露块级 HTML 更新事务函数，供列表执行器在任务勾选流程提交单节点更新事务。
 */
export { updateTransaction };
/**
 * 用途：对外暴露列表缩出业务函数，供列表执行器复用既有缩出实现。
 */
export { listOutdent };
/**
 * 用途：对外暴露任务列表状态切换业务函数，供列表执行器复用点击与快捷键一致的勾选逻辑。
 */
export { toggleTaskListItem };
/**
 * 用途：对外暴露列表缩进业务函数，供列表执行器复用既有缩进实现。
 */
export { listIndent };
/**
 * 用途：对外暴露 Arktype schema 构造函数，供同目录类型定义文件声明运行时 schema。
 */
export { type };
/**
 * 用途：对外暴露 Day.js 日期工厂函数，供列表执行器生成更新时间戳等统一日期格式。
 */
export { dayjs };
/**
 * 用途：对外暴露 Arktype schema 类型接口，供同目录类型定义文件进行编译期泛型约束。
 */
export type { Type };
/**
 * 用途：声明统一列表路由的 Zod 形式化状态空间。
 */
export {zodState};
