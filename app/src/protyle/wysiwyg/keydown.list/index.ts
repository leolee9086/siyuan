/**
 * 统一列表模块入口
 *
 * 这里只保留对外真正需要的统一列表能力与核心状态类型。
 * 路由器、命令常量、日志工具等调试/内部实现细节请从各自源文件直接导入。
 */

/**
 * 用途：引入统一列表中间件，作为当前顶层入口唯一保留的运行时能力。
 * 使用范围：仅用于当前 [`index.ts`](app/src/protyle/wysiwyg/keydown.list/index.ts) 对外暴露统一列表键盘处理入口；边界是不在这里继续公开路由器、日志工具或命令表等内部实现细节。
 * 解耦评估：`listUnifiedMiddleware` 本身就是列表键盘模块的稳定公共契约。若改为依赖注入、参数透传或事件发射，只会把原本清晰的入口职责转移到调用方，扩大装配面，而不会减少真实业务耦合；因此这里直接依赖声明源文件更清晰。
 */
import { listUnifiedMiddleware } from "./unified/middleware";
/**
 * 用途：引入统一列表上下文状态类型，供当前入口对外暴露精简后的核心状态契约。
 * 使用范围：仅用于当前 [`index.ts`](app/src/protyle/wysiwyg/keydown.list/index.ts) 的类型导出；边界是不在入口层重新定义状态结构，也不把 phase 级内部状态继续向外扩散。
 * 解耦评估：这是纯编译期契约，运行时不存在可通过事件发射替代的对象。若在入口层重复声明结构，会制造类型分叉；若完全不导出，则调用方需要绕过入口直接依赖深层类型文件。继续从单一类型源直接引入是当前更低耦合的做法。
 */
import type { ContextState } from "./types";
/**
 * 用途：引入统一列表快捷键状态类型，供当前入口对外暴露与统一中间件配套的核心状态切片。
 * 使用范围：仅用于当前 [`index.ts`](app/src/protyle/wysiwyg/keydown.list/index.ts) 的类型导出；边界是不承担快捷键状态提取实现，也不导出路由内部专用类型。
 * 解耦评估：这是纯类型契约，无法通过注入或事件机制降低耦合。保持从 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts) 的单一来源导入，可避免入口层复制联合结构或让调用方直接耦合更深的实现文件。
 */
import type { HotkeysState } from "./types";
/**
 * 用途：引入统一列表选区状态类型，供当前入口保留外部可能需要的核心选区状态契约。
 * 使用范围：仅用于当前 [`index.ts`](app/src/protyle/wysiwyg/keydown.list/index.ts) 的类型导出；边界是不在入口层参与选区状态计算，也不继续暴露测试用路由器结构。
 * 解耦评估：这同样是编译期类型，无法通过运行时解耦手段替代。继续从共享类型源导入，比在入口层重写结构或要求调用方深入统一实现目录导入更低耦合。
 */
import type { SelectionState } from "./types";
/**
 * 用途：引入统一列表完整状态类型，供当前入口保留与统一中间件直接对应的核心公共类型。
 * 使用范围：仅用于当前 [`index.ts`](app/src/protyle/wysiwyg/keydown.list/index.ts) 的类型导出；边界是不继续经由顶层入口公开命令执行器、日志参数或 phase 级状态类型。
 * 解耦评估：`UnifiedListState` 是当前统一列表路由与中间件共享的单一状态契约。若在入口层重新组装或复制，会造成类型源分裂；继续直接依赖 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts) 是更稳妥的低耦合方案。
 */
import type { UnifiedListState } from "./types";

/**
 * 用途：对外暴露统一列表中间件，作为 `keydown.list` 顶层入口保留的唯一运行时 API。
 * 边界：这里只公开统一入口，不再从该文件转发路由器、日志工具与命令常量。
 */
export { listUnifiedMiddleware };

/**
 * 用途：对外暴露统一列表中间件配套的核心状态类型，供调用方在不深入内部目录的情况下复用公共契约。
 * 边界：这里只保留 unified 主状态及其三个核心切片，不再继续暴露 phase 级状态、执行器接口和 logger 相关类型。
 */
export type {
    ContextState,
    HotkeysState,
    SelectionState,
    UnifiedListState,
};
