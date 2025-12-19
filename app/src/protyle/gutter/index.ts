import {
    hasClosestBlock,
    hasClosestByClassName,
    hasClosestByTag,
    hasTopClosestByClassName,
    isInAVBlock,
    isInEmbedBlock
} from "../util/hasClosest";
import { getIconByType } from "../../editor/getIcon";
import { enterBack, iframeMenu, setFold, videoMenu, zoomOut } from "../../menus/protyle";
import { MenuItem } from "../../menus/Menu.Item";
import { copySubMenu, openAttr } from "../../menus/commonMenuItem";
import { openFileAttr } from "../../menus/commonMenuItem.openFileAttr";
import { openWechatNotify } from "../../menus/commonMenuItem.openWechatNotify";
import {
    copyPlainText,
    isInAndroid,
    isInHarmony,
    isMac,
    isOnlyMeta,
    openByMobile,
    updateHotkeyAfterTip,
    updateHotkeyTip,
    writeText
} from "../util/compatibility";
import {
    transaction,
    turnsIntoOneTransaction,
    turnsIntoTransaction,
    turnsOneInto,
    updateBatchTransaction,
    updateTransaction
} from "../wysiwyg/transaction";
import { removeBlock } from "../wysiwyg/remove";
import { focusBlock, focusByRange, getEditorRange } from "../util/selection";
import { hideElements } from "../ui/hideElements";
import { highlightRender } from "../render/highlightRender";

import { getContenteditableElement, getParentBlock, getTopAloneElement, isNotEditBlock } from "../wysiwyg/getBlock";
import * as dayjs from "dayjs";
import { fetchPost } from "../../util/fetch";
import { cancelSB, genEmptyElement, getLangByType, insertEmptyBlock, jumpToParent, } from "../../block/util";
import { countBlockWord } from "../../layout/status";
import { Constants } from "../../constants";
import { mathRender } from "../render/mathRender";
import { duplicateBlock } from "../wysiwyg/commonHotkey";
import { useShell } from "../../util/pathName";
import { movePathTo } from "../../util/pathName/movePathTo";
import { hintMoveBlock } from "../hint/extend";
import { makeCard, quickMakeCard } from "../../card/makeCard";
import { transferBlockRef } from "../../menus/block";
import { isMobile } from "../../util/functions";
import { openAIActionsMenu } from "../../ai/actions";
import { activeBlur, renderTextMenu, showKeyboardToolbarUtil } from "../../mobile/util/keyboardToolbar";
import { hideTooltip } from "../../dialog/tooltip";
import { appearanceMenu } from "../toolbar/Font";
import { setPosition } from "../../util/setPosition";
import { emitOpenMenu } from "../../plugin/EventBus";
import { insertAttrViewBlockAnimation, updateHeader } from "../render/av/row";
import { avContextmenu, duplicateCompletely } from "../render/av/action";
import { getPlainText } from "../util/paste";
import { addEditorToDatabase } from "../render/av/addToDatabase";
import { processClonePHElement } from "../render/util";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
/// #if !MOBILE
import { openFileById } from "../../editor/utils.openFileById";
import * as path from "path";
/// #endif
import { checkFold } from "../../util/noRelyPCFunction";
import { clearSelect } from "../util/clearSelect";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { buildGutterCopyMenu } from "./buildGutterCopyMenu";
import { buildGutterCodeBlockMenu } from "./buildGutterCodeBlockMenu";
import { buildGutterHeadingMenu } from "./buildGutterHeadingMenu";
import { buildGutterTurnIntoMenu } from "./buildGutterTurnIntoMenu";
import { buildGutterEmbedMenu } from "./buildGutterEmbedMenu";
import { buildGutterTableMenu } from "./buildGutterTableMenu";
import { buildGutterAlignMenu, buildGutterHeightsMenu, buildGutterWidthsMenu } from "./buildGutterStyleMenu";
import { buildGutterSuperBlockMenu } from "./buildGutterSuperBlockMenu";
import { buildGutterMediaMenu } from "./buildGutterHtmlMenu";
import { buildGutterAvMenu } from "./buildGutterAvMenu";

export class Gutter {
    public element: HTMLElement;
    private gutterTip: string;

