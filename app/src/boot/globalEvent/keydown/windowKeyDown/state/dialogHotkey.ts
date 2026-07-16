import type {DialogHotkeyMatchInput, DialogHotkeyMatchResult} from "./dialogHotkey.types";

/**
 * 对话框辅助键只对方向键生效，避免 Ctrl+普通字符抢占其它全局快捷键。
 * @显式返回类型原因 返回值是供 CalibURRouter 使用的固定辨识联合，需要显式约束以防新增分支扩大路由输入类型。
 */
export const findPressedDialogHotkey = ({
    generalKeymap,
    event,
    matchAuxiliaryHotKey,
    matchHotKey,
}: DialogHotkeyMatchInput): DialogHotkeyMatchResult => {
    // 只有方向键需要把 Ctrl/Shift 辅助键交给已打开的页签切换对话框。
    if (event.key.startsWith("Arrow")) {
        const auxiliaryMatches = [
            ["goToEditTabNext", "switchDialogNextAux"],
            ["goToEditTabPrev", "switchDialogPrevAux"],
        ] as const;
        for (const [key, value] of auxiliaryMatches) {
            const hotkeyConfig = generalKeymap?.[key];
            if (hotkeyConfig?.custom && matchAuxiliaryHotKey(hotkeyConfig.custom, event)) {
                return value;
            }
        }
    }

    const directMatches = [
        ["goToEditTabNext", "openSwitchDialog"],
        ["goToEditTabPrev", "openSwitchDialog"],
        ["recentDocs", "openRecentDocs"],
    ] as const;
    for (const [key, value] of directMatches) {
        const hotkeyConfig = generalKeymap?.[key];
        if (hotkeyConfig?.custom && matchHotKey(hotkeyConfig.custom, event)) {
            return value;
        }
    }
    if (event.key === "Home" || event.key === "End" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        return "specialDialogNavigation";
    }
    return null;
};
