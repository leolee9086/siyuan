/**
 * 用途：声明窗口级键盘事件在 UI 抢占子集中的 `facts -> command` 路由。
 * 使用范围：仅供 `windowKeyDown/route/index.ts` 汇总各子集命令时调用。
 * 解耦评估：当前文件只根据菜单系统与 AV 面板事实产生命令，不直接调用遗留中间件，从而保持"收集后再路由"的阶段边界。
 */

/**
 * 用途：引入路由 DSL `calibur`，用于声明式地构建键盘事件 facts → command 的路由链。
 * 使用范围：仅在本文件内定义 `routeUIWindowKeyCommand` 路由链时使用。
 * 解耦评估：`calibur` 已通过 `./imports` 集中转发，切换 DSL 实现时仅需修改 `./imports`。
 */
import { calibur } from "./imports";
/**
 * 用途：引入 ArkType 类型推断工具 `type`，用于声明路由输入状态类型和 split 模式匹配条件。
 * 使用范围：仅在当前文件声明 `uiWindowKeyStateRouteInput` 和 split 模式匹配时使用。
 * 解耦评估：`type` 属于编译期类型辅助工具，不参与运行时逻辑，可通过 `./imports` 统一替换类型库。
 */
import { type } from "./imports";
/**
 * 用途：引入 UI 抢占域命令常量集，用于标识从 facts 路由出的具体命令（MENU / AV_PANEL / IGNORE）。
 * 使用范围：仅在当前路由切分链的 split/remain 回调中使用，不暴露至路由外部。
 * 解耦评估：命令常量属于路由契约的一部分，与具体执行逻辑解耦；若需调整常量值，仅修改 `./imports` 引用的 `../commands.types` 即可。
 */
import { UI_WINDOW_KEY_COMMANDS } from "./imports";

const uiWindowKeyStateRouteInput = type({
    ui: {
        menuVisible: "boolean",
        menuHandledKey: "boolean",
        hasModifierKey: "boolean",
        targetInMenuTextInput: "boolean",
        avPanelVisible: "boolean",
        avPanelHandledKey: "boolean",
        avPanelHasRollupSearchMenu: "boolean",
        avPanelHasExistingAssetMenu: "boolean",
    },
});

/**
 * 用途：导出 UI 抢占域路由函数，将 UI facts 路由为稳定命令。
 * 使用范围：供 `route/index.ts` 的 `resolveWindowKeyDownCommands` 调用，作为四域命令汇总的一部分。
 * 解耦评估：route 子路由是路由层的自然分解，本身即结构化解耦；策略化/插件化可进一步解耦，但当前规则有限，引入额外复杂性不值。
 */
export const routeUIWindowKeyCommand = calibur
    .universe(uiWindowKeyStateRouteInput)
    .split(
        type({
            ui: {
                menuVisible: "true",
                menuHandledKey: "true",
                hasModifierKey: "false",
                targetInMenuTextInput: "false",
            },
        }),
        () => UI_WINDOW_KEY_COMMANDS.MENU,
    )
    .split(
        type({
            ui: {
                menuVisible: "false",
                avPanelVisible: "true",
                avPanelHandledKey: "true",
                avPanelHasRollupSearchMenu: "true",
            },
        }),
        () => UI_WINDOW_KEY_COMMANDS.AV_PANEL,
    )
    .split(
        type({
            ui: {
                menuVisible: "false",
                avPanelVisible: "true",
                avPanelHandledKey: "true",
                avPanelHasRollupSearchMenu: "false",
                avPanelHasExistingAssetMenu: "true",
            },
        }),
        () => UI_WINDOW_KEY_COMMANDS.AV_PANEL,
    )
    .remain(() => UI_WINDOW_KEY_COMMANDS.IGNORE)
    .build();
