/**
 * 用途：执行窗口级键盘事件在系统子集中的最终命令。
 * 使用范围：仅供 `windowKeyDown/subset/index.ts` 在根路由命中系统子集后调用。
 * 解耦评估：当前文件只处理系统命令到叶子动作的路由与落地，不再承担 facts 判断，因此保持了“子集处理”阶段的职责纯度。
 */

import type { SystemWindowKeyCommand } from "./imports";
import type { WindowKeyDownState } from "./imports";
import { calibur } from "./imports";
import { commandPanel } from "./imports";
import { getDockByType } from "./imports";
import { getSiyuanConfig } from "./imports";
import { lockScreen } from "./imports";
import { newDailyNote } from "./imports";
import { newFile } from "./imports";
import { openCard } from "./imports";
import { openHistory } from "./imports";
import { openSetting } from "./imports";
import { setReadOnly } from "./imports";
import { setZoom } from "./imports";
import { syncGuide } from "./imports";
import { SYSTEM_WINDOW_KEY_COMMANDS } from "./imports";
import { toggleDockBar } from "./imports";
import { type } from "./imports";
import { executeEscape } from "./system.escape";

const blurActiveElement = () => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
        activeElement.blur();
    }
};

const createZoomHandler = (zoomAction: "zoomIn" | "restore" | "zoomOut") => async (state: WindowKeyDownState) => {
    setZoom(zoomAction);
    state.event.preventDefault();
    return true;
};

const executeZoomInSystemWindowKeyCommand = createZoomHandler("zoomIn");
const executeZoomRestoreSystemWindowKeyCommand = createZoomHandler("restore");
const executeZoomOutSystemWindowKeyCommand = createZoomHandler("zoomOut");

const executeSyncNowSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    state.event.preventDefault();
    syncGuide(state.app);
    return true;
};

const executeCommandPanelSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    state.event.preventDefault();
    commandPanel(state.app);
    return true;
};

const executeToggleReadonlySystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    state.event.preventDefault();
    setReadOnly(!getSiyuanConfig().editor.readOnly);
    return true;
};

const executeLockScreenSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    lockScreen(state.app);
    state.event.preventDefault();
    return true;
};

const executeOpenHistorySystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    openHistory(state.app);
    state.event.preventDefault();
    return true;
};

const executeToggleDockBarSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    const dockBarUseElement = document.querySelector("#barDock use");
    state.event.preventDefault();
    if (!dockBarUseElement) {
        return false;
    }
    toggleDockBar(dockBarUseElement);
    return true;
};

const executeOpenSettingSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    openSetting(state.app);
    state.event.preventDefault();
    return true;
};

const executePreventSelectAllSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    state.event.preventDefault();
    return true;
};

const executeToggleDockModelSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    if (!state.dockHotkeyType) {
        return false;
    }
    getDockByType(state.dockHotkeyType)?.toggleModel(state.dockHotkeyType);
    state.event.preventDefault();
    return true;
};

const executeOpenRiffCardSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    openCard(state.app);
    blurActiveElement();
    state.event.preventDefault();
    return true;
};

const executeOpenDailyNoteSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    newDailyNote(state.app);
    state.event.stopPropagation();
    state.event.preventDefault();
    return true;
};

const executeNewFileSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    newFile(state.app);
    state.event.preventDefault();
    return true;
};

const executeConfirmDialogEnterSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    if (!state.confirmDialogElement) {
        return false;
    }
    state.confirmDialogElement.dispatchEvent(new CustomEvent("click", { detail: state.event.key }));
    state.event.preventDefault();
    return true;
};

const executeConfirmDialogEscapeSystemWindowKeyCommand = async (state: WindowKeyDownState) => {
    if (!state.confirmDialogElement) {
        return false;
    }
    state.confirmDialogElement.dispatchEvent(new CustomEvent("click", { detail: state.event.key }));
    state.event.preventDefault();
    return true;
};

const systemWindowKeyCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.IGNORE}'` }), () => async () => false)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.ZOOM_IN}'` }), () => executeZoomInSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.ZOOM_RESTORE}'` }), () => executeZoomRestoreSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.ZOOM_OUT}'` }), () => executeZoomOutSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.SYNC_NOW}'` }), () => executeSyncNowSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.COMMAND_PANEL}'` }), () => executeCommandPanelSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.TOGGLE_READONLY}'` }), () => executeToggleReadonlySystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.LOCK_SCREEN}'` }), () => executeLockScreenSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.OPEN_HISTORY}'` }), () => executeOpenHistorySystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.TOGGLE_DOCK_BAR}'` }), () => executeToggleDockBarSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.OPEN_SETTING}'` }), () => executeOpenSettingSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.PREVENT_SELECT_ALL}'` }), () => executePreventSelectAllSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.TOGGLE_DOCK_MODEL}'` }), () => executeToggleDockModelSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.OPEN_RIFF_CARD}'` }), () => executeOpenRiffCardSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.OPEN_DAILY_NOTE}'` }), () => executeOpenDailyNoteSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.NEW_FILE}'` }), () => executeNewFileSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.CONFIRM_DIALOG_ENTER}'` }), () => executeConfirmDialogEnterSystemWindowKeyCommand)
    .split(type({ command: `'${SYSTEM_WINDOW_KEY_COMMANDS.CONFIRM_DIALOG_ESCAPE}'` }), () => executeConfirmDialogEscapeSystemWindowKeyCommand)
    .remain(() => executeEscape)
    .build();

export const executeSystemWindowKeyCommand = async (command: SystemWindowKeyCommand, state: WindowKeyDownState) => {
    const executor = systemWindowKeyCommandRouter({ command });
    return executor(state);
};
