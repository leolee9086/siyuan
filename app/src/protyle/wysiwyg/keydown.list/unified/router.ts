/**
 * 统一列表主路由器
 *
 * 本文件实现了列表操作的主路由器和基础子路由器
 * 使用 .split() + 子分发器模式，根据快捷键类型委托给对应的子路由器
 *
 * @see docs/ttt/键盘事件处理重构-列表归并设计.md
 */

/**
 * 用途：复用 unified 目录同层转发的声明式路由构建器，用于定义当前文件内的静态子路由器和主路由器。
 * 使用范围：仅用于当前 router 模块的路由声明阶段；边界是不参与状态提取、命令执行或中间件编排。
 * 解耦评估：理论上可以把路由构建器或已构建好的路由实例通过工厂参数注入，但当前 unified 列表路由与 middleware 的调用方式都围绕静态常量路由器展开，强行改为注入会把装配逻辑扩散到入口链路。继续经由同层 ./imports.ts 收敛第三方依赖，是现有架构下更低耦合的方案。
 */
import {zodCalibur, zodState} from "./imports";
/**
 * 用途：复用 unified 目录同层转发的列表命令常量，作为各路由分支的返回值，保证路由结果与执行层共享同一命令契约。
 * 使用范围：仅用于当前 router 模块各个子路由器和主路由器的命令返回；边界是不承担命令执行、副作用处理或状态收集逻辑。
 * 解耦评估：命令常量属于跨模块共享契约，理论上可通过把命令表注入路由工厂或改为返回更抽象的事件对象来弱化直接依赖，但那会同步扩大执行器、中间件和测试调用面的改动。当前经由同层 ./imports.ts 收敛父级路径依赖，是更低耦合的选择。
 */
import { LIST_COMMANDS } from "./imports";
/**
 * 用途：引入统一列表状态 Schema，作为 listMasterRouter 的 universe 输入约束，确保主路由器与 extractUnifiedListState 产出的状态结构保持一致。
 * 使用范围：仅用于当前 router 模块中主路由器的 zodCalibur.universe() 声明阶段；边界是这里只消费 schema 做路由输入建模，不负责状态提取、命令执行，也不向 router.transform 反向传递实现细节。
 * 解耦评估：理论上可由外部把 schema 作为参数注入路由工厂，或在状态提取层返回后跳过 schema 直接依赖隐式对象结构；但当前 listMasterRouter 被设计为静态常量路由器，且 UnifiedListStateSchema 同时承载运行时 universe 约束与编译期类型来源。若改成依赖注入，需要把主路由器改造成工厂并把装配责任扩散到 middleware 等调用链；若仅靠参数传递或事件发射，也无法替代 calibur 在路由定义阶段对 schema 常量的直接依赖。因此这里保留对上层共享类型文件的静态依赖，是结合当前静态路由架构后的真实最小耦合方案。
 */
import { UnifiedListStateSchema } from "./imports";
/**
 * 用途：引入统一列表状态类型，为主路由各分支回调的 state 参数提供编译期约束。
 * 使用范围：仅用于当前 router 模块的 TypeScript 类型标注；边界是不生成运行时代码，也不参与状态提取和命令执行。
 * 解耦评估：类型理论上可以在每个回调处以内联结构重复声明，或改由泛型从 schema 间接推断，但这会重复状态契约并提高维护成本。当前直接从上层共享类型文件引入共享类型，不产生运行时耦合，已是准确且低成本的解耦方式。
 */
import type { UnifiedListState } from "./imports";
/**
 * 用途：引入列表类型转换子路由器，供 listMasterRouter 在 list/oList/check/quote 快捷键命中时委托转换决策。
 * 使用范围：仅用于当前 router 模块主路由器的 transform 分支；边界是不承担基础缩进/勾选子路由逻辑，也不参与具体命令执行。
 * 解耦评估：理论上可以把转换子路由器以参数方式传入主路由器工厂，但当前主路由器与子路由器同属 unified 静态路由定义的一部分，拆成工厂注入只会增加装配样板并扩大测试初始化成本。维持对同层 router.transform 的稳定静态依赖，更符合当前模块边界。
 */
