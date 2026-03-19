import { focusByWbr, getEditorRange } from "../protyle/util/selection";
import { hasClosestBlock, hasClosestByClassName } from "../protyle/util/hasClosest";
import { getContenteditableElement, getParentBlock, getTopAloneElement } from "../protyle/wysiwyg/getBlock";
import { genListItemElement } from "../protyle/wysiwyg/list";
import { updateListOrder } from "../protyle/wysiwyg/list.updateOrder";
import { transaction, turnsIntoOneTransaction, updateTransaction } from "../protyle/wysiwyg/transaction";
import { scrollCenter } from "../util/DOM/highlightById";
import { Constants } from "../constants";
import { hideElements } from "../protyle/ui/hideElements";
import { blockRender } from "../protyle/render/blockRender";
import { fetchPost, fetchSyncPost } from "../util/network/fetch";
import { openFileById } from "../editor/utils.openFileById";
import { openMobileFileById } from "../mobile/editor";
import { mathRender } from "../protyle/render/mathRender";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isMobile } from "../platform";
export const cancelSB = async (protyle: IProtyle, nodeElement: Element, range?: Range) => {
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    let previousId = nodeElement.previousElementSibling ? nodeElement.previousElementSibling.getAttribute("data-node-id") : undefined;
    nodeElement.classList.remove("protyle-wysiwyg--select");
    nodeElement.removeAttribute("select-start");
    nodeElement.removeAttribute("select-end");
    const id = nodeElement.getAttribute("data-node-id");
    if (!id) {
        return {
            doOperations, undoOperations, previousId
        };
    }
    const sbElement = nodeElement.cloneNode() as HTMLElement;
    sbElement.innerHTML = nodeElement.lastElementChild.outerHTML;
    let parentID = getParentBlock(nodeElement)?.getAttribute("data-node-id");
    // 缩放和反链需要接口获取
    if (!previousId && !parentID && (protyle.block.showAll || protyle.options.backlinkData)) {
        const idData = await fetchSyncPost("/api/block/getBlockSiblingID", { id });
        previousId = idData.data.previous;
        parentID = idData.data.parent;
    } else if (!previousId && !parentID) {
        parentID = protyle.block.rootID;
    }
    undoOperations.push({
        action: "insert",
        id,
        data: sbElement.outerHTML,
        previousID: previousId,
        parentID,
    });
    const children = Array.from(nodeElement.children);
    const blockChildren = children.filter((item) => item.getAttribute("data-node-id"));
    for (const item of blockChildren) {
        const itemId = item.getAttribute("data-node-id");
        if (!itemId) {
            continue;
        }
        doOperations.push({
            action: "move",
            id: itemId,
            previousID: previousId,
            parentID,
        });
        undoOperations.push({
            action: "move",
            id: itemId,
            previousID: item.previousElementSibling ? (item.previousElementSibling.getAttribute("data-node-id") || undefined) : undefined,
            parentID: id
        });
        previousId = itemId;
    }
    if (blockChildren.length > 0) {
        doOperations.push({
            action: "delete",
            id,
        });
        const editableElement = range ? getContenteditableElement(nodeElement) : undefined;
        if (editableElement) {
            editableElement.insertAdjacentHTML("afterbegin", "<wbr>");
        }
        nodeElement.lastElementChild?.remove();
        nodeElement.replaceWith(...blockChildren);
        if (editableElement && range) {
            focusByWbr(protyle.wysiwyg.element, range);
        }
    } else {
        doOperations.push({
            action: "delete",
            id,
        });
        nodeElement.remove();
    }
    mathRender(protyle.wysiwyg.element);
    // 超级块内嵌入块无面包屑，需重新渲染 https://github.com/siyuan-note/siyuan/issues/7574
    // 超级块内嵌入块无面包屑，需重新渲染 https://github.com/siyuan-note/siyuan/issues/7574
    for (const item of doOperations) {
        if (!protyle.wysiwyg?.element) {
            continue;
        }
        const element = protyle.wysiwyg.element.querySelector(`[data-node-id="${item.id}"]`);
        if (element && element.getAttribute("data-type") === "NodeBlockQueryEmbed") {
            element.removeAttribute("data-render");
            blockRender(protyle, element);
        }
    }
    return {
        doOperations, undoOperations, previousId
    };
};

