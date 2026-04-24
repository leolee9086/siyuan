/**
 * 用途：承接窗口级键盘事件在系统子集中的 Esc 退场链叶子处理。
 * 使用范围：仅供 `windowKeyDown/subset/system.ts` 在命中 `ESCAPE` 命令时调用。
 * 解耦评估：Esc 退场链依然属于系统子集处理，但独立文件能避免系统命令落地入口再次膨胀。
 */

import type { WindowKeyDownState } from "./imports";
import { cancelDrag } from "./imports";
import { focusBlock } from "./imports";
import { focusByRange } from "./imports";
import { getAllModels } from "./imports";
import { getSiyuanBackStack } from "./imports";
import { getSiyuanBlockPanels } from "./imports";
import { getSiyuanDialogs } from "./imports";
import { getSiyuanMenus } from "./imports";
import { hasClosestBlock } from "./imports";
import { hasClosestByClassName } from "./imports";

const removeImagePreview = () => {
    const imgPreviewElement = document.querySelector(".protyle-img");
    if (imgPreviewElement) {
        imgPreviewElement.remove();
        return true;
    }
    return false;
};

const removeVisibleMenu = () => {
    const menus = getSiyuanMenus();
    const dialogs = getSiyuanDialogs();
    const menuElement = menus?.menu?.element;
    if (!(menuElement instanceof HTMLElement) || menuElement.classList.contains("fn__none")) {
        return false;
    }
    const firstDialogWrapper = dialogs[0];
    const firstDialogElement = firstDialogWrapper?.element.querySelector<HTMLElement>(".b3-dialog");
    if (firstDialogElement && menuElement.style.zIndex < firstDialogElement.style.zIndex) {
        return false;
    }
    menus?.menu?.remove(true);
    return true;
};

const removeAvPanel = () => {
    const avElement = document.querySelector(".av__panel");
    if (!avElement) {
        return false;
    }
    const selectCellElement = document.querySelector(".av__cell--select");
    const closestBlockElement = selectCellElement ? hasClosestBlock(selectCellElement) : undefined;
    if (closestBlockElement instanceof HTMLElement) {
        focusBlock(closestBlockElement);
    }
    avElement.remove();
    return true;
};

const destroyUnpinnedBlockPanels = () => {
    let destroyed = false;
    const blockPanels = getSiyuanBlockPanels();
    for (let index = 0; index < blockPanels.length; index++) {
        const item = blockPanels[index];
        if (!item || !(item.element instanceof HTMLElement)) {
            continue;
        }
        const isFloatingPanel = Boolean(item.targetElement) || typeof item.x === "number";
        if (isFloatingPanel && item.element.getAttribute("data-pin") === "false") {
            item.destroy();
            destroyed = true;
            index--;
        }
    }
    return destroyed;
};

const restoreEditorFocus = () => {
    const selection = getSelection();
    const selectionRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const selectionInProtyle = selectionRange ? hasClosestByClassName(selectionRange.startContainer, "protyle-content", true) : null;
    if (selectionRange && selectionInProtyle) {
        focusByRange(selectionRange);
        return true;
    }
    const backStack = getSiyuanBackStack();
    const lastBackStack = backStack[backStack.length - 1];
    if (lastBackStack?.protyle?.toolbar?.range) {
        focusByRange(lastBackStack.protyle.toolbar.range);
        return true;
    }
    const allModels = getAllModels();
    const editors = allModels.editor;
    const firstEditor = editors[0];
    const firstBlockElement = firstEditor?.editor?.protyle?.wysiwyg?.element?.firstElementChild;
    if (firstBlockElement instanceof HTMLElement) {
        focusBlock(firstBlockElement);
        return true;
    }
    return false;
};

/** @同步豁免: 需要绝对同步的 DOM 清理顺序。 */
export const executeEscape = (state: WindowKeyDownState) => {
    cancelDrag();
    if (removeImagePreview()) {
        return true;
    }
    if (removeVisibleMenu()) {
        return true;
    }
    if (removeAvPanel()) {
        return true;
    }
    if (state.event.repeat && document.activeElement && hasClosestByClassName(document.activeElement, "card__action")) {
        return true;
    }
    const dialogs = getSiyuanDialogs();
    const topDialog = dialogs.at(-1);
    if (topDialog) {
        topDialog.destroy();
        return true;
    }
    if (destroyUnpinnedBlockPanels()) {
        return true;
    }
    restoreEditorFocus();
    state.event.preventDefault();
    return true;
};
