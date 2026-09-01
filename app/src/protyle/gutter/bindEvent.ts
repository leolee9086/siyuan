import {
    hasClosestBlock,
    hasClosestByClassName,
    hasClosestByTag,
    hasTopClosestByClassName,
    isInAVBlock,
    isInEmbedBlock
} from "../util/hasClosest";
import { foldHeadingGroup, setFold } from "../util/blockFold";
import {openAttr} from "../../menus/commonMenuItem/fileAttr/openAttr";
import {openFileAttr} from "../../menus/commonMenuItem/fileAttr/openFileAttr";
import { isOnlyMeta } from "../util/compatibility";
import { focusByRange, getEditorRange } from "../util/selection";
import { hideElements } from "../ui/hideElements";
import { getContenteditableElement } from "../wysiwyg/getBlock";
import * as dayjs from "dayjs";
import { fetchPost } from "../../util/network/fetch";
import { genEmptyElement } from "../../block/element.factory";
import { getLangByType } from "../../block/util";
import { Constants } from "../../constants";
import { hideTooltip } from "../runtime/dialog.port";
import {insertAttrViewBlockAnimation} from "../render/av/row";
import {updateHeader} from "../render/av/selection/header";
import { avContextmenu } from "../render/av/action/contextmenu";
import {transaction} from "../wysiwyg/transaction/submit";
import {getAVFilteredTipContext, getAVViewID} from "../render/av/filteredTip";
import { setDragTipGhost } from "../util/dragTip";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { openFileById } from "../../editor/utils.openFileById";
import { isMobile } from "../../platform";
import {checkFold} from "../../block/fold/checkFold";
import { clearSelect } from "../util/clearSelect";
import { buildGutterMenu } from "./buildGutterMenu";
import { insertEmptyBlock } from "../../block/util";
import { countBlockWord } from "../runtime/status.port";
import {isEncryptedBox} from "../../util/file/notebook/store";
import {getGutterNodeElement} from "./gutter.node";

export const isMatchNode = (item: Element, gutterElement: Element) => {
    const itemRect = item.getBoundingClientRect();
    // 原本为4，由于 https://github.com/siyuan-note/siyuan/issues/12166 改为 6
    let gutterTop = gutterElement.getBoundingClientRect().top + 6;
    if (itemRect.height < Math.floor(getSiyuanConfig().editor.fontSize * 1.625) + 8) {
        gutterTop = gutterTop - (itemRect.height - gutterElement.clientHeight) / 2;
    }
    return itemRect.top <= gutterTop && itemRect.bottom >= gutterTop;
};

