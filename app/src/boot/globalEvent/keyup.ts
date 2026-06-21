import { fetchPost } from "../../util/network/fetch";
import { escapeHtml } from "../../util/DOM/escape";
import { openCard } from "../../card/openCard";
import { getDockByType } from "../../layout/tabUtil";
import { getAllTabs } from "../../layout/getAll";
import { App } from "../../index";
import { Constants } from "../../constants";
import { matchHotKey } from "../../protyle/util/hotKey";
import { isWindow } from "../../util/platform/functions";
import { Dialog } from "../../dialog";
import {
    getSiyuanConfig
} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {
    setSiyuanAltIsPressed,
    setSiyuanCtrlIsPressed,
    setSiyuanShiftIsPressed
} from "../../util/siyuanEnvironments/keyboardStatus.environment";
import { getSiyuanDialogs } from "../../util/siyuanEnvironments/siyuanDialogs.environment";

const updatePreviewWithApi = (rootId: string, parentElement: Element) => {
    fetchPost("/api/filetree/getFullHPathByID", {
        id: rootId
    }, (response) => {
        const grandParent = parentElement.parentElement;
        if (grandParent && grandParent.nextElementSibling) {
            grandParent.nextElementSibling.innerHTML = escapeHtml(response.data);
        }
    });
};

const updatePreviewWithText = (currentLiElement: Element, parentElement: Element) => {
    const textElement = currentLiElement.querySelector(".b3-list-item__text");
    const grandParent = parentElement.parentElement;
    if (textElement && grandParent && grandParent.nextElementSibling) {
        grandParent.nextElementSibling.innerHTML = textElement.innerHTML;
    }
};

const updateSwitchDialogPreview = (currentLiElement: Element) => {
    if (!currentLiElement) {
        return;
    }
    const rootId = currentLiElement.getAttribute("data-node-id");
    const parentElement = currentLiElement.parentElement;
    if (!parentElement) {
        return;
    }
    if (rootId) {
        updatePreviewWithApi(rootId, parentElement);
    }
    if (!rootId) {
        updatePreviewWithText(currentLiElement, parentElement);
    }
    const currentRect = currentLiElement.getBoundingClientRect();
    const currentParentRect = parentElement.getBoundingClientRect();
    if (currentRect.top < currentParentRect.top) {
        currentLiElement.scrollIntoView(true);
    }
    if (currentRect.bottom > currentParentRect.bottom) {
        currentLiElement.scrollIntoView(false);
    }
};

const getPrevCandidate = (currentLiElement: Element): Element | null => {
    if (currentLiElement.previousElementSibling) {
        return currentLiElement.previousElementSibling;
    }
    if (currentLiElement.getAttribute("data-original")) {
        currentLiElement.removeAttribute("data-original");
        return currentLiElement.parentElement ? currentLiElement.parentElement.lastElementChild : null;
    }
    if (currentLiElement.parentElement && currentLiElement.parentElement.nextElementSibling) {
        const nextParent = currentLiElement.parentElement.nextElementSibling;
        return nextParent.lastElementChild || currentLiElement.parentElement.lastElementChild;
    }
    if (currentLiElement.parentElement && currentLiElement.parentElement.previousElementSibling) {
        return currentLiElement.parentElement.previousElementSibling.lastElementChild;
    }
    if (isWindow() && currentLiElement.parentElement) {
        return currentLiElement.parentElement.lastElementChild;
    }
    return null;
};

const getPrevSwitchElement = (currentLiElement: Element) => {
    while (true) {
        const next = getPrevCandidate(currentLiElement);
        if (next) {
            currentLiElement = next;
        }
        if (currentLiElement.getBoundingClientRect().height !== 0) {
            break;
        }
    }
    return currentLiElement;
};

const getNextCandidate = (currentLiElement: Element): Element | null => {
    if (currentLiElement.nextElementSibling) {
        return currentLiElement.nextElementSibling;
    }
    if (currentLiElement.getAttribute("data-original")) {
        currentLiElement.removeAttribute("data-original");
        return currentLiElement.parentElement ? currentLiElement.parentElement.firstElementChild : null;
    }
    if (currentLiElement.parentElement && currentLiElement.parentElement.nextElementSibling) {
        const nextParent = currentLiElement.parentElement.nextElementSibling;
        return nextParent.firstElementChild || (currentLiElement.parentElement ? currentLiElement.parentElement.firstElementChild : null);
    }
    if (currentLiElement.parentElement && currentLiElement.parentElement.previousElementSibling) {
        return currentLiElement.parentElement.previousElementSibling.firstElementChild;
    }
    if (isWindow() && currentLiElement.parentElement) {
        return currentLiElement.parentElement.firstElementChild;
    }
    return null;
};

const getNextSwitchElement = (currentLiElement: Element) => {
    while (true) {
        const next = getNextCandidate(currentLiElement);
        if (next) {
            currentLiElement = next;
        }
        if (currentLiElement.getBoundingClientRect().height !== 0) {
            break;
        }
    }
    return currentLiElement;
};

