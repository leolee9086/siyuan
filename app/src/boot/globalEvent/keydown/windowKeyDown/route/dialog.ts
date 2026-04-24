/**
 * 用途：声明窗口级键盘事件在对话框子集中的 `facts -> command` 路由。
 * 使用范围：仅供 `windowKeyDown/route/index.ts` 汇总各子集命令时调用。
 * 解耦评估：当前文件只做对话框 facts 到命令的静态切分，不参与任何叶子执行，从而保持路由阶段边界单纯。
 */

/**
 * 用途：导入路由 DSL（calibur），用于组装 facts → command 切分链。
 * 使用范围：仅供当前 `dialog.ts` 路由文件使用，不用于其他子集路由。
 * 解耦评估：calibur 已通过 `./imports` 集中转发，切换 DSL 实现时仅需修改 `./imports`。
 */
import { calibur } from "./imports";
/**
 * 用途：导入对话框窗口键命令常量集，用于标识从 facts 路由出的具体命令。
 * 使用范围：仅在当前路由切分链的 split/remain 回调中使用，不暴露至路由外部。
 * 解耦评估：命令常量属于路由契约的一部分，与具体执行逻辑解耦；若需调整常量值，仅修改 `./imports` 引用的 `../types` 即可。
 */
import { DIALOG_WINDOW_KEY_COMMANDS } from "./imports";
/**
 * 用途：导入 ArkType 类型推断工具 `type`，用于声明路由输入状态类型和 split 模式匹配条件。
 * 使用范围：仅在当前文件声明 `dialogWindowKeyStateRouteInput` 和 split 模式匹配时使用。
 * 解耦评估：`type` 属于编译期类型辅助工具，不参与运行时逻辑，可通过 `./imports` 统一替换类型库。
 */
import { type } from "./imports";

const dialogWindowKeyStateRouteInput = type({
    specialDialogType: "'viewCards' | 'historyCompare' | null",
    dialog: {
        hasSwitchDialog: "boolean",
        switchDialogMounted: "boolean",
        isArrowKey: "boolean",
        pressedDialogHotkey: "string | null",
        isArrowOrEnterWithoutModifiers: "boolean",
        hasRecentDocsDialog: "boolean",
        hasSpecialDialog: "boolean",
    },
});

const specialDialogWindowKeyStateRouter = calibur
    .universe(dialogWindowKeyStateRouteInput)
    .split(
        type({
            dialog: { pressedDialogHotkey: "'specialDialogNavigation'", hasSpecialDialog: "true" },
            specialDialogType: "'viewCards'",
        }),
        () => DIALOG_WINDOW_KEY_COMMANDS.VIEW_CARDS_DIALOG_NAVIGATION,
    )
    .split(
        type({
            dialog: { pressedDialogHotkey: "'specialDialogNavigation'", hasSpecialDialog: "true" },
            specialDialogType: "'historyCompare'",
        }),
        () => DIALOG_WINDOW_KEY_COMMANDS.HISTORY_COMPARE_DIALOG_NAVIGATION,
    )
    .remain(() => DIALOG_WINDOW_KEY_COMMANDS.IGNORE)
    .build();

const openRecentDocsWindowKeyStateRouter = calibur
    .universe(dialogWindowKeyStateRouteInput)
    .split(
        type({ dialog: { pressedDialogHotkey: "'openRecentDocs'" } }),
        () => DIALOG_WINDOW_KEY_COMMANDS.OPEN_RECENT_DOCS,
    )
    .remain(state => specialDialogWindowKeyStateRouter(state))
    .build();

const recentDocsWindowKeyStateRouter = calibur
    .universe(dialogWindowKeyStateRouteInput)
    .split(
        type({ dialog: { isArrowOrEnterWithoutModifiers: "true", hasRecentDocsDialog: "true" } }),
        () => DIALOG_WINDOW_KEY_COMMANDS.RECENT_DOCS_DIALOG_ARROW,
    )
    .remain(state => openRecentDocsWindowKeyStateRouter(state))
    .build();

const switchDialogWindowKeyStateRouter = calibur
    .universe(dialogWindowKeyStateRouteInput)
    .split(
        type({
            dialog: {
                pressedDialogHotkey: "'openSwitchDialog'",
                switchDialogMounted: "true",
            },
        }),
        () => DIALOG_WINDOW_KEY_COMMANDS.IGNORE,
    )
    .split(
        type({
            dialog: {
                pressedDialogHotkey: "'openSwitchDialog'",
                switchDialogMounted: "false",
            },
        }),
        () => DIALOG_WINDOW_KEY_COMMANDS.OPEN_SWITCH_DIALOG,
    )
    .remain(state => recentDocsWindowKeyStateRouter(state))
    .build();

/**
 * 用途：将对话框子集 facts 路由至对应窗口键命令的顶层路由。
 * 使用范围：由 `windowKeyDown/route/index.ts` 汇总时调用，作为对话框子集的路由入口。
 * 解耦评估：本路由只做静态切分，不参与叶子执行；后续若需调整对话框命令路由，仅修改此链即可，不影响其他子集。
 */
export const routeDialogWindowKeyCommand = calibur
    .universe(dialogWindowKeyStateRouteInput)
    .split(
        type({
            dialog: {
                pressedDialogHotkey: "'switchDialogNextAux'",
                hasSwitchDialog: "true",
                isArrowKey: "true",
            },
        }),
        () => DIALOG_WINDOW_KEY_COMMANDS.SWITCH_DIALOG_ARROW,
    )
    .split(
        type({
            dialog: {
                pressedDialogHotkey: "'switchDialogPrevAux'",
                hasSwitchDialog: "true",
                isArrowKey: "true",
            },
        }),
        () => DIALOG_WINDOW_KEY_COMMANDS.SWITCH_DIALOG_ARROW,
    )
    .remain(state => switchDialogWindowKeyStateRouter(state))
    .build();
