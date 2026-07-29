/**
 * 用途：集中转发 unified 列表中间件目录对上层列表命令层的依赖，避免业务文件直接使用父级路径导入。
 * 使用范围：仅供 [`middleware.ts`](app/src/protyle/wysiwyg/keydown.list/unified/middleware.ts) 以及后续位于 [`unified`](app/src/protyle/wysiwyg/keydown.list/unified) 目录内、需要调用命令执行层的文件复用；不对上层目录反向提供业务编排。
 * 解耦评估：当前 unified 目录承担“状态提取 + 路由决策 + 命令下发”的编排职责，仍需依赖列表命令执行器与命令常量这一稳定契约。理论上可以通过中间件工厂、依赖注入或额外参数把执行器传入，但那会把现有键盘事件调用链改造成工厂初始化模式，并把命令分发契约扩散到更多入口文件；在当前架构下先通过同层网关收敛路径耦合，是比直接在业务文件中散落 `../` 导入更低耦合、风险更小的方案。
 */

/**
 * 用途：集中转发第三方声明式路由构建器，使 unified 目录内的路由文件不直接依赖外部包路径。
 * 使用范围：仅供 [`router.ts`](app/src/protyle/wysiwyg/keydown.list/unified/router.ts) 与 [`router.transform.ts`](app/src/protyle/wysiwyg/keydown.list/unified/router.transform.ts) 这类 unified 路由定义文件复用；边界是不在本层封装任何路由规则或运行时行为。
 * 解耦评估：`zodCalibur` 与 `zodState` 是当前路由声明 DSL 的共同入口；本文件只收敛包路径，不包装或削弱状态空间语义。
 */
import {zodCalibur, zodState} from "calibur-router/zod";
/** 导出 Zod 状态空间路由构建器与模式构造器供 unified 路由模块复用。 */
export {zodCalibur, zodState};

/**
 * 用途：转发统一列表状态 schema 常量，供 unified 路由与入口模块在不越级导入的前提下复用上层共享状态契约。
 * 使用范围：仅供 unified 目录内需要消费统一列表 schema 的模块使用；边界是不在本文件重新声明状态结构。
 * 解耦评估：统一列表状态已经收敛到上层 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts:1)；继续通过当前 imports 网关转发，可满足 unified 目录禁止直接父级导入的约束，同时保持契约单源。
 */
import { UnifiedListStateSchema } from "../types";
/** 导出 [`UnifiedListStateSchema`](app/src/protyle/wysiwyg/keydown.list/types.ts:66) 供 unified 目录复用。 */
export { UnifiedListStateSchema };

/**
 * 用途：转发统一列表状态相关类型，供 unified 目录中的路由、状态提取与入口模块共享编译期契约。
 * 使用范围：仅用于 unified 目录内的 type-only 导入；边界是不生成运行时代码，也不在本文件重新声明状态结构。
 * 解耦评估：这些类型已经集中定义在上层 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts:1)；通过当前网关统一转发能同时满足 unified 目录禁止直接父级导入的约束与单一类型源要求，比在各文件重复内联结构或分散父级导入更低耦合。
 */
import type {
    ContextState,
    HotkeysState,
    SelectionState,
    TaskStatusState,
    UnifiedListState
} from "../types";
/** 导出 [`ContextState`](app/src/protyle/wysiwyg/keydown.list/types.ts:140) 供 unified 目录复用。 */
export type { ContextState };
/** 导出 [`HotkeysState`](app/src/protyle/wysiwyg/keydown.list/types.ts:130) 供 unified 目录复用。 */
export type { HotkeysState };
/** 导出 [`SelectionState`](app/src/protyle/wysiwyg/keydown.list/types.ts:135) 供 unified 目录复用。 */
export type { SelectionState };
/** 导出 [`TaskStatusState`](app/src/protyle/wysiwyg/keydown.list/types.ts:61) 供 unified 目录复用。 */
export type { TaskStatusState };
/** 导出 [`UnifiedListState`](app/src/protyle/wysiwyg/keydown.list/types.ts:125) 供 unified 目录复用。 */
export type { UnifiedListState };

/**
 * 用途：执行统一路由器返回的列表命令，并复用既有任务切换、缩进与类型转换执行逻辑。
 * 使用范围：仅用于 unified 目录中的键盘列表处理中间件在路由决策完成后下发命令；边界是不参与状态提取和路由判断本身。
 * 解耦评估：理论上可通过将执行器作为 `createListUnifiedMiddleware()` 的注入参数实现解耦，但当前调用方直接依赖固定签名的 [`listUnifiedMiddleware`](app/src/protyle/wysiwyg/keydown.list/unified/middleware.ts:41)，若强行注入会扩大改动面并增加初始化样板；因此现阶段保留为经由本转发层的稳定运行时依赖更合适。
 */