export const bindEvent = (protyle: IProtyle, gutterElement: HTMLElement) => {
    gutterElement.addEventListener("dragstart", (event: DragEvent & { target: HTMLElement }) => {
        hideTooltip();
        getSiyuanGlobalMenus().menu.remove();
        const buttonElement = event.target.parentElement;
        if (buttonElement.dataset.embedId) {
            event.preventDefault();
            return;
        }
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
                    if (!isInEmbedBlock(item) && isMatchNode(item, gutterElement)) {
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
                ghostElement.append(item.cloneNode(true));
            }
        });
        ghostElement.setAttribute("style", `position:fixed;opacity:.1;width:${selectElements[0].clientWidth}px;padding:0;`);
        document.body.append(ghostElement);
        const isBlockDrag = !buttonElement.dataset.rowId;
        setDragTipGhost(ghostElement, 0, 0);
        event.dataTransfer.setDragImage(ghostElement, 0, 0);
        if (window.siyuan.touchDragActive) {
            window.siyuan.touchDragGhost = ghostElement;
        } else {
            setTimeout(() => {
                ghostElement.remove();
            });
        }
        if (isBlockDrag) {
            const text = getContenteditableElement(selectElements[0] as HTMLElement)?.textContent?.trim() || "";
            // 数据库块若无标题，优先用当前视图名，最后兜底为"数据库"
            let title = text;
            if (!title && buttonElement.getAttribute("data-type") === "NodeAttributeView") {
                title = (selectElements[0] as HTMLElement)?.querySelector(".av__views .item--focus")?.textContent?.trim() ||
                    window.siyuan.languages.database;
            }
            window.siyuan.dragTitle = title;
        }
        buttonElement.style.opacity = "0.38";
        window.siyuan.dragElement = avElement as HTMLElement || protyle.wysiwyg.element;
        event.dataTransfer.setData(`${Constants.SIYUAN_DROP_GUTTER}${buttonElement.getAttribute("data-type")}${Constants.ZWSP}${buttonElement.getAttribute("data-subtype")}${Constants.ZWSP}${selectIds}${Constants.ZWSP}${getSiyuanConfig().system.workspaceDir}`,
            protyle.wysiwyg.element.innerHTML);
    });
    gutterElement.addEventListener("dragend", () => {
        gutterElement.querySelectorAll("button").forEach((item) => {
            item.style.opacity = "";
        });
        window.siyuan.dragElement = undefined;
        window.siyuan.dragTitle = "";
    });
    gutterElement.addEventListener("click", (event: MouseEvent & { target: HTMLInputElement }) => {
        const buttonElement = hasClosestByTag(event.target, "BUTTON");
        if (!buttonElement) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        hideTooltip();
        clearSelect(["cell", "img"], protyle.wysiwyg.element);
        // 框线点击：若鼠标在块标范围内（框线::before 截获了块标点击），转发为块标菜单；否则无操作
        if (buttonElement.classList.contains("protyle-gutters__line")) {
            if (activeBlockButton && !protyle.disabled) {
                const br = activeBlockButton.getBoundingClientRect();
                if (event.clientX >= br.left && event.clientX <= br.right &&
                    event.clientY >= br.top && event.clientY <= br.bottom) {
                    buildGutterMenu({ protyle, buttonElement: activeBlockButton as HTMLElement });
                    if (!protyle.toolbar.range) {
                        protyle.toolbar.range = getEditorRange(getGutterNodeElement(protyle, activeBlockButton) || protyle.wysiwyg.element.firstElementChild);
                    }
                    getSiyuanGlobalMenus().menu.popup({ x: br.left, y: br.bottom, isLeft: true });
                    focusByRange(protyle.toolbar.range);
                }
            }
            return;
        }
        const id = buttonElement.getAttribute("data-node-id");
        if (!id) {
            if (buttonElement.getAttribute("disabled")) {
                return;
            }
            buttonElement.setAttribute("disabled", "disabled");
            const blockButtonElement = buttonElement.previousElementSibling || buttonElement.nextElementSibling;
            const foldElement = blockButtonElement ? getGutterNodeElement(protyle, blockButtonElement) : undefined;
            if (!foldElement) {
                return;
            }
            if (event.altKey) {
                if (foldElement.getAttribute("data-type") === "NodeHeading") {
                    foldHeadingGroup(protyle, foldElement, "children").finally(() => {
                        buttonElement.removeAttribute("disabled");
                    });
                } else {
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
                }
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
        if (buttonElement.dataset.type === "gutterPlusBefore" || buttonElement.dataset.type === "gutterPlusAfter") {
            // 块标边缘+号：在对应块上方/下方插入新块，复用 insertEmptyBlock（列表项自动生成新列表项）
            if (protyle.disabled || !id) {
                return;
            }
            hideElements(["gutter"], protyle);
            countBlockWord([], protyle.block.rootID, false, protyle.options.status);
            insertEmptyBlock(protyle, buttonElement.dataset.type === "gutterPlusBefore" ? "beforebegin" : "afterend", id);
            return;
        }
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
                    viewID: getAVViewID(blockElement as HTMLElement),
                    context: getAVFilteredTipContext("target", protyle),
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
                    gutterElement.querySelectorAll("button").forEach(item => {
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
                protyle.getInstance().zoomOut({id});
            }
        } else if (event.altKey) {
            const foldElement = getGutterNodeElement(protyle, buttonElement);
            if (!foldElement) {
                return;
            }
            if (buttonElement.getAttribute("data-type") === "NodeHeading") {
                foldHeadingGroup(protyle, foldElement, "siblings");
            } else if (buttonElement.getAttribute("data-type") === "NodeListItem" && foldElement.parentElement.getAttribute("data-node-id")) {
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
        } else if (event.shiftKey && !protyle.disabled && !isEncryptedBox(protyle.notebookId)) {
            // 不使用 window.siyuan.shiftIsPressed ，否则窗口未激活时按 Shift 点击块标无法打开属性面板 https://github.com/siyuan-note/siyuan/issues/15075
            openAttr(getGutterNodeElement(protyle, buttonElement), "bookmark", protyle);
        } else if (!window.siyuan.ctrlIsPressed && !window.siyuan.altIsPressed && !window.siyuan.shiftIsPressed) {
            buildGutterMenu({ protyle, buttonElement });
            // https://ld246.com/article/1648433751993
            if (!protyle.toolbar.range) {
                protyle.toolbar.range = getEditorRange(getGutterNodeElement(protyle, buttonElement) || protyle.wysiwyg.element.firstElementChild);
            }
            if (isMobile) {
                getSiyuanGlobalMenus().menu.fullscreen();
            }
            if (!isMobile) {
                getSiyuanGlobalMenus().menu.popup({ x: gutterRect.left, y: gutterRect.bottom, isLeft: true });
                const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
                getSiyuanGlobalMenus().menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
                focusByRange(protyle.toolbar.range);
            }
        }
    });
    gutterElement.addEventListener("contextmenu", (event: MouseEvent & { target: HTMLInputElement }) => {
        const buttonElement = hasClosestByTag(event.target, "BUTTON");
        if (!buttonElement || buttonElement.getAttribute("data-type") === "fold") {
            return;
        }
        if (!window.siyuan.ctrlIsPressed && !window.siyuan.altIsPressed && !window.siyuan.shiftIsPressed) {
            hideTooltip();
            clearSelect(["cell", "img"], protyle.wysiwyg.element);
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
                buildGutterMenu({ protyle, buttonElement });
                if (!protyle.toolbar.range) {
                    protyle.toolbar.range = getEditorRange(
                        getGutterNodeElement(protyle, buttonElement) ||
                        protyle.wysiwyg.element.firstElementChild);
                }
                if (isMobile) {
                    getSiyuanGlobalMenus().menu.fullscreen();
                }
                if (!isMobile) {
                    getSiyuanGlobalMenus().menu.popup({ x: gutterRect.left, y: gutterRect.bottom, isLeft: true });
                    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
                    getSiyuanGlobalMenus().menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
                    focusByRange(protyle.toolbar.range);
                }
            }
        }
        event.preventDefault();
        event.stopPropagation();
    });
    // 延迟隐藏计时器，鼠标在块标/框线/+号之间移动时提供缓冲
    let hidePlusTimeout: number;
    // 当前悬浮的块标 button，供框线点击坐标判断
    let activeBlockButton: Element | undefined;
    const hideInsert = () => {
        activeBlockButton = undefined;
        gutterElement.querySelectorAll(".protyle-gutters__line, .protyle-gutters__plus").forEach(item => {
            (item as HTMLElement).style.display = "none";
        });
    };
    gutterElement.addEventListener("mouseleave", (event: MouseEvent) => {
        const related = event.relatedTarget as HTMLElement;
        if (related && (related.classList.contains("protyle-gutters__line") || related.classList.contains("protyle-gutters__plus"))) {
            return;
        }
        Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--hl, .av__row--hl")).forEach(item => {
            item.classList.remove("protyle-wysiwyg--hl", "av__row--hl");
        });
        window.clearTimeout(hidePlusTimeout);
        hidePlusTimeout = window.setTimeout(hideInsert, 200);
        event.preventDefault();
        event.stopPropagation();
    });
    // 双元素交互：悬浮块标显示框线（贴边不动），悬浮框线显示+号（独立元素外偏定位）
    gutterElement.addEventListener("mousemove", (event: MouseEvent) => {
        const lineBefore = gutterElement.querySelector('.protyle-gutters__line[data-type="gutterLineBefore"]') as HTMLElement;
        const lineAfter = gutterElement.querySelector('.protyle-gutters__line[data-type="gutterLineAfter"]') as HTMLElement;
        const plusBefore = gutterElement.querySelector('.protyle-gutters__plus[data-type="gutterPlusBefore"]') as HTMLElement;
        const plusAfter = gutterElement.querySelector('.protyle-gutters__plus[data-type="gutterPlusAfter"]') as HTMLElement;
        if (protyle.disabled || !lineBefore || !lineAfter || !plusBefore || !plusAfter) {
            return;
        }
        const lineEl = hasClosestByClassName(event.target as HTMLElement, "protyle-gutters__line");
        const plusEl = hasClosestByClassName(event.target as HTMLElement, "protyle-gutters__plus");
        const hoverEl = lineEl || plusEl;
        if (hoverEl) {
            window.clearTimeout(hidePlusTimeout);
            if (activeBlockButton) {
                const br = activeBlockButton.getBoundingClientRect();
                if (event.clientX >= br.left && event.clientX <= br.right &&
                    event.clientY >= br.top && event.clientY <= br.bottom) {
                    return;
                }
            }
            const isBefore = hoverEl.getAttribute("data-type")!.includes("Before");
            plusBefore.style.display = isBefore ? "" : "none";
            plusAfter.style.display = isBefore ? "none" : "";
            lineBefore.style.opacity = "0";
            lineAfter.style.opacity = "0";
            return;
        }
        const buttonElement = hasClosestByTag(event.target as HTMLElement, "BUTTON");
        if (!buttonElement || buttonElement.classList.contains("protyle-gutters__line") || buttonElement.classList.contains("protyle-gutters__plus")) {
            return;
        }
        const type = buttonElement.getAttribute("data-type");
        const id = buttonElement.getAttribute("data-node-id");
        if (type === "fold" || type === "NodeAttributeViewRow" || type === "NodeAttributeViewRowMenu" || !id) {
            hideInsert();
            return;
        }
        plusBefore.dataset.nodeId = id;
        plusAfter.dataset.nodeId = id;
        activeBlockButton = buttonElement;
        const rect = buttonElement.getBoundingClientRect();
        const compressed = gutterElement.style.width === "24px";
        plusBefore.setAttribute("aria-label", compressed ? "" : window.siyuan.languages.insertBefore);
        plusAfter.setAttribute("aria-label", compressed ? "" : window.siyuan.languages.insertAfter);
        plusBefore.style.display = "none";
        plusAfter.style.display = "none";
        if (compressed) {
            const iconRect = buttonElement.querySelector("svg")!.getBoundingClientRect();
            const centerY = iconRect.top + iconRect.height / 2;
            const lineH = Math.max(8, iconRect.height / 2 - 1);
            const plusSize = 16;
            const rightX = rect.right + 1;
            lineBefore.style.display = "";
            lineBefore.style.opacity = "1";
            lineBefore.style.width = "2px";
            lineBefore.style.height = `${lineH}px`;
            lineBefore.style.left = `${rightX}px`;
            lineBefore.style.top = `${iconRect.top - 1}px`;
            lineAfter.style.display = "";
            lineAfter.style.opacity = "1";
            lineAfter.style.width = "2px";
            lineAfter.style.height = `${lineH}px`;
            lineAfter.style.left = `${rightX}px`;
            lineAfter.style.top = `${centerY + 1}px`;
            plusBefore.style.width = `${plusSize}px`;
            plusBefore.style.height = `${plusSize}px`;
            plusBefore.style.left = `${rightX + 4}px`;
            plusBefore.style.top = `${iconRect.top + lineH / 2 - plusSize / 2}px`;
            plusAfter.style.width = `${plusSize}px`;
            plusAfter.style.height = `${plusSize}px`;
            plusAfter.style.left = `${rightX + 4}px`;
            plusAfter.style.top = `${centerY + 1 + lineH / 2 - plusSize / 2}px`;
            hideTooltip();
        } else {
            const lineW = 10;
            const left = rect.left + (rect.width - lineW) / 2;
            const plusSize = 16;
            const plusLeft = rect.left + (rect.width - plusSize) / 2;
            lineBefore.style.display = "";
            lineBefore.style.opacity = "1";
            lineBefore.style.width = `${lineW}px`;
            lineBefore.style.height = "2px";
            lineBefore.style.left = `${left}px`;
            lineBefore.style.top = `${rect.top - 4}px`;
            lineAfter.style.display = "";
            lineAfter.style.opacity = "1";
            lineAfter.style.width = `${lineW}px`;
            lineAfter.style.height = "2px";
            lineAfter.style.left = `${left}px`;
            lineAfter.style.top = `${rect.bottom + 2}px`;
            plusBefore.style.width = `${plusSize}px`;
            plusBefore.style.height = `${plusSize}px`;
            plusBefore.style.left = `${plusLeft}px`;
            plusBefore.style.top = `${rect.top - 5 - plusSize / 2 + 1}px`;
            plusAfter.style.width = `${plusSize}px`;
            plusAfter.style.height = `${plusSize}px`;
            plusAfter.style.left = `${plusLeft}px`;
            plusAfter.style.top = `${rect.bottom + 3 - plusSize / 2 + 1}px`;
        }
        window.clearTimeout(hidePlusTimeout);
    });
    // https://github.com/siyuan-note/siyuan/issues/12751
    gutterElement.addEventListener("mousewheel", (event) => {
        hideElements(["gutter"], protyle);
        event.stopPropagation();
    }, { passive: true });
};
