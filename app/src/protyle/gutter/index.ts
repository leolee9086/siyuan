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
import { openAttr } from "../../menus/commonMenuItem";
import { openFileAttr } from "../../menus/commonMenuItem.openFileAttr";
import { openWechatNotify } from "../../menus/commonMenuItem.openWechatNotify";
import {
    isInAndroid,
    isInHarmony,
    isMac,
    isOnlyMeta,
    openByMobile,
    updateHotkeyAfterTip,
    updateHotkeyTip,
    writeText
} from "../util/compatibility";

import { removeBlock } from "../wysiwyg/remove";
import { focusBlock, focusByRange, getEditorRange } from "../util/selection";
import { hideElements } from "../ui/hideElements";
import { highlightRender } from "../render/highlightRender";

import { getContenteditableElement, getParentBlock, getTopAloneElement } from "../wysiwyg/getBlock";
import * as dayjs from "dayjs";
import { fetchPost } from "../../util/fetch";
import { cancelSB, genEmptyElement, getLangByType, insertEmptyBlock, jumpToParent, } from "../../block/util";
import { countBlockWord } from "../../layout/status";
import { Constants } from "../../constants";
import { mathRender } from "../render/mathRender";

import { useShell } from "../../util/pathName";
import { movePathTo } from "../../util/pathName/movePathTo";
import { hintMoveBlock } from "../hint/extend";
import { makeCard, quickMakeCard } from "../../card/makeCard";
import { transferBlockRef } from "../../menus/block";
import { isMobile } from "../../util/functions";
import { isMobile } from "../../util/functions";
import { activeBlur, renderTextMenu, showKeyboardToolbarUtil } from "../../mobile/util/keyboardToolbar";
import { hideTooltip } from "../../dialog/tooltip";
import { appearanceMenu } from "../toolbar/Font";
import { setPosition } from "../../util/setPosition";
import { emitOpenMenu } from "../../plugin/EventBus";
import { insertAttrViewBlockAnimation, updateHeader } from "../render/av/row";
import { avContextmenu, duplicateCompletely } from "../render/av/action";
import { transaction } from "../wysiwyg/transaction";

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
import { buildGutterCopyMenuItem } from "./buildGutterCopyMenu";
import { buildGutterTurnIntoMenuItem } from "./buildGutterTurnIntoMenu";
import { buildGutterAlignMenu, buildGutterWidthsMenu } from "./buildGutterStyleMenu";
import { showMobileAppearance } from "./showMobileAppearance";
import { buildGutterMultipleMenu } from "./buildGutterMultipleMenu";
import { buildGutterCommonMenu } from "./buildGutterCommonMenu";
import { buildGutterEditMenu } from "./buildGutterEditMenu";
import { buildGutterTypeSpecificMenu } from "./buildGutterTypeSpecificMenu";
import { buildGutterAiMenu } from "./buildGutterAiMenu";



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




    public renderMultipleMenu(protyle: IProtyle, selectsElement: Element[]) {
        return buildGutterMultipleMenu({ protyle, selectsElement });
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
        const turnIntoSubmenu = buildGutterTurnIntoMenuItem({
            nodeElement,
            id,
            type,
            subType,
            protyle,

        });
        if (turnIntoSubmenu) {
            getSiyuanGlobalMenus().menu.append(new MenuItem(turnIntoSubmenu).element);
        }
        const aiMenuItem = buildGutterAiMenu({ protyle, nodeElement });
        if (aiMenuItem) {
            getSiyuanGlobalMenus().menu.append(new MenuItem(aiMenuItem).element);
        }

        getSiyuanGlobalMenus().menu.append(new MenuItem(buildGutterCopyMenuItem({
            nodeElement,
            type,
            id,
            protyle
        })).element);
        if (!protyle.disabled) {
            for (const item of buildGutterEditMenu({ protyle, nodeElement })) {
                getSiyuanGlobalMenus().menu.append(new MenuItem(item).element);
            }
        }
        // 类型特定菜单
        buildGutterTypeSpecificMenu({ protyle, nodeElement, id, type, subType });
        // 通用操作菜单
        for (const item of buildGutterCommonMenu({ protyle, nodeElement, id, type })) {
            getSiyuanGlobalMenus().menu.append(new MenuItem(item).element);
        }
        return getSiyuanGlobalMenus().menu;
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
