/**
 * 用途：汇总窗口级键盘事件的子集命令，并在根层按优先级路由到目标子集。
 * 使用范围：仅供 `windowKeyDown.ts` 在统一状态收集完成后调用。
 * 解耦评估：当前文件只做命令汇总与根域优先级路由，不负责任何叶子处理，因此保持了“路由导航”作为中间阶段的纯度。
 */

/**
 * 用途：引入路由 DSL 库 calibur-router，以声明式状态空间分割构建路由链。
 * 使用范围：本文件中用于构造 dialog/ui/system/navigation 四域优先级路由。
 * 解耦评估：calibur-router 是路由层的核心 DSL，消费端固定；解耦需整体替换路由范式，非单点可解。
 */
import { calibur } from "./imports";
/**
 * 用途：引入 arktype 类型工厂，在路由 split 规则中定义状态空间切片模式。
 * 使用范围：本文件中用于定义各路由节点的输入约束 schema。
 * 解耦评估：type() 仅在路由定义期使用，运行期零成本；可通过外部 schema 常量间接解耦，但当前未形成瓶颈。
 */
import { type } from "./imports";
/**
 * 用途：引入对话框域命令常量，用于在根层路由中判断 resolvedCommands 是否命中 dialog 域。
 * 使用范围：本文件中用于比较 `resolvedCommands.dialogCommand !== DIALOG_WINDOW_KEY_COMMANDS.IGNORE` 以决定路由域。
 * 解耦评估：命令常量是路由层与执行器层的共享契约；当前通过 barrel 单点引入保持类型安全，未重复硬编码字符串值。
 */
import { DIALOG_WINDOW_KEY_COMMANDS } from "./imports";
/**
 * 用途：引入系统域命令常量，用于在根层路由中判断 resolvedCommands 是否命中 system 域。
 * 使用范围：本文件中用于比较 `resolvedCommands.systemCommand !== SYSTEM_WINDOW_KEY_COMMANDS.IGNORE` 以决定路由域。
 * 解耦评估：命令常量是路由层与执行器层的共享契约；当前通过 barrel 单点引入保持类型安全，未重复硬编码字符串值。
 */
import { SYSTEM_WINDOW_KEY_COMMANDS } from "./imports";
/**
 * 用途：引入 UI 抢占域命令常量，用于在根层路由中判断 resolvedCommands 是否命中 UI 域。
 * 使用范围：本文件中用于比较 `resolvedCommands.uiCommand !== UI_WINDOW_KEY_COMMANDS.IGNORE` 以决定路由域。
 * 解耦评估：命令常量是路由层与执行器层的共享契约；当前通过 barrel 单点引入保持类型安全，未重复硬编码字符串值。
 */
import { UI_WINDOW_KEY_COMMANDS } from "./imports";
/**
 * 用途：引入对话框命令路由函数，将 dialog facts 路由为稳定命令。
 * 使用范围：本文件 `resolveWindowKeyDownCommands` 中调用，作为四域命令汇总的一部分。
 * 解耦评估：route 子路由是路由层的自然分解，本身即结构化解耦；策略化/插件化可进一步解耦，但当前规则有限，引入额外复杂性不值。
 */
import { routeDialogWindowKeyCommand } from "./dialog";
/**
 * 用途：引入导航命令路由函数，将 navigation facts 路由为稳定命令。
 * 使用范围：本文件 `resolveWindowKeyDownCommands` 中调用，作为四域命令汇总的一部分。
 * 解耦评估：同 dialog 子路由，route 内分解是自然的结构化解耦方式。
 */
import { routeNavigationWindowKeyCommand } from "./navigation";
/**
 * 用途：引入系统命令路由函数，将 system facts 路由为稳定命令。
 * 使用范围：本文件 `resolveWindowKeyDownCommands` 中调用，作为四域命令汇总的一部分。
 * 解耦评估：同 dialog 子路由，route 内分解是自然的结构化解耦方式。
 */
import { routeSystemWindowKeyCommand } from "./system";
/**
 * 用途：引入 UI 命令路由函数，将 UI facts 路由为稳定命令。
 * 使用范围：本文件 `resolveWindowKeyDownCommands` 中调用，作为四域命令汇总的一部分。
 * 解耦评估：同 dialog 子路由，route 内分解是自然的结构化解耦方式。
 */
import { routeUIWindowKeyCommand } from "./ui";
/**
 * 用途：引入统一状态类型，标注命令解析与根路由函数的入参类型。
 * 使用范围：仅用于 `resolveWindowKeyDownCommands` 与 `routeWindowKeyDown` 的参数类型注解。
 * 解耦评估：纯类型依赖，不形成运行时耦合；继续经由同层 barrel 网关复用即可。
 */
import type { WindowKeyDownState } from "./imports";
/**
 * 用途：引入路由解析后返回的稳定命令集合类型，标注命令汇总结果的类型契约。
 * 使用范围：仅用于 `resolveWindowKeyDownCommands` 返回值的 `satisfies` 类型校验。
 * 解耦评估：纯类型依赖，不形成运行时耦合；继续经由同层 barrel 网关复用即可。
 */
