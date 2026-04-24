/**
 * 用途：执行窗口级键盘事件在对话框子集中的最终命令。
 * 使用范围：仅供 `windowKeyDown/subset/index.ts` 在根路由命中对话框子集后调用。
 * 解耦评估：当前文件只处理对话框命令到叶子动作的路由与落地，不再承担 facts 判断，因此保持了“子集处理”阶段的职责纯度。
 */

import type { DialogWindowKeyCommand } from "./imports";
import type { WindowKeyDownState } from "./imports";
import { calibur } from "./imports";
import { dialogArrow } from "./imports";
import { DIALOG_WINDOW_KEY_COMMANDS } from "./imports";
import { historyKeydown } from "./imports";
import { openRecentDocs } from "./imports";
import { type } from "./imports";
import { openSwitchDialog } from "./switchDialog.factory";

const resolveRequiredDialog = (
    dialog: WindowKeyDownState["switchDialog"] | WindowKeyDownState["recentDocsDialog"] | WindowKeyDownState["specialDialog"],
    errorMessage: string,
) => {
    if (dialog) {
        return dialog;
    }
    throw new Error(errorMessage);
};

const executeIgnoredDialogWindowKeyCommand = async () => true;

const executeSwitchDialogArrowDialogWindowKeyCommand = async (state: WindowKeyDownState) => {
    const currentSwitchDialog = resolveRequiredDialog(state.switchDialog, "windowKeyDown dialog expected switchDialog for arrow navigation");
    await dialogArrow(state.app, currentSwitchDialog.element, state.event);
    return true;
};

const executeOpenSwitchDialogDialogWindowKeyCommand = async (state: WindowKeyDownState) => {
    await openSwitchDialog(state);
    return true;
};

const executeRecentDocsDialogArrowDialogWindowKeyCommand = async (state: WindowKeyDownState) => {
    const recentDocsDialog = resolveRequiredDialog(state.recentDocsDialog, "windowKeyDown dialog expected recentDocsDialog for dialogArrow");
    state.event.preventDefault();
    await dialogArrow(state.app, recentDocsDialog.element, state.event);
    return true;
};

const executeOpenRecentDocsDialogWindowKeyCommand = async (state: WindowKeyDownState) => {
    openRecentDocs();
    state.event.preventDefault();
    return true;
};

const executeViewCardsDialogNavigationWindowKeyCommand = async (state: WindowKeyDownState) => {
    const specialDialog = resolveRequiredDialog(state.specialDialog, "windowKeyDown dialog expected specialDialog for viewCards navigation");
    specialDialog.element.dispatchEvent(new CustomEvent("click", { detail: state.event.key.toLowerCase() }));
    state.event.preventDefault();
    return true;
};

const executeHistoryCompareDialogNavigationWindowKeyCommand = async (state: WindowKeyDownState) => {
    const specialDialog = resolveRequiredDialog(state.specialDialog, "windowKeyDown dialog expected specialDialog for historyCompare navigation");
    historyKeydown(state.event, specialDialog);
    state.event.preventDefault();
    return true;
};

const dialogWindowKeyCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${DIALOG_WINDOW_KEY_COMMANDS.IGNORE}'` }), () => executeIgnoredDialogWindowKeyCommand)
    .split(type({ command: `'${DIALOG_WINDOW_KEY_COMMANDS.SWITCH_DIALOG_ARROW}'` }), () => executeSwitchDialogArrowDialogWindowKeyCommand)
    .split(type({ command: `'${DIALOG_WINDOW_KEY_COMMANDS.OPEN_SWITCH_DIALOG}'` }), () => executeOpenSwitchDialogDialogWindowKeyCommand)
    .split(type({ command: `'${DIALOG_WINDOW_KEY_COMMANDS.RECENT_DOCS_DIALOG_ARROW}'` }), () => executeRecentDocsDialogArrowDialogWindowKeyCommand)
    .split(type({ command: `'${DIALOG_WINDOW_KEY_COMMANDS.OPEN_RECENT_DOCS}'` }), () => executeOpenRecentDocsDialogWindowKeyCommand)
    .split(type({ command: `'${DIALOG_WINDOW_KEY_COMMANDS.VIEW_CARDS_DIALOG_NAVIGATION}'` }), () => executeViewCardsDialogNavigationWindowKeyCommand)
    .remain(() => executeHistoryCompareDialogNavigationWindowKeyCommand)
    .build();

export const executeDialogWindowKeyCommand = async (command: DialogWindowKeyCommand, state: WindowKeyDownState) => {
    const executor = dialogWindowKeyCommandRouter({ command });
    return executor(state);
};