import { executeCommand } from "../executors";
/** 导出 [`executeCommand`](app/src/protyle/wysiwyg/keydown.list/executors.ts:295) 供 unified 目录复用。 */
export { executeCommand };

/**
 * 用途：提供统一列表命令常量集合，用于判断是否忽略执行以及维持路由器与执行器之间的共享命令契约。
 * 使用范围：仅用于 unified 目录中的路由结果消费逻辑；边界是不承载任何运行时执行行为，仅提供命令标识。
 * 解耦评估：命令常量本质上是跨模块共享契约，理论上可通过布尔谓词或调用方预判替代部分使用，但无法消除路由器与执行器之间对同一命令空间的一致性要求；继续通过本转发层暴露统一契约，比在业务文件中内联字符串或重复定义常量更符合低耦合要求。
 */
import { LIST_COMMANDS } from "../commands";
/** 导出 [`LIST_COMMANDS`](app/src/protyle/wysiwyg/keydown.list/commands.ts:20) 供 unified 目录复用。 */
export { LIST_COMMANDS };

/**
 * 用途：引入快捷键匹配函数，供 unified 列表状态提取把当前键盘事件与用户配置的列表快捷键逐项比对。
 * 使用范围：仅供 unified 目录中的状态提取流程在“读取配置 → 计算 hotkeys 状态”阶段复用；边界是不在本层封装新的快捷键语义，也不承担 DOM 事件监听职责。
 * 解耦评估：理论上可把匹配函数作为参数注入状态提取器，但当前调用链只有 state 模块在同步计算 hotkeys 时直接使用该纯函数；若为此增加参数传递，会把同一稳定工具依赖扩散到中间件与测试装配层，而收益有限。现阶段通过同层网关收敛 util 路径，是比业务文件直接导入父级工具更低耦合的方案；若后续需要替换匹配实现，也只需在本文件调整导出来源。
 */
import { matchHotKey } from "../../../util/hotKey";
/** 导出 [`matchHotKey`](app/src/protyle/util/hotKey.ts:35) 供 unified 状态提取模块复用。 */
export { matchHotKey };

/**
 * 用途：引入基于属性的最近祖先查找函数，供 unified 列表状态提取判断当前选区是否位于任务列表项上下文。
 * 使用范围：仅供 unified 目录中的状态提取流程在“读取当前 DOM/Range 上下文”阶段复用；边界是不在本层负责遍历策略扩展，也不把它暴露为通用业务判定器。
 * 解耦评估：理论上可把“是否命中任务项”结果从更上层预先计算后传入，但那会让中间件额外承担 DOM 上下文推导职责，反而扩大业务边界；事件发射也不适合这种同步、即时、单次查询。当前经由同层 imports 网关转发该通用工具，已经把深层 util 路径耦合限制在单点，优于在多个业务文件中重复直接导入。
 */
import { hasClosestByAttribute } from "../../../util/hasClosest";
/** 导出 [`hasClosestByAttribute`](app/src/protyle/util/hasClosest.ts:73) 供 unified 状态提取模块复用。 */
export { hasClosestByAttribute };

/**
 * 用途：引入思源全局配置读取函数，供 unified 列表状态提取在键盘事件处理中读取用户自定义快捷键映射。
 * 使用范围：仅供 [`state.ts`](app/src/protyle/wysiwyg/keydown.list/unified/state.ts) 这类 unified 状态提取模块在“键盘事件 → 状态收集 → 路由决策”流程中读取只读配置；边界是不在本层缓存配置、不派发配置变更，也不把编辑器业务逻辑反向写入配置系统。
 * 解耦评估：理论上可把配置对象或快捷键映射作为参数从 [`middleware.ts`](app/src/protyle/wysiwyg/keydown.list/unified/middleware.ts) 逐层传入 [`extractUnifiedListState`](app/src/protyle/wysiwyg/keydown.list/unified/state.ts:230)，或通过工厂函数在初始化阶段注入读取器；但当前 unified 调用链是一次性响应键盘事件的静态函数组合，直接参数传递会把配置依赖扩散到中间件、路由入口和测试装配层，增加样板并放大接口耦合。配置变更也并非此流程内的事件源，因此事件发射不能自然替代同步读取。现阶段通过本同层转发文件集中收敛对配置环境模块的依赖，比让业务文件直接耦合深层 util 路径更低耦合，也保留了未来改造成注入式网关时的单点替换位置。
 */
import { getSiyuanConfig } from "../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 [`getSiyuanConfig`](app/src/util/siyuanEnvironments/getSiyuanConfig.environment.ts:35) 供 unified 状态提取模块复用。 */
export { getSiyuanConfig };