const handleSwitchDialogNavigation = (switchDialog: Dialog, event: KeyboardEvent) => {
    let currentLiElement = switchDialog.element.querySelector(".b3-list-item--focus");
    if (!currentLiElement) {
        return;
    }
    currentLiElement.classList.remove("b3-list-item--focus");
    const isPrev = matchHotKey(getSiyuanConfig().keymap.general.goToEditTabPrev.custom, event);
    if (isPrev) {
        currentLiElement = getPrevSwitchElement(currentLiElement);
        currentLiElement.classList.add("b3-list-item--focus");
    }
    if (!isPrev) {
        currentLiElement = getNextSwitchElement(currentLiElement);
        currentLiElement.classList.add("b3-list-item--focus");
    }
    updateSwitchDialogPreview(currentLiElement);
    const originalElement = switchDialog.element.querySelector('[data-original="true"]');
    if (originalElement) {
        originalElement.removeAttribute("data-original");
    }
};

const activateTabById = (currentId: string) => {
    for (const item of getAllTabs()) {
        if (item.id === currentId) {
            item.parent.switchTab(item.headElement);
            item.parent.showHeading();
            break;
        }
    }
};

const executeTabSwitch = (currentLiElement: Element) => {
    const currentId = currentLiElement.getAttribute("data-id");
    if (currentId) {
        activateTabById(currentId);
    }
};

const executeSwitchChoice = (app: App, currentLiElement: Element) => {
    const currentType = currentLiElement.getAttribute("data-type");
    if (!currentType) {
        executeTabSwitch(currentLiElement);
        return;
    }
    if (currentType === "riffCard") {
        openCard(app);
    }
    if (currentType !== "riffCard") {
        getDockByType(currentType)?.toggleModel(currentType, true);
    }
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
};

const moveFocusToPrev = (currentLiElement: Element) => {
    if (currentLiElement.previousElementSibling) {
        currentLiElement.previousElementSibling.classList.add("b3-list-item--focus");
        return;
    }
    if (currentLiElement.parentElement && currentLiElement.parentElement.lastElementChild) {
        currentLiElement.parentElement.lastElementChild.classList.add("b3-list-item--focus");
        currentLiElement.removeAttribute("data-original");
    }
};

const moveFocusToNext = (currentLiElement: Element) => {
    if (currentLiElement.nextElementSibling) {
        currentLiElement.nextElementSibling.classList.add("b3-list-item--focus");
        return;
    }
    if (currentLiElement.parentElement && currentLiElement.parentElement.firstElementChild) {
        currentLiElement.parentElement.firstElementChild.classList.add("b3-list-item--focus");
    }
};

const handleRapidSwitching = (switchDialog: Dialog, event: KeyboardEvent, currentLiElement: Element): Element | null => {
    const keymap = getSiyuanConfig().keymap.general;
    currentLiElement.classList.remove("b3-list-item--focus");
    if (matchHotKey(keymap.goToEditTabPrev.custom, event)) {
        moveFocusToPrev(currentLiElement);
        currentLiElement.removeAttribute("data-original");
        return switchDialog.element.querySelector(".b3-list-item--focus");
    }
    moveFocusToNext(currentLiElement);
    currentLiElement.removeAttribute("data-original");
    return switchDialog.element.querySelector(".b3-list-item--focus");
};

const handleSwitchDialogConfirmation = (app: App, switchDialog: Dialog, event: KeyboardEvent) => {
    let currentLiElement = switchDialog.element.querySelector(".b3-list-item--focus");
    if (!currentLiElement) {
        return;
    }
    // 快速切换时，不触发 Tab
    if (currentLiElement.getAttribute("data-original")) {
        currentLiElement = handleRapidSwitching(switchDialog, event, currentLiElement);
    }
    if (!currentLiElement) {
        return;
    }
    executeSwitchChoice(app, currentLiElement);
    switchDialog.destroy();
};

export const windowKeyUp = (app: App, event: KeyboardEvent) => {
    setSiyuanCtrlIsPressed(false);
    setSiyuanShiftIsPressed(false);
    setSiyuanAltIsPressed(false);
    // S-forge: 上游合并 - keyup 时清理 body--shift-pressed 类，确保 Shift 释放后表格列宽调整手柄恢复
    document.body.classList.remove("body--shift-pressed");
    const switchDialog = getSiyuanDialogs().find(item => item.element.getAttribute("data-key") === Constants.DIALOG_SWITCHTAB);
    if (!switchDialog || !switchDialog.element.parentElement) {
        return;
    }
    const keymap = getSiyuanConfig().keymap.general;
    const keyCodeStr = Constants.KEYCODELIST[event.keyCode];
    if (!keyCodeStr) {
        return;
    }
    if (keymap.goToEditTabNext.custom.endsWith(keyCodeStr) ||
        keymap.goToEditTabPrev.custom.endsWith(keyCodeStr)) {
        handleSwitchDialogNavigation(switchDialog, event);
        return;
    }
    if (keymap.goToEditTabNext.custom.startsWith(keyCodeStr) ||
        keymap.goToEditTabPrev.custom.startsWith(keyCodeStr)) {
        handleSwitchDialogConfirmation(app, switchDialog, event);
    }
};
