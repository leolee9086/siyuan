/**
 * 用途：集中承载窗口级键盘事件在对子集处理阶段打开切换对话框时所需的构建、挂载与事件绑定逻辑。
 * 使用范围：仅供 `windowKeyDown/subset/dialog.ts` 在命中切换对话框打开命令时调用。
 * 解耦评估：当前文件只负责切换对话框的叶子构建，不参与命令路由，因此保持了“子集处理”阶段的单向职责。
 */

import type { Tab } from "./imports";
import type { WindowKeyDownState } from "./imports";
import { Constants } from "./imports";
import { Dialog } from "./imports";
import { Editor } from "./imports";
import { escapeHtml } from "./imports";
import { getAllDocks } from "./imports";
import { getAllTabs } from "./imports";
import { getSiyuanConfig } from "./imports";
import { getSiyuanStorage } from "./imports";
import { hideElements } from "./imports";
import { isMac } from "./imports";
import {setSForgeState} from "./imports";
import {WINDOW_KEYDOWN_SWITCH_DIALOG} from "./imports";
import { siyuanI18n } from "./imports";
import { switchDialogEvent } from "./imports";
import { unicode2Emoji } from "./imports";
import { updateHotkeyTip } from "./imports";

const getCurrentTabElement = () => {
    const activeWindowTabElement = document.querySelector(".layout__wnd--active ul.layout-tab-bar > .item--focus");
    if (activeWindowTabElement) {
        return activeWindowTabElement;
    }
    return document.querySelector("ul.layout-tab-bar > .item--focus");
};

const resolveEditorInfoFromInitData = (initData: string | null, item: Tab, defaultDocIcon: string) => {
    if (!initData) {
        return undefined;
    }
    const initDataObj = JSON.parse(initData);
    if (initDataObj.instance !== "Editor") {
        return undefined;
    }
    return {
        rootId: initDataObj.rootId,
        iconHtml: unicode2Emoji(item.docIcon || defaultDocIcon, "b3-list-item__graphic", true),
    };
};

const buildTabItemHtml = (item: Tab, index: number, currentId: string | null, defaultDocIcon: string) => {
    let iconHtml = `<svg class="b3-list-item__graphic"><use xlink:href="#${item.icon}"></use></svg>`;
    let rootId = "";

    if (item.model instanceof Editor) {
        rootId = ` data-node-id="${item.model.editor.protyle.block.rootID}"`;
        iconHtml = unicode2Emoji(item.docIcon || defaultDocIcon, "b3-list-item__graphic", true);
    }

    const editorInfo = item.model instanceof Editor ? undefined : resolveEditorInfoFromInitData(item.headElement.getAttribute("data-initdata"), item, defaultDocIcon);
    if (editorInfo) {
        rootId = ` data-node-id="${editorInfo.rootId}"`;
        iconHtml = editorInfo.iconHtml;
    }

    const isFocused = currentId === item.id;
    return `<li data-index="${index}" data-id="${item.id}"${rootId} class="b3-list-item${isFocused ? " b3-list-item--focus" : ""}"${isFocused ? ' data-original="true"' : ""}>${iconHtml}<span class="b3-list-item__text">${escapeHtml(item.title)}</span></li>`;
};

const buildTabHtml = () => {
    const currentTabElement = getCurrentTabElement();
    if (!currentTabElement) {
        return "";
    }
    const currentId = currentTabElement.getAttribute("data-id");
    const storage = getSiyuanStorage();
    const localImages = storage[Constants.LOCAL_IMAGES];
    const defaultDocIcon = localImages.file;
    const sortedTabs = [...getAllTabs()].sort((itemA, itemB) => {
        const itemAActiveTime = itemA.headElement.getAttribute("data-activetime") ?? "";
        const itemBActiveTime = itemB.headElement.getAttribute("data-activetime") ?? "";
        return itemAActiveTime > itemBActiveTime ? -1 : 1;
    });
    let tabHtml = "";
    for (const [index, item] of sortedTabs.entries()) {
        tabHtml += buildTabItemHtml(item, index, currentId, defaultDocIcon);
    }
    return tabHtml;
};

const buildDockHtml = (tabHtml: string) => {
    const generalKeymap = getSiyuanConfig().keymap.general;
    let dockHtml = `<ul class="b3-list b3-list--background" style="overflow: auto;width: 200px;">
<li data-type="riffCard" data-index="0" class="b3-list-item${!tabHtml ? " b3-list-item--focus" : ""}">
    <svg class="b3-list-item__graphic"><use xlink:href="#iconRiffCard"></use></svg>
    <span class="b3-list-item__text">${siyuanI18n.riffCard}</span>
    <span class="b3-list-item__meta">${updateHotkeyTip(generalKeymap.riffCard.custom)}</span>
</li>`;
    for (const [index, item] of getAllDocks().entries()) {
        dockHtml += `<li data-type="${item.type}" data-index="${index + 1}" class="b3-list-item">
    <svg class="b3-list-item__graphic"><use xlink:href="#${item.icon}"></use></svg>
    <span class="b3-list-item__text">${item.title}</span>
    <span class="b3-list-item__meta">${updateHotkeyTip(item.hotkey || "")}</span>
</li>`;
    }
    return `${dockHtml}</ul>`;
};

const bindSwitchDialogEvents = (state: WindowKeyDownState, dialog: Dialog) => {
    const inputElement = dialog.element.querySelector("input");
    inputElement?.focus();
    if (isMac()) {
        dialog.element.addEventListener("contextmenu", (event: MouseEvent) => void switchDialogEvent(state.app, event));
    }
    dialog.element.addEventListener("click", (event: MouseEvent) => void switchDialogEvent(state.app, event));
};

export const openSwitchDialog = async (state: WindowKeyDownState) => {
    const tabHtml = buildTabHtml();
    const dockHtml = state.isTabWindow ? "" : buildDockHtml(tabHtml);
    hideElements(["dialog"]);
    const dialog = new Dialog({
        positionId: Constants.DIALOG_SWITCHTAB,
        title: siyuanI18n.switchTab,
        content: `<div class="fn__flex-column switch-doc">
    <input style="opacity: 0;height: 0.1px;box-sizing: border-box;margin: 0;padding: 0;border: 0;">
    <div class="fn__flex" style="overflow:auto;">${dockHtml}
        <ul${state.isTabWindow ? ' style="border-left:0"' : ""} class="b3-list b3-list--background fn__flex-1">${tabHtml}</ul>
    </div>
    <div class="switch-doc__path"></div>
</div>`,
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_SWITCHTAB);
    setSForgeState(WINDOW_KEYDOWN_SWITCH_DIALOG, dialog);
    bindSwitchDialogEvents(state, dialog);
};