export const genSBElement = (layout: string, id?: string, attrHTML?: string) => {
    const sbElement = document.createElement("div");
    sbElement.setAttribute("data-node-id", id || Lute.NewNodeID());
    sbElement.setAttribute("data-type", "NodeSuperBlock");
    sbElement.setAttribute("class", "sb");
    sbElement.setAttribute("data-sb-layout", layout);
    sbElement.innerHTML = attrHTML || `<div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>`;
    return sbElement;
};

export const jumpToParent = (protyle: IProtyle, nodeElement: Element, type: "parent" | "next" | "previous") => {
    const handleResponse = (response: IWebSocketData) => {
        const targetId = response.data[type];
        if (!targetId) {
            return;
        }
        const action = targetId !== protyle.block.rootID && protyle.block.showAll ? [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS] : [Constants.CB_GET_FOCUS];
        // 移动端使用专用的文件打开函数
        if (isMobile) {
            openMobileFileById(protyle.app, targetId, action);
            return;
        }
        openFileById({
            app: protyle.app,
            id: targetId,
            action,
        });
    };
    fetchPost("/api/block/getBlockSiblingID", { id: nodeElement.getAttribute("data-node-id") }, handleResponse);
};

const getInsertTargetBlock = (protyle: IProtyle, id?: string, position?: InsertPosition): HTMLElement | null => {
    if (!protyle.wysiwyg?.element) {
        return null;
    }
    if (id) {
        return protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`) as HTMLElement;
    }
    const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    if (selectElements.length > 0) {
        const blockElement = position === "beforebegin" ? selectElements[0] : selectElements[selectElements.length - 1];
        hideElements(["select"], protyle);
        return blockElement as HTMLElement;
    }
    const range = getEditorRange(protyle.wysiwyg.element);
    const closest = hasClosestBlock(range.startContainer);
    if (!closest || !(closest instanceof HTMLElement)) {
        return null;
    }
    let blockElement = closest;
    blockElement = getTopAloneElement(blockElement);
    // https://github.com/siyuan-note/siyuan/issues/14720#issuecomment-2840665326
    if (blockElement.classList.contains("list")) {
        const liElement = hasClosestByClassName(range.startContainer, "li");
        if (liElement && liElement instanceof HTMLElement) {
            return liElement;
        }
    }
    if (blockElement.classList.contains("bq") || blockElement.classList.contains("callout")) {
        const innerBlock = hasClosestBlock(range.startContainer);
        if (innerBlock && innerBlock instanceof HTMLElement) {
            return innerBlock;
        }
    }
    return blockElement;
};

const createNewBlockElement = (blockElement: Element, position: InsertPosition): { newElement: HTMLElement, orderIndex: number } => {
    let newElement = genEmptyElement(false, true);
    let orderIndex = 1;

    if (blockElement.getAttribute("data-type") === "NodeListItem") {
        newElement = genListItemElement(blockElement, 0, true) as HTMLDivElement;
        const marker = blockElement.parentElement?.firstElementChild?.getAttribute("data-marker");
        if (marker) {
            orderIndex = parseInt(marker);
        }
        return { newElement, orderIndex };
    }

    if (position === "beforebegin" && blockElement.previousElementSibling &&
        blockElement.previousElementSibling.getAttribute("data-type") === "NodeHeading" &&
        blockElement.previousElementSibling.getAttribute("fold") === "1") {
        newElement = genHeadingElement(blockElement.previousElementSibling, false, true) as HTMLDivElement;
        return { newElement, orderIndex };
    }

    if (position === "afterend" && blockElement &&
        blockElement.getAttribute("data-type") === "NodeHeading" &&
        blockElement.getAttribute("fold") === "1") {
        newElement = genHeadingElement(blockElement, false, true) as HTMLDivElement;
        return { newElement, orderIndex };
    }

    return { newElement, orderIndex };
};

export const insertEmptyBlock = (protyle: IProtyle, position: InsertPosition, id?: string) => {
    const blockElement = getInsertTargetBlock(protyle, id, position);
    if (!blockElement) {
        return;
    }
    protyle.observerLoad?.disconnect();
    const { newElement, orderIndex } = createNewBlockElement(blockElement, position);
    const parentOldHTML = blockElement.parentElement.outerHTML;
    const newId = newElement.getAttribute("data-node-id");
    blockElement.insertAdjacentElement(position, newElement);

    const parentElement = newElement.parentElement;
    let listHandled = false;
    if (parentElement && blockElement.getAttribute("data-type") === "NodeListItem" && blockElement.getAttribute("data-subtype") === "o" &&
        !parentElement.classList.contains("protyle-wysiwyg")) {
        updateListOrder(parentElement, orderIndex);
        updateTransaction(protyle, parentElement.getAttribute("data-node-id") || "", parentElement.outerHTML, parentOldHTML);
        listHandled = true;
    }

    if (!listHandled) {
        const doOperations: IOperation[] = [{
            action: "insert",
            data: newElement.outerHTML,
            id: newId || "",
            nextID: position === "beforebegin" ? (blockElement.getAttribute("data-node-id") || undefined) : undefined,
            previousID: position !== "beforebegin" ? (blockElement.getAttribute("data-node-id") || undefined) : undefined,
        }];
        transaction(protyle, doOperations, [{
            action: "delete",
            id: newId || "",
        }]);
    }
    const prev = blockElement.previousElementSibling;
    const next = blockElement.nextElementSibling;
    if (prev && next && blockElement.parentElement?.classList.contains("sb") &&
        blockElement.parentElement.getAttribute("data-sb-layout") === "col") {
        turnsIntoOneTransaction({
            protyle,
            selectsElement: position === "afterend" ? [blockElement, next] : [prev, blockElement],
            type: "BlocksMergeSuperBlock",
            level: "row",
            unfocus: true,
        });
    }
    if (protyle.wysiwyg?.element) {
        const range = getEditorRange(protyle.wysiwyg.element);
        focusByWbr(protyle.wysiwyg.element, range);
    }
    scrollCenter(protyle);
};

export const genEmptyBlock = (zwsp = true, wbr = true, string?: string) => {
    let html = "";
    if (zwsp) {
        html = Constants.ZWSP;
    }
    if (wbr) {
        html += "<wbr>";
    }
    if (string) {
        html += string;
    }
    return `<div data-node-id="${Lute.NewNodeID()}" data-type="NodeParagraph" class="p"><div contenteditable="true" spellcheck="${getSiyuanConfig().editor.spellcheck}">${html}</div><div contenteditable="false" class="protyle-attr">${Constants.ZWSP}</div></div>`;
};

export const genEmptyElement = (zwsp = true, wbr = true, id?: string) => {
    const element = document.createElement("div");
    element.setAttribute("data-node-id", id || Lute.NewNodeID());
    element.setAttribute("data-type", "NodeParagraph");
    element.classList.add("p");
    element.innerHTML = `<div contenteditable="true" spellcheck="${getSiyuanConfig().editor.spellcheck}">${zwsp ? Constants.ZWSP : ""}${wbr ? "<wbr>" : ""}</div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>`;
    return element;
};

export const genHeadingElement = (headElement: Element, getHTML = false, addWbr = false) => {
    const html = `<div data-subtype="${headElement.getAttribute("data-subtype")}" data-node-id="${Lute.NewNodeID()}" data-type="NodeHeading" class="${headElement.className}"><div contenteditable="true" spellcheck="false">${addWbr ? "<wbr>" : ""}</div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
    if (getHTML) {
        return html;
    }
    const tempElement = document.createElement("template");
    tempElement.innerHTML = html;
    return tempElement.content.firstElementChild;
};

export const getLangByType = (type: string) => {
    const langMap: { [key: string]: string } = {
        "NodeIFrame": "IFrame",
        "NodeAttributeView": siyuanI18n.database,
        "NodeThematicBreak": siyuanI18n.line,
        "NodeWidget": siyuanI18n.widget,
        "NodeVideo": siyuanI18n.video,
        "NodeAudio": siyuanI18n.audio,
        "NodeBlockQueryEmbed": siyuanI18n.blockEmbed,
    };
    return langMap[type] || type;
};