    constructor(protyle: IProtyle) {
        if (isMac()) {
            this.gutterTip = siyuanI18n.gutterTip.replace("⌥→", updateHotkeyAfterTip(getSiyuanConfig().keymap.general.enter.custom, "/"))
                .replace("⌘↑", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.collapse.custom, "/"))
                .replace("⌥⌘A", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.attr.custom, "/"));
        } else {
            this.gutterTip = siyuanI18n.gutterTip.replace("⌥→", updateHotkeyAfterTip(getSiyuanConfig().keymap.general.enter.custom, "/"))
                .replace("⌘↑", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.collapse.custom, "/"))
                .replace("⌥⌘A", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.attr.custom, "/"))
                .replace(/⌘/g, "Ctrl+").replace(/⌥/g, "Alt+").replace(/⇧/g, "Shift+").replace(/⌃/g, "Ctrl+");
        }
        if (protyle.options.backlinkData) {
            this.gutterTip = this.gutterTip.replace(siyuanI18n.enter, siyuanI18n.openBy);
        }
        this.element = document.createElement("div");
        this.element.className = "protyle-gutters";
        this.element.addEventListener("dragstart", (event: DragEvent & { target: HTMLElement }) => {
            hideTooltip();
            getSiyuanGlobalMenus().menu.remove();
            const buttonElement = event.target.parentElement;
            let selectIds: string[] = [];
            let selectElements: Element[] = [];
            let avElement: Element;
            if (buttonElement.dataset.rowId) {
                avElement = Array.from(protyle.wysiwyg.element.querySelectorAll(`.av[data-node-id="${buttonElement.dataset.nodeId}"]`)).find((item: HTMLElement) => {
                    if (!isInEmbedBlock(item) && !isInAVBlock(item)) {
                        return true;
                    }
                });
                if (avElement.querySelector('.block__icon[data-type="av-sort"]')?.classList.contains("block__icon--active")) {
                    const bodyElements = avElement.querySelectorAll(".av__body");
                    if (bodyElements.length === 1) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    } else if (["template", "created", "updated"].includes(bodyElements[0].getAttribute("data-dtype"))) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                }
                const rowElement = avElement.querySelector(`.av__body${buttonElement.dataset.groupId ? `[data-group-id="${buttonElement.dataset.groupId}"]` : ""} .av__row[data-id="${buttonElement.dataset.rowId}"]`);
                if (!rowElement.classList.contains("av__row--select")) {
                    avElement.querySelectorAll(".av__row--select:not(.av__row--header)").forEach(item => {
                        item.classList.remove("av__row--select");
                        item.querySelector("use").setAttribute("xlink:href", "#iconUncheck");
                    });
                }
                rowElement.classList.add("av__row--select");
                rowElement.querySelector(".av__firstcol use").setAttribute("xlink:href", "#iconCheck");
                updateHeader(rowElement as HTMLElement);
                avElement.querySelectorAll(".av__row--select:not(.av__row--header)").forEach(item => {
                    const avBodyElement = hasClosestByClassName(item, "av__body") as HTMLElement;
                    const groupId = (avBodyElement ? avBodyElement.dataset.groupId : "") || "";
                    selectIds.push(item.getAttribute("data-id") + (groupId ? "@" + groupId : ""));
                    selectElements.push(item);
                });
            } else {
                const gutterId = buttonElement.getAttribute("data-node-id");
                selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
                let selectedIncludeGutter = false;
                selectElements.forEach((item => {
                    const itemId = item.getAttribute("data-node-id");
                    if (itemId === gutterId) {
                        selectedIncludeGutter = true;
                    }
                    selectIds.push(itemId);
                }));
                if (!selectedIncludeGutter) {
                    let gutterNodeElement: HTMLElement;
                    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${gutterId}"]`)).find((item: HTMLElement) => {
                        if (!isInEmbedBlock(item) && this.isMatchNode(item)) {
                            gutterNodeElement = item;
                            return true;
                        }
                    });
                    if (gutterNodeElement) {
                        selectElements.forEach((item => {
                            item.classList.remove("protyle-wysiwyg--select");
                        }));
                        gutterNodeElement.classList.add("protyle-wysiwyg--select");
                        selectElements = [gutterNodeElement];
                        selectIds = [gutterId];
                    }
                }
            }

            const ghostElement = document.createElement("div");
            ghostElement.className = protyle.wysiwyg.element.className;
            selectElements.forEach(item => {
                if (item.querySelector("iframe")) {
                    const type = item.getAttribute("data-type");
                    const embedElement = genEmptyElement();
                    embedElement.classList.add("protyle-wysiwyg--select");
                    getContenteditableElement(embedElement).innerHTML = `<svg class="svg"><use xlink:href="${buttonElement.querySelector("use").getAttribute("xlink:href")}"></use></svg> ${getLangByType(type)}`;
                    ghostElement.append(embedElement);
                } else {
                    ghostElement.append(processClonePHElement(item.cloneNode(true) as Element));
                }
            });
            ghostElement.setAttribute("style", `position:fixed;opacity:.1;width:${selectElements[0].clientWidth}px;padding:0;`);
            document.body.append(ghostElement);
            event.dataTransfer.setDragImage(ghostElement, 0, 0);
            setTimeout(() => {
                ghostElement.remove();
            });
            buttonElement.style.opacity = "0.38";
            window.siyuan.dragElement = avElement as HTMLElement || protyle.wysiwyg.element;
            event.dataTransfer.setData(`${Constants.SIYUAN_DROP_GUTTER}${buttonElement.getAttribute("data-type")}${Constants.ZWSP}${buttonElement.getAttribute("data-subtype")}${Constants.ZWSP}${selectIds}${Constants.ZWSP}${getSiyuanConfig().system.workspaceDir}`,
                protyle.wysiwyg.element.innerHTML);
        });
        this.element.addEventListener("dragend", () => {
            this.element.querySelectorAll("button").forEach((item) => {
                item.style.opacity = "";
            });
            window.siyuan.dragElement = undefined;
        });
        this.element.addEventListener("click", (event: MouseEvent & { target: HTMLInputElement }) => {
            const buttonElement = hasClosestByTag(event.target, "BUTTON");
            if (!buttonElement) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            hideTooltip();
            clearSelect(["av", "img"], protyle.wysiwyg.element);
            const id = buttonElement.getAttribute("data-node-id");
            if (!id) {
                if (buttonElement.getAttribute("disabled")) {
                    return;
                }
                buttonElement.setAttribute("disabled", "disabled");
                let foldElement: Element;
                Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${(buttonElement.previousElementSibling || buttonElement.nextElementSibling).getAttribute("data-node-id")}"]`)).find(item => {
                    if (!isInEmbedBlock(item) && this.isMatchNode(item)) {
                        foldElement = item;
                        return true;
                    }
                });
                if (!foldElement) {
                    return;
                }
                if (event.altKey) {
                    // 折叠所有子集
                    let hasFold = true;
                    Array.from(foldElement.children).find((ulElement) => {
                        if (ulElement.classList.contains("list")) {
                            const foldElement = Array.from(ulElement.children).find((listItemElement) => {
                                if (listItemElement.classList.contains("li")) {
                                    if (listItemElement.getAttribute("fold") !== "1" && listItemElement.childElementCount > 3) {
                                        hasFold = false;
                                        return true;
                                    }
                                }
                            });
                            if (foldElement) {
                                return true;
                            }
                        }
                    });
                    const doOperations: IOperation[] = [];
                    const undoOperations: IOperation[] = [];
                    Array.from(foldElement.children).forEach((ulElement) => {
                        if (ulElement.classList.contains("list")) {
                            Array.from(ulElement.children).forEach((listItemElement) => {
                                if (listItemElement.classList.contains("li")) {
                                    if (hasFold) {
                                        listItemElement.removeAttribute("fold");
                                    } else if (listItemElement.childElementCount > 3) {
                                        listItemElement.setAttribute("fold", "1");
                                    }
                                    const listId = listItemElement.getAttribute("data-node-id");
                                    doOperations.push({
                                        action: "setAttrs",
                                        id: listId,
                                        data: JSON.stringify({ fold: hasFold ? "" : "1" })
                                    });
                                    undoOperations.push({
                                        action: "setAttrs",
                                        id: listId,
                                        data: JSON.stringify({ fold: hasFold ? "1" : "" })
                                    });
                                }
                            });
                        }
                    });
                    transaction(protyle, doOperations, undoOperations);
                    buttonElement.removeAttribute("disabled");
                } else {
                    const foldStatus = setFold(protyle, foldElement).fold;
                    if (foldStatus === 1) {
                        (buttonElement.firstElementChild as HTMLElement).style.transform = "";
                    } else if (foldStatus === 0) {
                        (buttonElement.firstElementChild as HTMLElement).style.transform = "rotate(90deg)";
                    }
                }
                hideElements(["select"], protyle);
                getSiyuanGlobalMenus().menu.remove();
                return;
            }
            const gutterRect = buttonElement.getBoundingClientRect();
            if (buttonElement.dataset.type === "NodeAttributeViewRowMenu" || buttonElement.dataset.type === "NodeAttributeViewRow") {
                const rowElement = Array.from(protyle.wysiwyg.element.querySelectorAll(`.av[data-node-id="${buttonElement.dataset.nodeId}"] .av__row[data-id="${buttonElement.dataset.rowId}"]`)).find((item: HTMLElement) => {
                    if (!isInEmbedBlock(item)) {
                        return true;
                    }
                });
                if (!rowElement) {
                    return;
                }
                const blockElement = hasClosestBlock(rowElement);
                if (!blockElement) {
                    return;
                }
                if (buttonElement.dataset.type === "NodeAttributeViewRow") {
                    const avID = blockElement.getAttribute("data-av-id");
                    const srcIDs = [Lute.NewNodeID()];
                    const previousID = event.altKey ? (rowElement.previousElementSibling.getAttribute("data-id") || "") : buttonElement.dataset.rowId;
                    const newUpdated = dayjs().format("YYYYMMDDHHmmss");
                    const groupID = rowElement.parentElement.getAttribute("data-group-id");
                    transaction(protyle, [{
                        action: "insertAttrViewBlock",
                        avID,
                        previousID,
                        srcs: [{
                            itemID: Lute.NewNodeID(),
                            id: srcIDs[0],
                            isDetached: true,
                            content: ""
                        }],
                        blockID: id,
                        groupID,
                    }, {
                        action: "doUpdateUpdated",
                        id,
                        data: newUpdated,
                    }], [{
                        action: "removeAttrViewBlock",
                        srcIDs,
                        avID,
                    }, {
                        action: "doUpdateUpdated",
                        id,
                        data: blockElement.getAttribute("updated")
                    }]);
                    insertAttrViewBlockAnimation({ protyle, blockElement, srcIDs, previousId: previousID, groupID });
                    if (event.altKey) {
                        this.element.querySelectorAll("button").forEach(item => {
                            item.dataset.rowId = srcIDs[0];
                        });
                    }
                    blockElement.setAttribute("updated", newUpdated);
                } else {
                    if (!protyle.disabled && event.shiftKey) {
                        const blockId = rowElement.querySelector('[data-dtype="block"] .av__celltext--ref')?.getAttribute("data-id");
                        if (blockId) {
                            fetchPost("/api/attr/getBlockAttrs", { id: blockId }, (response) => {
                                openFileAttr(response.data, "av", protyle);
                            });
                            return;
                        }
                    }
                    avContextmenu(protyle, rowElement as HTMLElement, {
                        x: gutterRect.left,
                        y: gutterRect.bottom,
                        w: gutterRect.width,
                        h: gutterRect.height,
                        isLeft: true
                    });
                }
                return;
            }
            if (isOnlyMeta(event)) {
                if (protyle.options.backlinkData) {
                    checkFold(id, (zoomIn, action) => {
                        openFileById({
                            app: protyle.app,
                            id,
                            action,
                            zoomIn
                        });
                    });
                } else {
                    zoomOut({ protyle, id });
                }
            } else if (event.altKey) {
                let foldElement: Element;
                Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${id}"]`)).find(item => {
                    if (!isInEmbedBlock(item) && this.isMatchNode(item)) {
                        foldElement = item;
                        return true;
                    }
                });
                if (!foldElement) {
                    return;
                }
                if (buttonElement.getAttribute("data-type") === "NodeListItem" && foldElement.parentElement.getAttribute("data-node-id")) {
                    // 折叠同级
                    let hasFold = true;
                    Array.from(foldElement.parentElement.children).find((listItemElement) => {
                        if (listItemElement.classList.contains("li")) {
                            if (listItemElement.getAttribute("fold") !== "1" && listItemElement.childElementCount > 3) {
                                hasFold = false;
                                return true;
                            }
                        }
                    });
                    (buttonElement.parentElement.querySelector("[data-type='fold'] > svg") as HTMLElement).style.transform = hasFold ? "rotate(90deg)" : "";
                    const doOperations: IOperation[] = [];
                    const undoOperations: IOperation[] = [];
                    Array.from(foldElement.parentElement.children).find((listItemElement) => {
                        if (listItemElement.classList.contains("li")) {
                            if (hasFold) {
                                listItemElement.removeAttribute("fold");
                            } else if (listItemElement.childElementCount > 3) {
                                listItemElement.setAttribute("fold", "1");
                            }
                            const listId = listItemElement.getAttribute("data-node-id");
                            doOperations.push({
                                action: "setAttrs",
                                id: listId,
                                data: JSON.stringify({ fold: hasFold ? "" : "1" })
                            });
                            undoOperations.push({
                                action: "setAttrs",
                                id: listId,
                                data: JSON.stringify({ fold: hasFold ? "1" : "" })
                            });
                        }
                    });
                    transaction(protyle, doOperations, undoOperations);
                } else {
                    const hasFold = setFold(protyle, foldElement).fold;
                    const foldArrowElement = buttonElement.parentElement.querySelector("[data-type='fold'] > svg") as HTMLElement;
                    if (hasFold !== -1 && foldArrowElement) {
                        foldArrowElement.style.transform = hasFold === 0 ? "rotate(90deg)" : "";
                    }
                }
                foldElement.classList.remove("protyle-wysiwyg--hl");
            } else if (event.shiftKey && !protyle.disabled) {
                // 不使用 window.siyuan.shiftIsPressed ，否则窗口未激活时按 Shift 点击块标无法打开属性面板 https://github.com/siyuan-note/siyuan/issues/15075
                openAttr(protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`), "bookmark", protyle);
            } else if (!window.siyuan.ctrlIsPressed && !window.siyuan.altIsPressed && !window.siyuan.shiftIsPressed) {
                this.renderMenu(protyle, buttonElement);
                // https://ld246.com/article/1648433751993
                if (!protyle.toolbar.range) {
                    protyle.toolbar.range = getEditorRange(protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`) || protyle.wysiwyg.element.firstElementChild);
                }
                /// #if MOBILE
                getSiyuanGlobalMenus().menu.fullscreen();
                /// #else
                getSiyuanGlobalMenus().menu.popup({ x: gutterRect.left, y: gutterRect.bottom, isLeft: true });
                const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
                getSiyuanGlobalMenus().menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
                focusByRange(protyle.toolbar.range);
                /// #endif
            }
        });
        this.element.addEventListener("contextmenu", (event: MouseEvent & { target: HTMLInputElement }) => {
            const buttonElement = hasClosestByTag(event.target, "BUTTON");
            if (!buttonElement || buttonElement.getAttribute("data-type") === "fold") {
                return;
            }
            if (!window.siyuan.ctrlIsPressed && !window.siyuan.altIsPressed && !window.siyuan.shiftIsPressed) {
                hideTooltip();
                clearSelect(["av", "img"], protyle.wysiwyg.element);
                const gutterRect = buttonElement.getBoundingClientRect();
                if (buttonElement.dataset.type === "NodeAttributeViewRowMenu") {
                    const rowElement = Array.from(protyle.wysiwyg.element.querySelectorAll(`.av[data-node-id="${buttonElement.dataset.nodeId}"] .av__row[data-id="${buttonElement.dataset.rowId}"]`)).find((item: HTMLElement) => {
                        if (!isInEmbedBlock(item)) {
                            return true;
                        }
                    });
                    if (rowElement) {
                        avContextmenu(protyle, rowElement as HTMLElement, {
                            x: gutterRect.left,
                            y: gutterRect.bottom,
                            w: gutterRect.width,
                            h: gutterRect.height,
                            isLeft: true
                        });
                    }
                } else if (buttonElement.dataset.type !== "NodeAttributeViewRow") {
                    this.renderMenu(protyle, buttonElement);
                    if (!protyle.toolbar.range) {
                        protyle.toolbar.range = getEditorRange(
                            protyle.wysiwyg.element.querySelector(`[data-node-id="${buttonElement.getAttribute("data-node-id")}"]`) ||
                            protyle.wysiwyg.element.firstElementChild);
                    }
                    /// #if MOBILE
                    getSiyuanGlobalMenus().menu.fullscreen();
                    /// #else
                    getSiyuanGlobalMenus().menu.popup({ x: gutterRect.left, y: gutterRect.bottom, isLeft: true });
                    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
                    getSiyuanGlobalMenus().menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
                    focusByRange(protyle.toolbar.range);
                    /// #endif
                }
            }
            event.preventDefault();
            event.stopPropagation();
        });
        this.element.addEventListener("mouseleave", (event: MouseEvent & { target: HTMLInputElement }) => {
            Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--hl, .av__row--hl")).forEach(item => {
                item.classList.remove("protyle-wysiwyg--hl", "av__row--hl");
            });
            event.preventDefault();
            event.stopPropagation();
        });
        // https://github.com/siyuan-note/siyuan/issues/12751
        this.element.addEventListener("mousewheel", (event) => {
            hideElements(["gutter"], protyle);
            event.stopPropagation();
        }, { passive: true });
    }

    public isMatchNode(item: Element) {
        const itemRect = item.getBoundingClientRect();
        // 原本为4，由于 https://github.com/siyuan-note/siyuan/issues/12166 改为 6
        let gutterTop = this.element.getBoundingClientRect().top + 6;
        if (itemRect.height < Math.floor(getSiyuanConfig().editor.fontSize * 1.625) + 8) {
            gutterTop = gutterTop - (itemRect.height - this.element.clientHeight) / 2;
        }
        return itemRect.top <= gutterTop && itemRect.bottom >= gutterTop;
    }

    private turnsOneInto(options: {
        menuId?: string,
        id: string,
        icon: string,
        label: string,
        protyle: IProtyle,
        nodeElement: Element,
        accelerator?: string
        type: string,
        level?: number
    }) {
        return {
            id: options.menuId,
            icon: options.icon,
            label: options.label,
            accelerator: options.accelerator,
            click() {
                turnsOneInto(options);
            }
        };
    }

    private turnsIntoOne(options: {
        menuId?: string,
        accelerator?: string,
        icon?: string,
        label: string,
        protyle: IProtyle,
        selectsElement: Element[],
        type: TTurnIntoOne,
        level?: TTurnIntoOneSub,
    }) {
        return {
            id: options.menuId,
            icon: options.icon,
            label: options.label,
            accelerator: options.accelerator,
            click() {
                turnsIntoOneTransaction(options);
            }
        };
    }

    private turnsInto(options: {
        menuId?: string,
        icon?: string,
        label: string,
        protyle: IProtyle,
        selectsElement: Element[],
        type: TTurnInto,
        level?: number,
        isContinue?: boolean,
        accelerator?: string,
    }) {
        return {
            id: options.menuId,
            icon: options.icon,
            label: options.label,
            accelerator: options.accelerator,
            click() {
                turnsIntoTransaction(options);
            }
        };
    }

    private showMobileAppearance(protyle: IProtyle) {
        const toolbarElement = document.getElementById("keyboardToolbar");
        const dynamicElements = toolbarElement.querySelectorAll("#keyboardToolbar .keyboard__dynamic");
        dynamicElements[0].classList.add("fn__none");
        dynamicElements[1].classList.remove("fn__none");
        toolbarElement.querySelector('.keyboard__action[data-type="text"]').classList.add("protyle-toolbar__item--current");
        toolbarElement.querySelector('.keyboard__action[data-type="done"] use').setAttribute("xlink:href", "#iconCloseRound");
        toolbarElement.classList.remove("fn__none");
        const oldScrollTop = protyle.contentElement.scrollTop + 333.5;  // toolbarElement.clientHeight
        renderTextMenu(protyle, toolbarElement);
        showKeyboardToolbarUtil(oldScrollTop);
    }

    public renderMultipleMenu(protyle: IProtyle, selectsElement: Element[]) {
        let isList = false;
        let isContinue = false;
        selectsElement.find((item, index) => {
            if (item.classList.contains("li")) {
                isList = true;
                return true;
            }
            if (item.nextElementSibling && selectsElement[index + 1] &&
                item.nextElementSibling === selectsElement[index + 1]) {
                isContinue = true;
            } else if (index !== selectsElement.length - 1) {
                isContinue = false;
                return true;
            }
        });
        if (!isList && !protyle.disabled) {
            const turnIntoSubmenu: IMenu[] = [];
            if (isContinue) {
                turnIntoSubmenu.push(this.turnsIntoOne({
                    menuId: "list",
                    icon: "iconList",
                    label: siyuanI18n.list,
                    protyle,
                    accelerator: getSiyuanConfig().keymap.editor.insert.list.custom,
                    selectsElement,
                    type: "Blocks2ULs"
                }));
                turnIntoSubmenu.push(this.turnsIntoOne({
                    menuId: "orderedList",
                    icon: "iconOrderedList",
                    label: siyuanI18n["ordered-list"],
                    accelerator: getSiyuanConfig().keymap.editor.insert["ordered-list"].custom,
                    protyle,
                    selectsElement,
                    type: "Blocks2OLs"
                }));
                turnIntoSubmenu.push(this.turnsIntoOne({
                    menuId: "check",
                    icon: "iconCheck",
                    label: siyuanI18n.check,
                    accelerator: getSiyuanConfig().keymap.editor.insert.check.custom,
                    protyle,
                    selectsElement,
                    type: "Blocks2TLs"
                }));
                turnIntoSubmenu.push(this.turnsIntoOne({
                    menuId: "quote",
                    icon: "iconQuote",
                    label: siyuanI18n.quote,
                    accelerator: getSiyuanConfig().keymap.editor.insert.quote.custom,
                    protyle,
                    selectsElement,
                    type: "Blocks2Blockquote"
                }));
                turnIntoSubmenu.push(this.turnsIntoOne({
                    menuId: "callout",
                    icon: "iconCallout",
                    label: siyuanI18n.callout,
                    protyle,
                    selectsElement,
                    type: "Blocks2Callout"
                }));
            }
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "paragraph",
                icon: "iconParagraph",
                label: siyuanI18n.paragraph,
                accelerator: getSiyuanConfig().keymap.editor.heading.paragraph.custom,
                protyle,
                selectsElement,
                type: "Blocks2Ps",
                isContinue
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading1",
                icon: "iconH1",
                label: siyuanI18n.heading1,
                accelerator: getSiyuanConfig().keymap.editor.heading.heading1.custom,
                protyle,
                selectsElement,
                level: 1,
                type: "Blocks2Hs",
                isContinue
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading2",
                icon: "iconH2",
                label: siyuanI18n.heading2,
                accelerator: getSiyuanConfig().keymap.editor.heading.heading2.custom,
                protyle,
                selectsElement,
                level: 2,
                type: "Blocks2Hs",
                isContinue
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading3",
                icon: "iconH3",
                label: siyuanI18n.heading3,
                accelerator: getSiyuanConfig().keymap.editor.heading.heading3.custom,
                protyle,
                selectsElement,
                level: 3,
                type: "Blocks2Hs",
                isContinue
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading4",
                icon: "iconH4",
                label: siyuanI18n.heading4,
                accelerator: getSiyuanConfig().keymap.editor.heading.heading4.custom,
                protyle,
                selectsElement,
                level: 4,
                type: "Blocks2Hs",
                isContinue
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading5",
                icon: "iconH5",
                label: siyuanI18n.heading5,
                accelerator: getSiyuanConfig().keymap.editor.heading.heading5.custom,
                protyle,
                selectsElement,
                level: 5,
                type: "Blocks2Hs",
                isContinue
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading6",
                icon: "iconH6",
                label: siyuanI18n.heading6,
                accelerator: getSiyuanConfig().keymap.editor.heading.heading6.custom,
                protyle,
                selectsElement,
                level: 6,
                type: "Blocks2Hs",
                isContinue
            }));
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "turnInto",
                icon: "iconRefresh",
                label: siyuanI18n.turnInto,
                type: "submenu",
                submenu: turnIntoSubmenu
            }).element);
            if (isContinue && !(selectsElement[0].parentElement.classList.contains("sb") &&
                selectsElement.length + 1 === selectsElement[0].parentElement.childElementCount)) {
                getSiyuanGlobalMenus().menu.append(new MenuItem({
                    id: "mergeSuperBlock",
                    icon: "iconSuper",
                    label: siyuanI18n.merge + " " + siyuanI18n.superBlock,
                    type: "submenu",
                    submenu: [this.turnsIntoOne({
                        menuId: "hLayout",
                        label: siyuanI18n.hLayout,
                        accelerator: getSiyuanConfig().keymap.editor.general.hLayout.custom,
                        icon: "iconSplitLR",
                        protyle,
                        selectsElement,
                        type: "BlocksMergeSuperBlock",
                        level: "col"
                    }), this.turnsIntoOne({
                        menuId: "vLayout",
                        label: siyuanI18n.vLayout,
                        accelerator: getSiyuanConfig().keymap.editor.general.vLayout.custom,
                        icon: "iconSplitTB",
                        protyle,
                        selectsElement,
                        type: "BlocksMergeSuperBlock",
                        level: "row"
                    })]
                }).element);
            }
        }
        if (!protyle.disabled) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "ai",
                icon: "iconSparkles",
                label: siyuanI18n.ai,
                accelerator: getSiyuanConfig().keymap.editor.general.ai.custom,
                click() {
                    openAIActionsMenu(selectsElement, protyle);
                }
            }).element);
        }
        const copyMenu: IMenu[] = (copySubMenu(Array.from(selectsElement).map(item => item.getAttribute("data-node-id")), true, selectsElement[0]) as IMenu[]).concat([{
            id: "copyPlainText",
            iconHTML: "",
            label: siyuanI18n.copyPlainText,
            accelerator: getSiyuanConfig().keymap.editor.general.copyPlainText.custom,
            click() {
                let html = "";
                selectsElement.forEach((item: HTMLElement) => {
                    html += getPlainText(item) + "\n";
                });
                copyPlainText(html.trimEnd());
                focusBlock(selectsElement[0]);
            }
        }, {
            id: "copy",
            iconHTML: "",
            label: siyuanI18n.copy,
            accelerator: "⌘C",
            click() {
                if (isNotEditBlock(selectsElement[0])) {
                    focusBlock(selectsElement[0]);
                } else {
                    focusByRange(getEditorRange(selectsElement[0]));
                }
                document.execCommand("copy");
            }
        }]);
        const copyTextRefMenu = this.genCopyTextRef(selectsElement);
        if (copyTextRefMenu) {
            copyMenu.splice(7, 0, copyTextRefMenu);
        }
        if (!protyle.disabled) {
            copyMenu.push({
                id: "duplicate",
                iconHTML: "",
                label: siyuanI18n.duplicate,
                accelerator: getSiyuanConfig().keymap.editor.general.duplicate.custom,
                click() {
                    duplicateBlock(selectsElement, protyle);
                }
            });
        }
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "copy",
            label: siyuanI18n.copy,
            icon: "iconCopy",
            type: "submenu",
            submenu: copyMenu,
        }).element);
        if (!protyle.disabled) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "cut",
                label: siyuanI18n.cut,
                accelerator: "⌘X",
                icon: "iconCut",
                click: () => {
                    focusBlock(selectsElement[0]);
                    document.execCommand("cut");
                }
            }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "move",
                label: siyuanI18n.move,
                accelerator: getSiyuanConfig().keymap.general.move.custom,
                icon: "iconMove",
                click: () => {
                    movePathTo({
                        cb: (toPath) => {
                            hintMoveBlock(toPath[0], selectsElement, protyle);
                        },
                        flashcard: false
                    });
                }
            }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "addToDatabase",
                label: siyuanI18n.addToDatabase,
                accelerator: getSiyuanConfig().keymap.general.addToDatabase.custom,
                icon: "iconDatabase",
                click: () => {
                    addEditorToDatabase(protyle, getEditorRange(selectsElement[0]));
                }
            }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "delete",
                label: siyuanI18n.delete,
                icon: "iconTrashcan",
                accelerator: "⌫",
                click: () => {
                    protyle.breadcrumb?.hide();
                    removeBlock(protyle, selectsElement[0], getEditorRange(selectsElement[0]), "Backspace");
                }
            }).element);

            getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_appearance", type: "separator" }).element);
            const appearanceElement = new MenuItem({
                id: "appearance",
                label: siyuanI18n.appearance,
                icon: "iconFont",
                accelerator: getSiyuanConfig().keymap.editor.insert.appearance.custom,
                click: () => {
                    /// #if MOBILE
                    this.showMobileAppearance(protyle);
                    /// #else
                    protyle.toolbar.element.classList.add("fn__none");
                    protyle.toolbar.subElement.innerHTML = "";
                    protyle.toolbar.subElement.style.width = "";
                    protyle.toolbar.subElement.style.padding = "";
                    protyle.toolbar.subElement.append(appearanceMenu(protyle, selectsElement));
                    protyle.toolbar.subElement.style.zIndex = (++window.siyuan.zIndex).toString();
                    protyle.toolbar.subElement.classList.remove("fn__none");
                    protyle.toolbar.subElementCloseCB = undefined;
                    const position = selectsElement[0].getBoundingClientRect();
                    setPosition(protyle.toolbar.subElement, position.left, position.top);
                    /// #endif
                }
            }).element;
            getSiyuanGlobalMenus().menu.append(appearanceElement);
            if (!isMobile()) {
                appearanceElement.lastElementChild.classList.add("b3-menu__submenu--row");
            }
            getSiyuanGlobalMenus().menu.append(new MenuItem(buildGutterAlignMenu(selectsElement, protyle)).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem(buildGutterWidthsMenu(selectsElement, protyle)).element);
            // const heightsMenu = buildGutterHeightsMenu(selectsElement, protyle);
            // if (heightsMenu) {
            //     getSiyuanGlobalMenus().menu.append(new MenuItem(heightsMenu).element);
            // }
        }
        if (!getSiyuanConfig().readonly) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "separator_quickMakeCard",
                type: "separator"
            }).element);
            const allCardsMade = !selectsElement.some(item => !item.hasAttribute(Constants.CUSTOM_RIFF_DECKS) && item.getAttribute("data-type") !== "NodeThematicBreak");
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: allCardsMade ? "removeCard" : "quickMakeCard",
                label: allCardsMade ? siyuanI18n.removeCard : siyuanI18n.quickMakeCard,
                accelerator: getSiyuanConfig().keymap.editor.general.quickMakeCard.custom,
                icon: "iconRiffCard",
                click() {
                    quickMakeCard(protyle, selectsElement);
                }
            }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "addToDeck",
                label: siyuanI18n.addToDeck,
                icon: "iconRiffCard",
                ignore: !getSiyuanConfig().flashcard.deck,
                click() {
                    const ids: string[] = [];
                    selectsElement.forEach(item => {
                        if (item.getAttribute("data-type") === "NodeThematicBreak") {
                            return;
                        }
                        ids.push(item.getAttribute("data-node-id"));
                    });
                    makeCard(protyle.app, ids);
                }
            }).element);
        }

        if (protyle?.app?.plugins) {
            emitOpenMenu({
                plugins: protyle.app.plugins,
                type: "click-blockicon",
                detail: {
                    protyle,
                    blockElements: selectsElement,
                },
                separatorPosition: "top",
            });
        }

        return getSiyuanGlobalMenus().menu;
    }

    public renderMenu(protyle: IProtyle, buttonElement: Element) {
        if (!buttonElement) {
            return;
        }
        hideElements(["util", "toolbar", "hint"], protyle);
        getSiyuanGlobalMenus().menu.remove();
        if (isMobile()) {
            activeBlur();
        }
        const id = buttonElement.getAttribute("data-node-id");
        const selectsElement = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
        if (selectsElement.length > 1) {
            getSiyuanGlobalMenus().menu.element.setAttribute("data-name", Constants.MENU_BLOCK_MULTI);
            const match = Array.from(selectsElement).find(item => {
                if (id === item.getAttribute("data-node-id")) {
                    return true;
                }
            });
            if (match) {
                return this.renderMultipleMenu(protyle, Array.from(selectsElement));
            }
        } else {
            getSiyuanGlobalMenus().menu.element.setAttribute("data-name", Constants.MENU_BLOCK_SINGLE);
        }

        let nodeElement: Element;
        if (buttonElement.tagName === "BUTTON") {
            Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${id}"]`)).find(item => {
                if (!isInEmbedBlock(item) && this.isMatchNode(item)) {
                    nodeElement = item;
                    return true;
                }
            });
        } else {
            nodeElement = buttonElement;
        }
        if (!nodeElement) {
            return;
        }
        const type = nodeElement.getAttribute("data-type");
        const subType = nodeElement.getAttribute("data-subtype");
        hideElements(["select"], protyle);
        nodeElement.classList.add("protyle-wysiwyg--select");
        countBlockWord([id], protyle.block.rootID);
        // "heading1-6", "list", "ordered-list", "check", "quote", "code", "table", "line", "math", "paragraph"
        const turnIntoSubmenu = buildGutterTurnIntoMenu({
            nodeElement,
            id,
            type,
            subType,
            protyle,
            turnsOneInto: this.turnsOneInto.bind(this),
            turnsIntoOne: this.turnsIntoOne.bind(this),
            turnsInto: this.turnsInto.bind(this)
        });
        if (turnIntoSubmenu.length > 0 && !protyle.disabled) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "turnInto",
                icon: "iconRefresh",
                label: siyuanI18n.turnInto,
                type: "submenu",
                submenu: turnIntoSubmenu
            }).element);
        }
        if (!protyle.disabled && !nodeElement.classList.contains("hr")) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "ai",
                icon: "iconSparkles",
                label: siyuanI18n.ai,
                accelerator: getSiyuanConfig().keymap.editor.general.ai.custom,
                click() {
                    openAIActionsMenu([nodeElement], protyle);
                }
            }).element);
        }

        const copyMenu = buildGutterCopyMenu({
            nodeElement,
            type,
            id,
            protyle,
            genCopyTextRef: this.genCopyTextRef.bind(this)
        });
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "copy",
            icon: "iconCopy",
            label: siyuanI18n.copy,
            type: "submenu",
            submenu: copyMenu
        }).element);
        if (!protyle.disabled) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "cut",
                icon: "iconCut",
                label: siyuanI18n.cut,
                accelerator: "⌘X",
                click: () => {
                    focusBlock(nodeElement);
                    document.execCommand("cut");
                }
            }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "move",
                icon: "iconMove",
                label: siyuanI18n.move,
                accelerator: getSiyuanConfig().keymap.general.move.custom,
                click: () => {
                    movePathTo({
                        cb: (toPath) => {
                            hintMoveBlock(toPath[0], [nodeElement], protyle);
                        },
                        flashcard: false,
                    });
                }
            }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "addToDatabase",
                icon: "iconDatabase",
                label: siyuanI18n.addToDatabase,
                accelerator: getSiyuanConfig().keymap.general.addToDatabase.custom,
                click: () => {
                    addEditorToDatabase(protyle, getEditorRange(nodeElement));
                }
            }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "delete",
                icon: "iconTrashcan",
                label: siyuanI18n.delete,
                accelerator: "⌫",
                click: () => {
                    protyle.breadcrumb?.hide();
                    removeBlock(protyle, nodeElement, getEditorRange(nodeElement), "Backspace");
                }
            }).element);
        }
        if (type === "NodeSuperBlock" && !protyle.disabled) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "separator_cancelSuperBlock",
                type: "separator"
            }).element);

            buildGutterSuperBlockMenu(protyle, nodeElement, id).forEach(item => {
                getSiyuanGlobalMenus().menu.append(new MenuItem(item).element);
            });
        } else if (type === "NodeCodeBlock" && !protyle.disabled && !nodeElement.getAttribute("data-subtype")) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_code", type: "separator" }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "code",
                type: "submenu",
                icon: "iconCode",
                label: siyuanI18n.code,
                submenu: buildGutterCodeBlockMenu({
                    nodeElement,
                    id
                })
            }).element);
        } else if (type === "NodeCodeBlock" && !protyle.disabled && ["echarts", "mindmap"].includes(nodeElement.getAttribute("data-subtype"))) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_chart", type: "separator" }).element);
            const height = (nodeElement as HTMLElement).style.height;
            let html = nodeElement.outerHTML;
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "chart",
                label: siyuanI18n.chart,
                icon: "iconCode",
                submenu: [{
                    id: "height",
                    iconHTML: "",
                    type: "readonly",
                    label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" value="${height ? parseInt(height) : "420"}" step="1" min="148" style="margin: 4px 8px 4px 0" placeholder="${siyuanI18n.height}"><span class="fn__flex-center">px</span></div>`,
                    bind: (element) => {
                        element.querySelector("input").addEventListener("change", (event) => {
                            const newHeight = ((event.target as HTMLInputElement).value || "420") + "px";
                            (nodeElement as HTMLElement).style.height = newHeight;
                            updateTransaction(protyle, id, nodeElement.outerHTML, html);
                            html = nodeElement.outerHTML;
                            event.stopPropagation();
                            const renderElement = nodeElement.querySelector('[contenteditable="false"]') as HTMLElement;
                            if (renderElement) {
                                renderElement.style.height = newHeight;
                                const chartInstance = window.echarts.getInstanceById(renderElement.getAttribute("_echarts_instance_"));
                                if (chartInstance) {
                                    chartInstance.resize();
                                }
                            }
                        });
                    }
                }, {
                    id: "update",
                    label: siyuanI18n.update,
                    icon: "iconEdit",
                    click() {
                        protyle.toolbar.showRender(protyle, nodeElement);
                    }
                }]
            }).element);
        } else if (type === "NodeTable" && !protyle.disabled) {
            buildGutterTableMenu(protyle, nodeElement).forEach(item => {
                getSiyuanGlobalMenus().menu.append(new MenuItem(item).element);
            });
        } else if (type === "NodeAttributeView") {
            buildGutterAvMenu(protyle, nodeElement, id).forEach(item => {
                getSiyuanGlobalMenus().menu.append(new MenuItem(item).element);
            });
        } else if (["NodeVideo", "NodeAudio", "NodeIFrame", "NodeHTMLBlock"].includes(type) && !protyle.disabled) {
            buildGutterMediaMenu(protyle, nodeElement, type).forEach(item => {
                getSiyuanGlobalMenus().menu.append(new MenuItem(item).element);
            });
        } else if (type === "NodeBlockQueryEmbed" && !protyle.disabled) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_blockEmbed", type: "separator" }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem(buildGutterEmbedMenu(protyle, nodeElement, id)).element);
        } else if (type === "NodeHeading" && !protyle.disabled) {
            const { 标题级别转换, 其他操作 } = buildGutterHeadingMenu({
                protyle,
                id,
                subType: subType as "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
                nodeElement
            });

            if (标题级别转换.length > 0) {
                getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_1", type: "separator" }).element);
                getSiyuanGlobalMenus().menu.append(new MenuItem({
                    id: "tWithSubtitle",
                    type: "submenu",
                    icon: "iconRefresh",
                    label: siyuanI18n.tWithSubtitle,
                    submenu: 标题级别转换
                }).element);
            }

            for (const item of 其他操作) {
                getSiyuanGlobalMenus().menu.append(new MenuItem(item).element);
            }
        }
        getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);
        if (!protyle.options.backlinkData) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "enter",
                accelerator: `${getSiyuanConfig().keymap.general.enter.custom ? updateHotkeyTip(getSiyuanConfig().keymap.general.enter.custom) + "/" : ""}${updateHotkeyAfterTip("⌘" + siyuanI18n.click)}`,
                label: siyuanI18n.enter,
                click: () => {
                    zoomOut({ protyle, id });
                }
            }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "enterBack",
                accelerator: getSiyuanConfig().keymap.general.enterBack.custom,
                label: siyuanI18n.enterBack,
                click: () => {
                    enterBack(protyle, id);
                }
            }).element);
        } else {
            /// #if !MOBILE
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "enter",
                accelerator: `${updateHotkeyTip(getSiyuanConfig().keymap.general.enter.custom)}/${updateHotkeyTip("⌘" + siyuanI18n.click)}`,
                label: siyuanI18n.openBy,
                click: () => {
                    checkFold(id, (zoomIn, action) => {
                        openFileById({
                            app: protyle.app,
                            id,
                            action,
                            zoomIn
                        });
                    });
                }
            }).element);
            /// #endif
        }
        if (!protyle.disabled) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "insertBefore",
                icon: "iconBefore",
                label: siyuanI18n.insertBefore,
                accelerator: getSiyuanConfig().keymap.editor.general.insertBefore.custom,
                click() {
                    hideElements(["select"], protyle);
                    countBlockWord([], protyle.block.rootID);
                    insertEmptyBlock(protyle, "beforebegin", id);
                }
            }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "insertAfter",
                icon: "iconAfter",
                label: siyuanI18n.insertAfter,
                accelerator: getSiyuanConfig().keymap.editor.general.insertAfter.custom,
                click() {
                    hideElements(["select"], protyle);
                    countBlockWord([], protyle.block.rootID);
                    insertEmptyBlock(protyle, "afterend", id);
                }
            }).element);
            const countElement = nodeElement.lastElementChild.querySelector(".protyle-attr--refcount");
            if (countElement && countElement.textContent) {
                transferBlockRef(id);
            }
        }
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "jumpTo",
            type: "submenu",
            label: siyuanI18n.jumpTo,
            submenu: [{
                id: "jumpToParentPrev",
                iconHTML: "",
                label: siyuanI18n.jumpToParentPrev,
                accelerator: getSiyuanConfig().keymap.editor.general.jumpToParentPrev.custom,
                click() {
                    hideElements(["select"], protyle);
                    jumpToParent(protyle, nodeElement, "previous");
                }
            }, {
                iconHTML: "",
                id: "jumpToParentNext",
                label: siyuanI18n.jumpToParentNext,
                accelerator: getSiyuanConfig().keymap.editor.general.jumpToParentNext.custom,
                click() {
                    hideElements(["select"], protyle);
                    jumpToParent(protyle, nodeElement, "next");
                }
            }, {
                iconHTML: "",
                id: "jumpToParent",
                label: siyuanI18n.jumpToParent,
                accelerator: getSiyuanConfig().keymap.editor.general.jumpToParent.custom,
                click() {
                    hideElements(["select"], protyle);
                    jumpToParent(protyle, nodeElement, "parent");
                }
            }]
        }).element);

        getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_3", type: "separator" }).element);

        if (type !== "NodeThematicBreak") {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "fold",
                label: siyuanI18n.fold,
                accelerator: `${updateHotkeyTip(getSiyuanConfig().keymap.editor.general.collapse.custom)}/${updateHotkeyTip("⌥" + siyuanI18n.click)}`,
                click() {
                    setFold(protyle, nodeElement);
                    focusBlock(nodeElement);
                }
            }).element);
            if (!protyle.disabled) {
                getSiyuanGlobalMenus().menu.append(new MenuItem({
                    id: "attr",
                    label: siyuanI18n.attr,
                    icon: "iconAttr",
                    accelerator: getSiyuanConfig().keymap.editor.general.attr.custom + "/" + updateHotkeyTip("⇧" + siyuanI18n.click),
                    click() {
                        openAttr(nodeElement, "bookmark", protyle);
                    }
                }).element);
            }
        }
        if (!protyle.disabled) {
            const appearanceElement = new MenuItem({
                id: "appearance",
                label: siyuanI18n.appearance,
                icon: "iconFont",
                accelerator: getSiyuanConfig().keymap.editor.insert.appearance.custom,
                click: () => {
                    /// #if MOBILE
                    this.showMobileAppearance(protyle);
                    /// #else
                    protyle.toolbar.element.classList.add("fn__none");
                    protyle.toolbar.subElement.innerHTML = "";
                    protyle.toolbar.subElement.style.width = "";
                    protyle.toolbar.subElement.style.padding = "";
                    protyle.toolbar.subElement.append(appearanceMenu(protyle, [nodeElement]));
                    protyle.toolbar.subElement.style.zIndex = (++window.siyuan.zIndex).toString();
                    protyle.toolbar.subElement.classList.remove("fn__none");
                    protyle.toolbar.subElementCloseCB = undefined;
                    const position = nodeElement.getBoundingClientRect();
                    setPosition(protyle.toolbar.subElement, position.left, position.top);
                    /// #endif
                }
            }).element;
            getSiyuanGlobalMenus().menu.append(appearanceElement);
            if (!isMobile()) {
                appearanceElement.lastElementChild.classList.add("b3-menu__submenu--row");
            }
            getSiyuanGlobalMenus().menu.append(new MenuItem(buildGutterAlignMenu([nodeElement], protyle)).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem(buildGutterWidthsMenu([nodeElement], protyle)).element);
            // const heightsMenu = buildGutterHeightsMenu([nodeElement], protyle);
            // if (heightsMenu) {
            //     getSiyuanGlobalMenus().menu.append(new MenuItem(heightsMenu).element);
            // }
        }
        getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_4", type: "separator" }).element);
        if (getSiyuanConfig().cloudRegion === 0 &&
            !["NodeThematicBreak", "NodeBlockQueryEmbed", "NodeIFrame", "NodeHTMLBlock", "NodeWidget", "NodeVideo", "NodeAudio"].includes(type) &&
            getContenteditableElement(nodeElement)?.textContent.trim() !== "" &&
            (type !== "NodeCodeBlock" || (type === "NodeCodeBlock" && !nodeElement.getAttribute("data-subtype")))) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "wechatReminder",
                icon: "iconMp",
                label: siyuanI18n.wechatReminder,
                ignore: getSiyuanConfig().readonly,
                click() {
                    openWechatNotify(nodeElement);
                }
            }).element);
        }
        if (type !== "NodeThematicBreak" && !getSiyuanConfig().readonly) {
            const isCardMade = nodeElement.hasAttribute(Constants.CUSTOM_RIFF_DECKS);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: isCardMade ? "removeCard" : "quickMakeCard",
                icon: "iconRiffCard",
                label: isCardMade ? siyuanI18n.removeCard : siyuanI18n.quickMakeCard,
                accelerator: getSiyuanConfig().keymap.editor.general.quickMakeCard.custom,
                click() {
                    quickMakeCard(protyle, [nodeElement]);
                }
            }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "addToDeck",
                label: siyuanI18n.addToDeck,
                ignore: !getSiyuanConfig().flashcard.deck,
                icon: "iconRiffCard",
                click() {
                    makeCard(protyle.app, [id]);
                }
            }).element);
            getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_5", type: "separator" }).element);
        }

        if (protyle?.app?.plugins) {
            emitOpenMenu({
                plugins: protyle.app.plugins,
                type: "click-blockicon",
                detail: {
                    protyle,
                    blockElements: [nodeElement]
                },
                separatorPosition: "bottom",
            });
        }

        let updateHTML = nodeElement.getAttribute("updated") || "";
        if (updateHTML) {
            updateHTML = `${siyuanI18n.modifiedAt} ${dayjs(updateHTML).format("YYYY-MM-DD HH:mm:ss")}<br>`;
        }
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "updateAndCreatedAt",
            iconHTML: "",
            type: "readonly",
            label: `${updateHTML}${siyuanI18n.createdAt} ${dayjs(id.substr(0, 14)).format("YYYY-MM-DD HH:mm:ss")}`,
        }).element);
        return getSiyuanGlobalMenus().menu;
    }




    private genCopyTextRef(selectsElement: Element[]): false | IMenu {
        if (isNotEditBlock(selectsElement[0])) {
            return false;
        }
        return {
            id: "copyText",
            iconHTML: "",
            accelerator: getSiyuanConfig().keymap.editor.general.copyText.custom,
            label: siyuanI18n.copyText,
            click() {
                // 用于标识复制文本 *
                selectsElement[0].setAttribute("data-reftext", "true");
                focusByRange(getEditorRange(selectsElement[0]));
                document.execCommand("copy");
            }
        };
    }

    public render(protyle: IProtyle, element: Element, target?: Element) {
        // https://github.com/siyuan-note/siyuan/issues/4659
        if (protyle.title && protyle.title.element.getAttribute("data-render") !== "true") {
            return;
        }
        // 防止划选时触碰图标导致 hl 无法移除
        const selectElement = protyle.element.querySelector(".protyle-select");
        if (selectElement && !selectElement.classList.contains("fn__none")) {
            return;
        }
        let html = "";
        let nodeElement = element;
        let space = 0;
        let index = 0;
        let listItem;
        let hideParent = false;
        while (nodeElement) {
            let parentElement = hasClosestBlock(nodeElement.parentElement);
            if (!isInEmbedBlock(nodeElement)) {
                let type;
                if (!hideParent) {
                    type = nodeElement.getAttribute("data-type");
                }
                let dataNodeId = nodeElement.getAttribute("data-node-id");
                if (type === "NodeAttributeView" && target) {
                    const rowElement = hasClosestByClassName(target, "av__row");
                    if (rowElement && !rowElement.classList.contains("av__row--header") && rowElement.dataset.id) {
                        element = rowElement;
                        const bodyElement = hasClosestByClassName(rowElement, "av__body") as HTMLElement;
                        let iconAriaLabel = isMac() ? siyuanI18n.rowTip : siyuanI18n.rowTip.replace("⇧", "Shift+");
                        if (protyle.disabled) {
                            iconAriaLabel = siyuanI18n.rowTip.substring(0, siyuanI18n.rowTip.indexOf("<br"));
                        } else if (rowElement.querySelector('[data-dtype="block"]')?.getAttribute("data-detached") === "true") {
                            iconAriaLabel = siyuanI18n.rowTip.substring(0, siyuanI18n.rowTip.lastIndexOf("<br"));
                        }
                        html = `<button data-type="NodeAttributeViewRowMenu" data-node-id="${dataNodeId}" data-row-id="${rowElement.dataset.id}" data-group-id="${bodyElement.dataset.groupId || ""}" class="ariaLabel" data-position="parentW" aria-label="${iconAriaLabel}"><svg><use xlink:href="#iconDrag"></use></svg><span ${protyle.disabled ? "" : 'draggable="true" class="fn__grab"'}></span></button>`;
                        if (!protyle.disabled) {
                            html = `<button data-type="NodeAttributeViewRow" data-node-id="${dataNodeId}" data-row-id="${rowElement.dataset.id}" data-group-id="${bodyElement.dataset.groupId || ""}" class="ariaLabel" data-position="parentW" aria-label="${isMac() ? siyuanI18n.addBelowAbove : siyuanI18n.addBelowAbove.replace("⌥", "Alt+")}"><svg><use xlink:href="#iconAdd"></use></svg></button>${html}`;
                        }
                        break;
                    }
                }
                if (index === 0) {
                    // 不单独显示，要不然在块的间隔中，gutter 会跳来跳去的
                    if (["NodeBlockquote", "NodeList", "NodeCallout", "NodeSuperBlock"].includes(type)) {
                        if (target && type === "NodeCallout" && hasTopClosestByClassName(target, "callout-info")) {
                            // Callout 标题需显示
                        } else {
                            return;
                        }
                    }

                    let topElement = getTopAloneElement(nodeElement);
                    // 提示下方仅有单个列表
                    if (topElement.classList.contains("callout") && !nodeElement.classList.contains("callout") &&
                        getParentBlock(nodeElement) !== topElement) {
                        topElement = topElement.querySelector("[data-node-id]");
                    }
                    listItem = topElement.querySelector(".li") || topElement.querySelector(".list");
                    // 嵌入块中有列表时块标显示位置错误 https://github.com/siyuan-note/siyuan/issues/6254
                    if (isInEmbedBlock(listItem) || isInAVBlock(listItem)) {
                        listItem = undefined;
                    }
                    // 标题必须显示
                    if (topElement !== nodeElement && type !== "NodeHeading" && !topElement.classList.contains("callout")) {
                        nodeElement = topElement;
                        parentElement = hasClosestBlock(nodeElement.parentElement);
                        type = nodeElement.getAttribute("data-type");
                        dataNodeId = nodeElement.getAttribute("data-node-id");
                    }
                }
                if (type === "NodeListItem" && index === 1) {
                    // 列表项中第一层不显示
                    html = "";
                }
                index += 1;
                let gutterTip = this.gutterTip;
                if (protyle.disabled) {
                    gutterTip = this.gutterTip.split("<br>").splice(0, 2).join("<br>");
                }

                let popoverHTML = "";
                if (protyle.options.backlinkData) {
                    popoverHTML = `class="popover__block" data-id="${dataNodeId}"`;
                }
                const buttonHTML = `<button class="ariaLabel" data-position="parentW" aria-label="${gutterTip}" 
data-type="${type}" data-subtype="${nodeElement.getAttribute("data-subtype")}" data-node-id="${dataNodeId}">
    <svg><use xlink:href="#${getIconByType(type, nodeElement.getAttribute("data-subtype"))}"></use></svg>
    <span ${popoverHTML} ${protyle.disabled ? "" : 'draggable="true"'}></span>
</button>`;
                if (!hideParent) {
                    html = buttonHTML + html;
                }
                let foldHTML = "";
                if (type === "NodeListItem" && nodeElement.childElementCount > 3 || type === "NodeHeading") {
                    const fold = nodeElement.getAttribute("fold");
                    foldHTML = `<button class="ariaLabel" data-position="parentW" aria-label="${siyuanI18n.fold}" 
data-type="fold" style="cursor:inherit;"><svg style="width: 10px${fold && fold === "1" ? "" : ";transform:rotate(90deg)"}"><use xlink:href="#iconPlay"></use></svg></button>`;
                }
                if (type === "NodeListItem" || type === "NodeList") {
                    listItem = nodeElement;
                    if (type === "NodeListItem" && nodeElement.childElementCount > 3) {
                        html = buttonHTML + foldHTML;
                    }
                }
                if (type === "NodeHeading") {
                    html = html + foldHTML;
                }
                if (["NodeBlockquote", "NodeCallout"].includes(type)) {
                    space += 8;
                }
                if ((nodeElement.previousElementSibling && nodeElement.previousElementSibling.getAttribute("data-node-id")) ||
                    nodeElement.parentElement.classList.contains("callout-content")) {
                    // 前一个块存在时，只显示到当前层级
                    hideParent = true;
                    // 由于折叠块的第二个子块在界面上不显示，因此移除块标 https://github.com/siyuan-note/siyuan/issues/14304
                    if (parentElement && parentElement.getAttribute("fold") === "1") {
                        return;
                    }
                    // 列表项中的引述块中的第二个段落块块标和引述块左侧样式重叠
                    if (parentElement && ["NodeBlockquote", "NodeCallout"].includes(parentElement.getAttribute("data-type"))) {
                        space += 8;
                    }
                }
            }

            if (parentElement) {
                nodeElement = parentElement;
            } else {
                break;
            }
        }
        let match = true;
        const buttonsElement = this.element.querySelectorAll("button");
        if (buttonsElement.length !== html.split("</button>").length - 1) {
            match = false;
        } else {
            Array.from(buttonsElement).find(item => {
                const id = item.getAttribute("data-node-id");
                if (id && html.indexOf(id) === -1) {
                    match = false;
                    return true;
                }
                const rowId = item.getAttribute("data-row-id");
                if ((rowId && html.indexOf(rowId) === -1) || (!rowId && html.indexOf("NodeAttributeViewRowMenu") > -1)) {
                    match = false;
                    return true;
                }
            });
        }
        // 防止抖动 https://github.com/siyuan-note/siyuan/issues/4166
        if (match && this.element.childElementCount > 0) {
            this.element.classList.remove("fn__none");
            return;
        }
        this.element.innerHTML = html;
        this.element.classList.remove("fn__none");
        this.element.style.width = "";
        const contentTop = protyle.contentElement.getBoundingClientRect().top;
        let rect = element.getBoundingClientRect();
        let marginHeight = 0;
        if (listItem && !getSiyuanConfig().editor.rtl && getComputedStyle(element).direction !== "rtl" &&
            // 提示下有列表
            !element.classList.contains("callout")) {
            rect = listItem.firstElementChild.getBoundingClientRect();
            space = 0;
        } else if (nodeElement.getAttribute("data-type") === "NodeBlockQueryEmbed") {
            rect = nodeElement.getBoundingClientRect();
            space = 0;
        } else if (!element.classList.contains("av__row")) {
            if (rect.height < Math.floor(getSiyuanConfig().editor.fontSize * 1.625) + 8 ||
                (rect.height > Math.floor(getSiyuanConfig().editor.fontSize * 1.625) + 8 && rect.height < Math.floor(getSiyuanConfig().editor.fontSize * 1.625) * 2 + 8)) {
                marginHeight = (rect.height - this.element.clientHeight) / 2;
            } else if ((nodeElement.getAttribute("data-type") === "NodeAttributeView" || element.getAttribute("data-type") === "NodeAttributeView") &&
                contentTop < rect.top) {
                marginHeight = 8;
            }
        }
        this.element.style.top = `${Math.max(rect.top, contentTop) + marginHeight}px`;
        let left = rect.left - this.element.clientWidth - space;
        if ((nodeElement.getAttribute("data-type") === "NodeBlockQueryEmbed" && this.element.childElementCount === 1)) {
            // 嵌入块为列表时
            left = nodeElement.getBoundingClientRect().left - this.element.clientWidth - space;
        } else if (element.classList.contains("av__row")) {
            // 为数据库行
            left = nodeElement.getBoundingClientRect().left - this.element.clientWidth - space + parseInt(getComputedStyle(nodeElement).paddingLeft);
        }
        this.element.style.left = `${left}px`;
        if (left < this.element.parentElement.getBoundingClientRect().left) {
            this.element.style.width = "24px";
            // 需加 2，否则和折叠标题无法对齐
            this.element.style.left = `${rect.left - this.element.clientWidth - space / 2 + 3}px`;
            html = "";
            Array.from(this.element.children).reverse().forEach((item, index) => {
                if (index !== 0) {
                    (item.firstElementChild as HTMLElement).style.height = "14px";
                }
                html += item.outerHTML;
            });
            this.element.innerHTML = html;
        } else {
            this.element.querySelectorAll("svg").forEach(item => {
                item.style.height = "";
            });
        }
    }
}