import { transformSubRouter } from "./router.transform";

// ============================================================================
// 基础子路由器定义
// ============================================================================

/**
 * 任务列表切换子路由器
 *
 * 前置条件：hotkeys.checkToggle = true
 * 决策逻辑：
 * - 在任务列表项中 -> CHECK_TOGGLE
 * - 否则 -> IGNORE
 */
const checkToggleSubRouter = zodCalibur
    .universe(zodState.object({
        context: zodState.object({
            hasTaskItem: zodState.boolean(),
        }),
    }))
    .split(
        zodState.object({
            context: zodState.object({hasTaskItem: zodState.literal(false)}),
        }),
        () => LIST_COMMANDS.IGNORE
    )
    .remain(() => LIST_COMMANDS.CHECK_TOGGLE)
    .build();

/**
 * 列表缩出子路由器
 *
 * 前置条件：hotkeys.outdent = true
 * 决策逻辑：
 * - 有多选 + 不连续 -> IGNORE
 * - 有多选 + 连续 + 第一个不在列表 -> IGNORE
 * - 有多选 + 连续 + 第一个在列表 -> OUTDENT
 * - 无多选 + 在代码块 -> IGNORE
 * - 无多选 + 不在列表项 -> IGNORE
 * - 无多选 + 在列表项 -> OUTDENT
 */