import type { WindowKeyDownResolvedCommands } from "./imports";

/**
 * 用途：定义窗口级键盘事件的根级路由域枚举，用于在 calibur 路由链中标记优先级目标。
 * 使用范围：仅供本文件的 calibur 路由 split/remain 分支作为返回值。
 * 解耦评估：枚举值是路由 DSL 的必备契约，与 route/ 目录紧密耦合；若路由域增加需同步扩展。
 */
export const WINDOW_KEY_DOWN_ROUTE_DOMAINS = {
    DIALOG: "dialog",
    UI: "ui",
    SYSTEM: "system",
    NAVIGATION: "navigation",
} as const;

const windowKeyDownDomainRouteInput = type({
    hasDialogCommand: "boolean",
    hasUICommand: "boolean",
    hasSystemCommand: "boolean",
});

const systemOrNavigationWindowKeyDomainRouter = calibur
    .universe(windowKeyDownDomainRouteInput)
    .split(type({ hasSystemCommand: "true" }), () => WINDOW_KEY_DOWN_ROUTE_DOMAINS.SYSTEM)
    .remain(() => WINDOW_KEY_DOWN_ROUTE_DOMAINS.NAVIGATION)
    .build();

const uiOrSystemOrNavigationWindowKeyDomainRouter = calibur
    .universe(windowKeyDownDomainRouteInput)
    .split(type({ hasUICommand: "true" }), () => WINDOW_KEY_DOWN_ROUTE_DOMAINS.UI)
    .remain(state => systemOrNavigationWindowKeyDomainRouter(state))
    .build();

/**
 * 用途：构建根级路由链，按 dialog > ui > system/navigation 优先级将统一状态空间分割到目标域。
 * 使用范围：仅供 `windowKeyDown.ts` 在统一状态收集完成后调用，获取目标路由域。
 */
export const routeWindowKeyDownDomain = calibur
    .universe(windowKeyDownDomainRouteInput)
    .split(type({ hasDialogCommand: "true" }), () => WINDOW_KEY_DOWN_ROUTE_DOMAINS.DIALOG)
    .remain(state => uiOrSystemOrNavigationWindowKeyDomainRouter(state))
    .build();

/**
 * 用途：汇总四个子域（dialog/ui/system/navigation）的独立命令路由结果，构成统一命令集合。
 * 意图：避免根入口层同时关注四域路由细节，将汇总职责收敛到单点。
 * 调用时机：由 `routeWindowKeyDown` 在每次按键事件处理中调用。
 * 问题/改进：若未来新增窗口级子域，需要同步扩展此处的命令汇总。
 * @同步豁免: 性能考虑 — 本函数在键盘事件热路径上被调用，每次按键响应都需要同步计算路由域；引入 async 会增加微任务调度的额外延迟，而函数内部仅为同步的纯计算（facts 比较与命令选择），无任何 I/O 或异步等待点。
 */
export const resolveWindowKeyDownCommands = (state: WindowKeyDownState) => ({
    dialogCommand: routeDialogWindowKeyCommand(state),
    uiCommand: routeUIWindowKeyCommand(state),
    systemCommand: routeSystemWindowKeyCommand(state),
    navigationCommand: routeNavigationWindowKeyCommand(state),
} satisfies WindowKeyDownResolvedCommands);

/**
 * 用途：窗口级键盘事件的根入口路由函数，先汇总四域命令，再按优先级路由到目标域。
 * 意图：将"命令收集"与"域路由"两个步骤组合为单一入口，供入口执行器一次调用完成路由。
 * 调用时机：由 `windowKeyDown.ts` 在统一状态收集完成后调用。
 * 问题/改进：当前返回值同时携带 resolvedCommands 与 domain，执行器需按 domain 查找对应命令执行；若未来命令与域的映射关系复杂化，可引入专门的执行策略表。
 * @同步豁免: 性能考虑 — 本函数在键盘事件热路径上被调用，内部仅做同步的纯计算聚合（调用四个同步路由函数 + 一次同步路由比较），无任何 I/O 或异步等待点；引入 async 会增加不必要的微任务调度延迟。
 */
export const routeWindowKeyDown = (state: WindowKeyDownState) => {
    const resolvedCommands = resolveWindowKeyDownCommands(state);
    const domain = routeWindowKeyDownDomain({
        hasDialogCommand: resolvedCommands.dialogCommand !== DIALOG_WINDOW_KEY_COMMANDS.IGNORE,
        hasUICommand: resolvedCommands.uiCommand !== UI_WINDOW_KEY_COMMANDS.IGNORE,
        hasSystemCommand: resolvedCommands.systemCommand !== SYSTEM_WINDOW_KEY_COMMANDS.IGNORE,
    });
    return {
        resolvedCommands,
        domain,
    } as const;
};
