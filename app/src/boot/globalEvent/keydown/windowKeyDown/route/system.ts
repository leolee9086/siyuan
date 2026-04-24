/**
 * 用途：声明窗口级键盘事件在系统子集中的 `facts -> command` 路由。
 * 使用范围：仅供 `windowKeyDown/route/index.ts` 汇总各子集命令时调用。
 * 解耦评估：当前文件只承载系统 facts 到命令的优先级声明，不参与叶子动作执行，从而避免执行期再回看状态。
 */

/**
 * 用途：导入路由 DSL calibur-router，用于声明式地以状态空间分割构建 facts → command 路由链。
 * 使用范围：仅在当前 `system.ts` 路由文件中使用，用于组装系统域窗口键的优先级路由链。
 * 解耦评估：calibur 已通过 `./imports` 集中转发，切换 DSL 实现时仅需修改 `./imports`；当前文件仅定义路由链，不负责任何叶子动作执行。
 */
import { calibur } from "./imports";
/**
 * 用途：导入系统域窗口键命令常量集，用于标识从 facts 路由出的具体系统命令（如 ESCAPE、ZOOM_IN、SYNC_NOW 等）。
 * 使用范围：仅在当前路由切分链的 split/remain 回调中作为路由端点返回值，不暴露至路由外部。
 * 解耦评估：命令常量属于路由契约的一部分，与具体执行逻辑解耦；若需调整常量值，仅需修改 `../commands.types` 中对应常量定义。
 */
import { SYSTEM_WINDOW_KEY_COMMANDS } from "./imports";
/**
 * 用途：导入 ArkType 类型推断工具 `type`，用于声明路由输入状态类型（`systemWindowKeyStateRouteInput`）和 split 模式匹配条件。
 * 使用范围：仅在当前文件声明路由输入 schema 和各 split 模式条件时使用，不参与运行时逻辑。
 * 解耦评估：`type` 属于编译期类型辅助工具，运行期零额外开销；已通过 `./imports` 集中转发，替换类型方案时仅需修改 `./imports`。
 */
import { type } from "./imports";

const systemWindowKeyStateRouteInput = type({
    isTabWindow: "boolean",
    dockHotkeyType: "string | null",
    system: {
        isElectron: "boolean",
        targetInPdf: "boolean",
        targetIsTextInput: "boolean",
        isReadonlyConfig: "boolean",
        zoomInHotkey: "boolean",
        zoomRestoreHotkey: "boolean",
        zoomOutHotkey: "boolean",
        syncNowHotkey: "boolean",
        commandPanelHotkey: "boolean",
        toggleReadonlyHotkey: "boolean",
        lockScreenHotkey: "boolean",
        openHistoryHotkey: "boolean",
        toggleDockBarHotkey: "boolean",
        openSettingHotkey: "boolean",
        preventSelectAllHotkey: "boolean",
        openRiffCardHotkey: "boolean",
        openDailyNoteHotkey: "boolean",
        newFileHotkey: "boolean",
        hasConfirmDialog: "boolean",
        isEnterKey: "boolean",
        isEscapeKey: "boolean",
        isComposing: "boolean",
    },
});

const escapeSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { isEscapeKey: "true", isComposing: "false" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.ESCAPE,
    )
    .remain(() => SYSTEM_WINDOW_KEY_COMMANDS.IGNORE)
    .build();

const confirmDialogEscapeSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { hasConfirmDialog: "true", isEscapeKey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.CONFIRM_DIALOG_ESCAPE,
    )
    .remain(state => escapeSystemWindowKeyStateRouter(state))
    .build();

const confirmDialogEnterSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { hasConfirmDialog: "true", isEnterKey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.CONFIRM_DIALOG_ENTER,
    )
    .remain(state => confirmDialogEscapeSystemWindowKeyStateRouter(state))
    .build();

const newFileSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { newFileHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.NEW_FILE,
    )
    .remain(state => confirmDialogEnterSystemWindowKeyStateRouter(state))
    .build();

const openDailyNoteSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ isTabWindow: "false", system: { openDailyNoteHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.OPEN_DAILY_NOTE,
    )
    .remain(state => newFileSystemWindowKeyStateRouter(state))
    .build();

const openRiffCardSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ isTabWindow: "false", system: { openRiffCardHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.OPEN_RIFF_CARD,
    )
    .remain(state => openDailyNoteSystemWindowKeyStateRouter(state))
    .build();

const toggleDockModelSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ dockHotkeyType: "string" }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.TOGGLE_DOCK_MODEL,
    )
    .remain(state => openRiffCardSystemWindowKeyStateRouter(state))
    .build();

const preventSelectAllSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { targetIsTextInput: "false", preventSelectAllHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.PREVENT_SELECT_ALL,
    )
    .remain(state => toggleDockModelSystemWindowKeyStateRouter(state))
    .build();

const openSettingSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ isTabWindow: "false", system: { isReadonlyConfig: "false", openSettingHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.OPEN_SETTING,
    )
    .remain(state => preventSelectAllSystemWindowKeyStateRouter(state))
    .build();

const toggleDockBarSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ isTabWindow: "false", system: { toggleDockBarHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.TOGGLE_DOCK_BAR,
    )
    .remain(state => openSettingSystemWindowKeyStateRouter(state))
    .build();

const openHistorySystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { openHistoryHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.OPEN_HISTORY,
    )
    .remain(state => toggleDockBarSystemWindowKeyStateRouter(state))
    .build();

const lockScreenSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { lockScreenHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.LOCK_SCREEN,
    )
    .remain(state => openHistorySystemWindowKeyStateRouter(state))
    .build();

const toggleReadonlySystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { toggleReadonlyHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.TOGGLE_READONLY,
    )
    .remain(state => lockScreenSystemWindowKeyStateRouter(state))
    .build();

const commandPanelSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { commandPanelHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.COMMAND_PANEL,
    )
    .remain(state => toggleReadonlySystemWindowKeyStateRouter(state))
    .build();

const syncNowSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ isTabWindow: "false", system: { syncNowHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.SYNC_NOW,
    )
    .remain(state => commandPanelSystemWindowKeyStateRouter(state))
    .build();

const zoomOutSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { isElectron: "true", targetInPdf: "false", zoomOutHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.ZOOM_OUT,
    )
    .remain(state => syncNowSystemWindowKeyStateRouter(state))
    .build();

const zoomRestoreSystemWindowKeyStateRouter = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { isElectron: "true", zoomRestoreHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.ZOOM_RESTORE,
    )
    .remain(state => zoomOutSystemWindowKeyStateRouter(state))
    .build();

/**
 * 用途：导出系统域窗口键 facts → command 路由链的最终构建结果，供 `route/index.ts` 在汇总四域命令时调用。
 * 使用范围：由 `index.ts` 的 `resolveWindowKeyDownCommands` 调用，作为 system 域命令路由函数。
 * 解耦评估：route 子路由是路由层的自然分解，本身即结构化解耦；策略化/插件化可进一步解耦，但当前规则有限且稳定，引入额外复杂性不值。
 */
export const routeSystemWindowKeyCommand = calibur
    .universe(systemWindowKeyStateRouteInput)
    .split(
        type({ system: { isElectron: "true", targetInPdf: "false", zoomInHotkey: "true" } }),
        () => SYSTEM_WINDOW_KEY_COMMANDS.ZOOM_IN,
    )
    .remain(state => zoomRestoreSystemWindowKeyStateRouter(state))
    .build();
