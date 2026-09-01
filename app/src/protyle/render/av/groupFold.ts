import { updateHotkeyTip } from "../../util/compatibility";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

export const getGroupFoldTip = (folded: boolean) => {
    const action = folded ? siyuanI18n.expand : siyuanI18n.collapse;
    const actionAll = folded ? siyuanI18n.expandAll : siyuanI18n.foldAll;
    return `${action}<div class='ft__on-surface'>${updateHotkeyTip("⌥" + siyuanI18n.click)} ${actionAll}</div>`;
};

const groupFoldedStates = new WeakMap<HTMLElement, Record<string, boolean>>();

export const setGroupFoldedStates = (blockElement: HTMLElement, groups: IAVView[]) => {
    const states: Record<string, boolean> = {};
    for (const group of groups) {
        states[group.id] = !!group.groupFolded;
    }
    groupFoldedStates.set(blockElement, states);
};

export const getGroupFoldedStates = (blockElement: HTMLElement) => {
    return {...(groupFoldedStates.get(blockElement) || {})};
};

export const updateGroupFoldedStates = (blockElement: HTMLElement, states: Record<string, boolean>) => {
    const currentStates = groupFoldedStates.get(blockElement) || {};
    Object.assign(currentStates, states);
    groupFoldedStates.set(blockElement, currentStates);
};