const outdentSubRouter = zodCalibur
    .universe(zodState.object({
        selection: zodState.object({
            hasMultiple: zodState.boolean(),
            isContinuous: zodState.boolean(),
            firstInList: zodState.boolean(),
        }),
        context: zodState.object({
            inListItem: zodState.boolean(),
            inCodeBlock: zodState.boolean(),
        }),
    }))
    // 有多选但不连续
    .split(
        zodState.object({
            selection: zodState.object({
                hasMultiple: zodState.literal(true),
                isContinuous: zodState.literal(false),
            }),
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 有多选且连续但第一个不在列表
    .split(
        zodState.object({
            selection: zodState.object({
                hasMultiple: zodState.literal(true),
                isContinuous: zodState.literal(true),
                firstInList: zodState.literal(false),
            }),
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 有多选且连续且第一个在列表
    .split(
        zodState.object({
            selection: zodState.object({
                hasMultiple: zodState.literal(true),
                isContinuous: zodState.literal(true),
                firstInList: zodState.literal(true),
            }),
        }),
        () => LIST_COMMANDS.OUTDENT
    )
    // 无多选但在代码块
    .split(
        zodState.object({
            selection: zodState.object({hasMultiple: zodState.literal(false)}),
            context: zodState.object({inCodeBlock: zodState.literal(true)}),
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 无多选且不在列表项
    .split(
        zodState.object({
            selection: zodState.object({hasMultiple: zodState.literal(false)}),
            context: zodState.object({
                inCodeBlock: zodState.literal(false),
                inListItem: zodState.literal(false),
            }),
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 无多选且在列表项
    .remain(() => LIST_COMMANDS.OUTDENT)
    .build();

/**
 * 列表缩进子路由器
 *
 * 前置条件：hotkeys.indent = true
 * 决策逻辑：与 outdent 类似
 */
const indentSubRouter = zodCalibur
    .universe(zodState.object({
        selection: zodState.object({
            hasMultiple: zodState.boolean(),
            isContinuous: zodState.boolean(),
            firstInList: zodState.boolean(),
        }),
        context: zodState.object({
            inListItem: zodState.boolean(),
            inCodeBlock: zodState.boolean(),
        }),
    }))
    // 有多选但不连续
    .split(
        zodState.object({
            selection: zodState.object({
                hasMultiple: zodState.literal(true),
                isContinuous: zodState.literal(false),
            }),
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 有多选且连续但第一个不在列表
    .split(
        zodState.object({
            selection: zodState.object({
                hasMultiple: zodState.literal(true),
                isContinuous: zodState.literal(true),
                firstInList: zodState.literal(false),
            }),
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 有多选且连续且第一个在列表
    .split(
        zodState.object({
            selection: zodState.object({
                hasMultiple: zodState.literal(true),
                isContinuous: zodState.literal(true),
                firstInList: zodState.literal(true),
            }),
        }),
        () => LIST_COMMANDS.INDENT
    )
    // 无多选但在代码块
    .split(
        zodState.object({
            selection: zodState.object({hasMultiple: zodState.literal(false)}),
            context: zodState.object({inCodeBlock: zodState.literal(true)}),
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 无多选且不在列表项
    .split(
        zodState.object({
            selection: zodState.object({hasMultiple: zodState.literal(false)}),
            context: zodState.object({
                inCodeBlock: zodState.literal(false),
                inListItem: zodState.literal(false),
            }),
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // 无多选且在列表项
    .remain(() => LIST_COMMANDS.INDENT)
    .build();

// ============================================================================
// 主路由器定义
// ============================================================================

/**
 * 列表主路由器
 *
 * 使用 .split() + 子分发器模式
 * 根据快捷键类型委托给对应的子路由器
 *
 * 路由决策流程：
 * 1. 快速路径：所有快捷键为 false 时返回 IGNORE
 * 2. checkToggle 快捷键 -> checkToggleSubRouter
 * 3. outdent 快捷键 -> outdentSubRouter
 * 4. indent 快捷键 -> indentSubRouter
 * 5. transform 快捷键 -> transformSubRouter
 */
export const listMasterRouter = zodCalibur
    .universe(UnifiedListStateSchema)
    // 快速路径：没有按下任何列表相关快捷键
    .split(
        zodState.object({
            hotkeys: zodState.object({
                checkToggle: zodState.literal(false),
                outdent: zodState.literal(false),
                indent: zodState.literal(false),
                list: zodState.literal(false),
                oList: zodState.literal(false),
                check: zodState.literal(false),
                quote: zodState.literal(false),
            }),
        }),
        () => LIST_COMMANDS.IGNORE
    )
    // CheckToggle 快捷键 - 委托给子路由器
    .split(
        zodState.object({
            hotkeys: zodState.object({
                checkToggle: zodState.literal(true),
                outdent: zodState.literal(false),
                indent: zodState.literal(false),
                list: zodState.literal(false),
                oList: zodState.literal(false),
                check: zodState.literal(false),
                quote: zodState.literal(false),
            }),
        }),
        (state: UnifiedListState) => checkToggleSubRouter({ context: state.context })
    )
    // Outdent 快捷键 - 委托给子路由器
    .split(
        zodState.object({
            hotkeys: zodState.object({
                checkToggle: zodState.literal(false),
                outdent: zodState.literal(true),
                indent: zodState.literal(false),
                list: zodState.literal(false),
                oList: zodState.literal(false),
                check: zodState.literal(false),
                quote: zodState.literal(false),
            }),
        }),
        (state: UnifiedListState) => outdentSubRouter({
            selection: state.selection,
            context: state.context
        })
    )
    // Indent 快捷键 - 委托给子路由器
    .split(
        zodState.object({
            hotkeys: zodState.object({
                checkToggle: zodState.literal(false),
                outdent: zodState.literal(false),
                indent: zodState.literal(true),
                list: zodState.literal(false),
                oList: zodState.literal(false),
                check: zodState.literal(false),
                quote: zodState.literal(false),
            }),
        }),
        (state: UnifiedListState) => indentSubRouter({
            selection: state.selection,
            context: state.context
        })
    )
    // Transform 快捷键（list/oList/check/quote 任一为 true）
    .remain((state: UnifiedListState) => transformSubRouter({
        hotkeys: state.hotkeys,
        selection: state.selection,
        context: state.context
    }))
    .build();

// ============================================================================
// 导出子路由器（供测试使用）
// ============================================================================

/**
 * 用途：对外暴露基础子路由器，供 unified 列表模块的测试与调试流程直接验证各分支决策结果。
 * 边界：这里只公开静态路由实例，不额外封装执行逻辑或状态提取流程。
 */
export {
    checkToggleSubRouter,
    outdentSubRouter,
    indentSubRouter,
    transformSubRouter
};
