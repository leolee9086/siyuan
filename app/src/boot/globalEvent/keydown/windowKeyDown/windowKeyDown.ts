/**
 * 用途：作为窗口级键盘事件的统一入口，按“前置短路 -> 状态收集 -> 路由导航 -> 子集处理”编排整个处理流程。
 * 使用范围：供 `globalEvent/event.ts` 绑定 `window.addEventListener("keydown")` 时调用。
 * 解耦评估：当前文件只保留流程编排与对外兼容导出，不再承载任何领域事实判断或命令分发细节。
 */

/**
 * 用途：引入应用实例类型，标注窗口级键盘事件入口的应用上下文。
 * 使用范围：仅用于当前文件导出函数 `windowKeyDown()` 的入参类型约束。
 * 解耦评估：这是纯编译期契约，不形成运行时耦合；继续通过根层 `imports.ts` 复用即可。
 */
import type { AppFacade } from "./imports";
/**
 * 用途：引入窗口级全局快捷键过滤中间件。
 * 使用范围：仅用于当前入口在统一状态收集前执行既有前置短路。
 * 解耦评估：这是稳定的历史中间件契约，继续直接复用比把短路逻辑再内联回入口更低耦合。
 */
import { filterHotkey } from "./imports";
/**
 * 用途：引入搜索键盘处理中间件。
 * 使用范围：仅用于当前入口在进入状态收集前保留既有搜索抢占行为。
 * 解耦评估：这是稳定的历史中间件契约，继续直接复用即可，没必要为了目录重排重写这段抢占逻辑。
 */
import { searchKeydown } from "./imports";
/**
 * 用途：引入全局快捷键同步函数。
 * 使用范围：仅用于当前文件对外维持既有导出路径兼容。
 * 解耦评估：快捷键同步属于基础设施能力，入口文件只做转发导出即可，不需要额外包装层。
 */
import { sendGlobalShortcut } from "./sendGlobalShortcut";
/**
 * 用途：引入窗口级键盘事件的统一路由阶段入口。
 * 使用范围：仅用于当前文件在状态收集完成后产出目标子集与子集命令。
 * 解耦评估：入口只依赖阶段级公开接口，不直接触碰子路由细节，比在本文件继续堆叠路由 DSL 更低耦合。
 */
import { routeWindowKeyDown } from "./route";
/**
 * 用途：引入窗口级键盘事件的统一状态收集器。
 * 使用范围：仅用于当前文件在进入路由阶段前一次性收集全部显式事实。
 * 解耦评估：把事实收集收敛到独立阶段后，入口不再维护领域级 DOM/环境读取细节，耦合面更小。
 */
import { collectWindowKeyDownState } from "./state";
/**
 * 用途：引入窗口级键盘事件的统一子集处理入口。
 * 使用范围：仅用于当前文件在根路由选出目标子集后执行最终叶子动作。
 * 解耦评估：入口只依赖阶段级公开接口，不直接耦合对话框、系统和导航的叶子执行细节。
 */
import { executeWindowKeyDownSubset } from "./subset";

/** 导出全局快捷键同步函数，供既有调用方继续沿用当前导入路径。 */
export { sendGlobalShortcut };

/**
 * 作用：处理窗口级 `keydown` 事件，并按“前置短路 -> 状态收集 -> 路由导航 -> 子集处理”的顺序执行。
 * 意图：让入口只保留流程编排职责，不再承担领域级事实判断或命令分发细节。
 * 调用时机：由 `globalEvent/event.ts` 在浏览器窗口绑定 `keydown` 事件后调用。
 * 问题/改进：当前仍保留全局过滤器与搜索中间件作为状态收集前置短路；若后续也要完全状态化，可继续外移到更统一的阶段边界。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const windowKeyDown = (app: AppFacade, event: KeyboardEvent) => {
    // 场景：全局快捷键过滤命中时，需要沿用历史行为立即终止窗口级处理链。
    if (filterHotkey(event, app)) {
        return;
    }

    // 场景：搜索中间件会抢占当前按键；命中后必须沿用旧行为立即阻止默认事件和冒泡。
    if (searchKeydown(app, event)) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    const state = collectWindowKeyDownState(app, event);
    const routed = routeWindowKeyDown(state);
    void executeWindowKeyDownSubset(routed.domain, routed.resolvedCommands, state);
};
