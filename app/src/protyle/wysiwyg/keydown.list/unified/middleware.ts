/**
 * 统一列表中间件
 *
 * 本文件实现了统一的列表操作中间件
 * 替代原有的 4 个独立中间件：
 * - listCheckToggleMiddleware
 * - listOutdentMiddleware
 * - listIndentMiddleware
 * - listTransformMiddleware
 *
 * @see docs/ttt/键盘事件处理重构-列表归并设计.md
 */

/**
 * 用途：引入统一列表主路由器，根据已提取的完整状态计算当前按键应触发的列表命令。
 * 使用范围：仅用于 [`listUnifiedMiddleware`](app/src/protyle/wysiwyg/keydown.list/unified/middleware.ts:56) 的路由决策阶段；边界是不参与 DOM 状态提取与具体命令执行。
 * 解耦评估：理论上可通过参数传入一个“命令解析函数”来解耦，但当前统一列表中间件是固定签名的键盘事件入口，路由规则又与 [`UnifiedListState`](app/src/protyle/wysiwyg/keydown.list/types.ts:1) 强绑定；若改为外部注入，会把命令空间和规则装配扩散到调用方。保留同层直接依赖是当前最小改动且职责清晰的方案。
 */
import { listMasterRouter } from "./router";
/**
 * 用途：引入统一状态提取函数，在进入路由决策前一次性收集列表操作所需的上下文、快捷键与选区状态。
 * 使用范围：仅用于 [`listUnifiedMiddleware`](app/src/protyle/wysiwyg/keydown.list/unified/middleware.ts:53) 的状态收集阶段；边界是不负责命令选择和命令落地执行。
 * 解耦评估：理论上可由上游先构造完整状态对象再传入中间件，但当前键盘事件调用链直接持有 [`KeyboardEvent`](app/src/protyle/wysiwyg/keydown.list/unified/middleware.ts:46)、[`IProtyle`](app/src/protyle/wysiwyg/keydown.list/unified/middleware.ts:47) 与选区节点，上移状态提取只会把同样的编辑器耦合扩散到更多入口。继续集中在 unified 状态层处理，耦合面更小。
 */
import { extractUnifiedListState } from "./state";
/**
 * 用途：引入统一列表命令执行入口，在主路由器给出命令后复用既有任务切换、缩进和类型转换执行逻辑。
 * 使用范围：仅用于 [`listUnifiedMiddleware`](app/src/protyle/wysiwyg/keydown.list/unified/middleware.ts:60) 的命令下发阶段；边界是不参与状态提取、规则匹配与执行器内部实现。
 * 解耦评估：可通过中间件工厂把执行器注入进来，但当前外部广泛依赖固定签名的 [`listUnifiedMiddleware`](app/src/protyle/wysiwyg/keydown.list/unified/middleware.ts:45)，若引入工厂会扩大入口层改动并增加初始化样板；因此先通过同层 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/unified/imports.ts) 收敛跨目录路径，是更稳妥的低耦合方案。
 */
import { executeCommand } from "./imports";
/**
 * 用途：引入统一列表命令常量，用于判断路由结果是否为忽略命令并维持路由器与执行器共享的命令契约。
 * 使用范围：仅用于 [`listUnifiedMiddleware`](app/src/protyle/wysiwyg/keydown.list/unified/middleware.ts:59) 的忽略分支判断；边界是不承载任何实际业务执行。
 * 解耦评估：命令常量属于跨模块共享契约，理论上可把 `IGNORE` 判断封装到路由器返回结构中，但那会同步修改路由器、类型和执行入口；当前经由同层网关读取共享常量，已经是在不引入新抽象的前提下较小的耦合面。
 */
import { LIST_COMMANDS } from "./imports";

/**
 * 统一列表中间件
 *
 * 用途：处理所有列表相关的键盘操作
 * 使用场景：在键盘事件处理流程中调用，替代原有 4 个独立中间件
 *
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @param range - 当前选区对象
 * @param controller - 中止控制器，用于终止后续处理
 *
 * 执行流程：
 * 1. 提取统一状态：调用 extractUnifiedListState 一次性获取所有决策所需状态
 * 2. 路由决策：调用 listMasterRouter 根据状态决定命令
 * 3. 执行命令：如果命令不是 IGNORE，则调用 executeCommand 执行
 *
 * 优势：
 * - 单次状态提取，避免重复计算
 * - 统一入口，简化调用方代码
 * - 快速路径优化，大多数按键事件能快速返回
 */
export const listUnifiedMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 步骤 1: 提取统一状态
    const state = extractUnifiedListState(event, protyle, nodeElement, range);

    // 步骤 2: 路由决策
    const command = listMasterRouter(state);

    // 步骤 3: 执行命令
    if (command !== LIST_COMMANDS.IGNORE) {
        await executeCommand(command, event, protyle, nodeElement, range, controller, state);
    }
};
