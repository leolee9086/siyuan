import { Constants } from "../../../constants";
import {
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    hasClosestByTag,
    isInEmbedBlock
} from "../hasClosest";
import { transaction } from "../../wysiwyg/transaction";
import { insertEmptyBlock } from "../../../block/util";
import { focusByRange, getRangeByPoint } from "../selection";
import { fetchPost, fetchSyncPost } from "../../../util/fetch";
import { insertHTML } from "../insertHTML";
import { blockRender } from "../../render/blockRender";
import { isBrowser } from "../../../util/functions";
import { uploadLocalFiles } from "../../upload";
import { paste } from "../paste";
import { clearSelect } from "../clearSelect";
import { getTypeByCellElement, addDragFill } from "../../render/av/cell";
import { dragUpload } from "../../render/av/asset";
import { hideElements } from "../../ui/hideElements";
import { insertAttrViewBlockAnimation } from "../../render/av/row";
import { insertGalleryItemAnimation } from "../../render/av/gallery/item";
import { onGet } from "../onGet";
import { updatePanelByEditor } from "../../../editor/util.updatePanelByEditor";
import { getPathForFile } from "../../../platform/electron/webUtils";
import { isMobile } from "../../../platform";
import * as dayjs from "dayjs";
import { dragSame, dragSb } from "./drag";

export interface IDndState {
    dragoverElement: Element | undefined;
    disabledPosition: string;
    counter: number;
}

export const onDrop = async (protyle: IProtyle, editorElement: HTMLElement, event: DragEvent & { target: HTMLElement }, state: IDndState) => {
    state.counter = 0;
    if (protyle.disabled || event.dataTransfer.getData(Constants.SIYUAN_DROP_EDITOR)) {
        // 只读模式/编辑器内选中文字拖拽
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    let gutterType = "";
    for (const item of event.dataTransfer.items) {
        if (item.type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
            gutterType = item.type;
        }
    }
    if (gutterType.startsWith(`${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}ViewTab${Constants.ZWSP}`.toLowerCase())) {
        const blockElement = hasClosestBlock(window.siyuan.dragElement);
        if (blockElement) {
            const avID = blockElement.getAttribute("data-av-id");
            const blockID = blockElement.getAttribute("data-node-id");
            const id = window.siyuan.dragElement.getAttribute("data-id");
            transaction(protyle, [{
                action: "sortAttrViewView",
                avID,
                blockID,
                id,
                previousID: window.siyuan.dragElement.previousElementSibling?.getAttribute("data-id"),
                data: "unRefresh"   // 不需要重新渲染
            }], [{
                action: "sortAttrViewView",
                avID,
                blockID,
                id,
                previousID: gutterType.split(Constants.ZWSP).pop()
            }]);
        }
        return;
    }
    const targetElement = editorElement.querySelector(".dragover__left, .dragover__right, .dragover__bottom, .dragover__top");
    if (targetElement) {
        targetElement.classList.remove("dragover");
        targetElement.removeAttribute("select-start");
        targetElement.removeAttribute("select-end");
    }
    if (gutterType) {
        // gutter 或反链面板拖拽
        const sourceElements: Element[] = [];
        const gutterTypes = gutterType.replace(Constants.SIYUAN_DROP_GUTTER, "").split(Constants.ZWSP);
        const selectedIds = gutterTypes[2].split(",");
        if (event.altKey || event.shiftKey) {
            if (event.y > protyle.wysiwyg.element.lastElementChild.getBoundingClientRect().bottom) {
                insertEmptyBlock(protyle, "afterend", protyle.wysiwyg.element.lastElementChild.getAttribute("data-node-id"));
            } else {
                const range = getRangeByPoint(event.clientX, event.clientY);
                if (hasClosestByAttribute(range.startContainer, "data-type", "NodeBlockQueryEmbed")) {
                    return;
                } else {
                    focusByRange(range);
                }
            }
        }
        if (event.altKey) {
            let html = "";
            for (let i = 0; i < selectedIds.length; i++) {
                const response = await fetchSyncPost("/api/block/getRefText", { id: selectedIds[i] });
                html += protyle.lute.Md2BlockDOM(`((${selectedIds[i]} '${response.data}'))`);
            }
            insertHTML(html, protyle);
        } else if (event.shiftKey) {
            let html = "";
            selectedIds.forEach(item => {
                html += `{{select * from blocks where id='${item}'}}\n`;
            });
            insertHTML(protyle.lute.SpinBlockDOM(html), protyle, true);
            blockRender(protyle, protyle.wysiwyg.element);
        } else if (targetElement && targetElement.className.indexOf("dragover__") > -1) {
            let queryClass = "";
            selectedIds.forEach(item => {
                queryClass += `[data-node-id="${item}"],`;
            });
            if (window.siyuan.dragElement) {
                window.siyuan.dragElement.querySelectorAll(queryClass.substring(0, queryClass.length - 1)).forEach(elementItem => {
                    if (!isInEmbedBlock(elementItem)) {
                        sourceElements.push(elementItem);
                    }
                });
            } else if (window.siyuan.config.system.workspaceDir.toLowerCase() === gutterTypes[3]) {
                // 跨窗口拖拽
                // 不能跨工作区域拖拽 https://github.com/siyuan-note/siyuan/issues/13582
                const targetProtyleElement = document.createElement("template");
                targetProtyleElement.innerHTML = `<div>${event.dataTransfer.getData(gutterType)}</div>`;
                targetProtyleElement.content.querySelectorAll(queryClass.substring(0, queryClass.length - 1)).forEach(elementItem => {
                    if (!isInEmbedBlock(elementItem)) {
                        sourceElements.push(elementItem);
                    }
                });
            }

            const sourceIds: string[] = [];
            const srcs: IOperationSrcs[] = [];
            sourceElements.forEach(item => {
                item.classList.remove("protyle-wysiwyg--hl");
                item.removeAttribute("select-start");
                item.removeAttribute("select-end");
                // 反链提及有高亮，如果拖拽到正文的话，应移除
                item.querySelectorAll('[data-type="search-mark"]').forEach(markItem => {
                    markItem.outerHTML = markItem.innerHTML;
                });
                const id = item.getAttribute("data-node-id");
                sourceIds.push(id);
                srcs.push({
                    itemID: Lute.NewNodeID(),
                    id,
                    isDetached: false,
                });
            });

            hideElements(["gutter"], protyle);

            const targetClass = targetElement.className.split(" ");
            targetElement.classList.remove("dragover__bottom", "dragover__top", "dragover__left", "dragover__right");

            if (targetElement.classList.contains("av__cell")) {
                const blockElement = hasClosestBlock(targetElement);
                if (blockElement) {
                    const avID = blockElement.getAttribute("data-av-id");
                    let previousID = "";
                    if (targetClass.includes("dragover__left")) {
                        if (targetElement.previousElementSibling) {
                            if (targetElement.previousElementSibling.classList.contains("av__colsticky")) {
                                previousID = targetElement.previousElementSibling.lastElementChild.getAttribute("data-col-id");
                            } else {
                                previousID = targetElement.previousElementSibling.getAttribute("data-col-id");
                            }
                        }
                    } else {
                        previousID = targetElement.getAttribute("data-col-id");
                    }
                    let oldPreviousID = "";
                    const rowElement = hasClosestByClassName(targetElement, "av__row");
                    if (rowElement) {
                        const oldPreviousElement = rowElement.querySelector(`[data-col-id="${gutterTypes[2]}"`)?.previousElementSibling;
                        if (oldPreviousElement) {
                            if (oldPreviousElement.classList.contains("av__colsticky")) {
                                oldPreviousID = oldPreviousElement.lastElementChild.getAttribute("data-col-id");
                            } else {
                                oldPreviousID = oldPreviousElement.getAttribute("data-col-id");
                            }
                        }
                    }
                    if (previousID !== oldPreviousID && previousID !== gutterTypes[2]) {
                        transaction(protyle, [{
                            action: "sortAttrViewCol",
                            avID,
                            previousID,
                            id: gutterTypes[2],
                            blockID: blockElement.dataset.nodeId,
                        }], [{
                            action: "sortAttrViewCol",
                            avID,
                            previousID: oldPreviousID,
                            id: gutterTypes[2],
                            blockID: blockElement.dataset.nodeId,
                        }]);
                    }
                }
            } else if (targetElement.classList.contains("av__row")) {
                // 拖拽到属性视图 table 内
                const blockElement = hasClosestBlock(targetElement);
                if (blockElement) {
                    let previousID = "";
                    if (targetClass.includes("dragover__bottom")) {
                        previousID = targetElement.getAttribute("data-id") || "";
                    } else {
                        previousID = targetElement.previousElementSibling?.getAttribute("data-id") || "";
                    }
                    const avID = blockElement.getAttribute("data-av-id");
                    if (gutterTypes[0] === "nodeattributeviewrowmenu") {
                        // 行内拖拽
                        const doOperations: IOperation[] = [];
                        const undoOperations: IOperation[] = [];
                        const targetGroupID = targetElement.parentElement.getAttribute("data-group-id");
                        selectedIds.reverse().forEach(item => {
                            const items = item.split("@");
                            const id = items[0];
                            const groupID = items[1] || "";
                            const undoPreviousId = blockElement.querySelector(`.av__body${groupID ? `[data-group-id="${groupID}"]` : ""} .av__row[data-id="${id}"]`).previousElementSibling?.getAttribute("data-id") || "";
                            if (previousID !== id && undoPreviousId !== previousID || (
                                (undoPreviousId === "" && previousID === "" && targetGroupID !== groupID)
                            )) {
                                doOperations.push({
                                    action: "sortAttrViewRow",
                                    avID,
                                    previousID,
                                    id,
                                    blockID: blockElement.dataset.nodeId,
                                    groupID,
                                    targetGroupID,
                                });
                                undoOperations.push({
                                    action: "sortAttrViewRow",
                                    avID,
                                    previousID: undoPreviousId,
                                    id,
                                    blockID: blockElement.dataset.nodeId,
                                    groupID: targetGroupID,
                                    targetGroupID: groupID,
                                });
                            }
                        });
                        transaction(protyle, doOperations, undoOperations);
                    } else {
                        const newUpdated = dayjs().format("YYYYMMDDHHmmss");
                        const bodyElement = hasClosestByClassName(targetElement, "av__body");
                        const groupID = bodyElement && bodyElement.getAttribute("data-group-id");
                        transaction(protyle, [{
                            action: "insertAttrViewBlock",
                            avID,
                            previousID,
                            srcs,
                            blockID: blockElement.dataset.nodeId,
                            groupID
                        }, {
                            action: "doUpdateUpdated",
                            id: blockElement.dataset.nodeId,
                            data: newUpdated,
                        }], [{
                            action: "removeAttrViewBlock",
                            srcIDs: sourceIds,
                            avID,
                        }, {
                            action: "doUpdateUpdated",
                            id: blockElement.dataset.nodeId,
                            data: blockElement.getAttribute("updated")
                        }]);
                        blockElement.setAttribute("updated", newUpdated);
                        insertAttrViewBlockAnimation({
                            protyle,
                            blockElement,
                            srcIDs: sourceIds,
                            previousId: previousID,
                            groupID
                        });
                    }
                }
            } else if (targetElement.classList.contains("av__gallery-item") || targetElement.classList.contains("av__gallery-add")) {
                // 拖拽到属性视图 gallery 内
                const blockElement = hasClosestBlock(targetElement);
                if (blockElement) {
                    let previousID = "";
                    if (targetClass.includes("dragover__right") || targetClass.includes("dragover__bottom")) {
                        previousID = targetElement.getAttribute("data-id") || "";
                    } else if (targetClass.includes("dragover__top") || targetClass.includes("dragover__left")) {
                        previousID = targetElement.previousElementSibling?.getAttribute("data-id") || "";
                    }
                    const avID = blockElement.getAttribute("data-av-id");
                    if (gutterTypes[1] === "galleryitem" && gutterTypes[0] === "nodeattributeview") {
                        // gallery item 内部拖拽
                        const doOperations: IOperation[] = [];
                        const undoOperations: IOperation[] = [];
                        const targetGroupID = targetElement.parentElement.parentElement.getAttribute("data-group-id");
                        selectedIds.reverse().forEach(item => {
                            const items = item.split("@");
                            const id = items[0];
                            const groupID = items[1] || "";
                            const undoPreviousId = blockElement.querySelector(`.av__body[data-group-id="${groupID}"] .av__gallery-item[data-id="${id}"]`).previousElementSibling?.getAttribute("data-id") || "";
                            if (previousID !== item && undoPreviousId !== previousID || (
                                (undoPreviousId === "" && previousID === "" && targetGroupID !== groupID)
                            )) {
                                doOperations.push({
                                    action: "sortAttrViewRow",
                                    avID,
                                    previousID,
                                    id,
                                    blockID: blockElement.dataset.nodeId,
                                    groupID,
                                    targetGroupID,
                                });
                                undoOperations.push({
                                    action: "sortAttrViewRow",
                                    avID,
                                    previousID: undoPreviousId,
                                    id,
                                    blockID: blockElement.dataset.nodeId,
                                    groupID: targetGroupID,
                                    targetGroupID: groupID,
                                });
                            }
                        });
                        transaction(protyle, doOperations, undoOperations);
                    } else {
                        const newUpdated = dayjs().format("YYYYMMDDHHmmss");
                        const bodyElement = hasClosestByClassName(targetElement, "av__body");
                        transaction(protyle, [{
                            action: "insertAttrViewBlock",
                            avID,
                            previousID,
                            srcs,
                            blockID: blockElement.dataset.nodeId,
                            groupID: bodyElement && bodyElement.getAttribute("data-group-id")
                        }, {
                            action: "doUpdateUpdated",
                            id: blockElement.dataset.nodeId,
                            data: newUpdated,
                        }], [{
                            action: "removeAttrViewBlock",
                            srcIDs: sourceIds,
                            avID,
                        }, {
                            action: "doUpdateUpdated",
                            id: blockElement.dataset.nodeId,
                            data: blockElement.getAttribute("updated")
                        }]);
                        blockElement.setAttribute("updated", newUpdated);
                        insertGalleryItemAnimation({
                            protyle,
                            blockElement,
                            srcIDs: sourceIds,
                            previousId: previousID,
                            groupID: targetElement.parentElement.getAttribute("data-group-id")
                        });
                    }
                }
            } else if (sourceElements.length > 0) {
                if (targetElement.parentElement.getAttribute("data-type") === "NodeSuperBlock" &&
                    targetElement.parentElement.getAttribute("data-sb-layout") === "col") {
                    if (targetClass.includes("dragover__left") || targetClass.includes("dragover__right")) {
                        // Mac 上 ⌘ 无法进行拖拽
                        dragSame(protyle, sourceElements, targetElement, targetClass.includes("dragover__right"), event.ctrlKey);
                    } else {
                        dragSb(protyle, sourceElements, targetElement, targetClass.includes("dragover__bottom"), "row", event.ctrlKey);
                    }
                } else {
                    if (targetClass.includes("dragover__left") || targetClass.includes("dragover__right")) {
                        dragSb(protyle, sourceElements, targetElement, targetClass.includes("dragover__right"), "col", event.ctrlKey);
                    } else {
                        dragSame(protyle, sourceElements, targetElement, targetClass.includes("dragover__bottom"), event.ctrlKey);
                    }
                }

                // https://github.com/siyuan-note/siyuan/issues/10528#issuecomment-2205165824
                editorElement.querySelectorAll(".protyle-wysiwyg--empty").forEach(item => {
                    item.classList.remove("protyle-wysiwyg--empty");
                });

                // 需重新渲染 https://github.com/siyuan-note/siyuan/issues/7574
                protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach(item => {
                    item.removeAttribute("data-render");
                    blockRender(protyle, item);
                });
            }
            state.dragoverElement = undefined;
        }
    } else if (event.dataTransfer.getData(Constants.SIYUAN_DROP_FILE)?.split("-").length > 1) {
        // 文件树拖拽
        const ids = event.dataTransfer.getData(Constants.SIYUAN_DROP_FILE).split(",");
        if (!event.altKey && (!targetElement || (
            !targetElement.classList.contains("av__row") && !targetElement.classList.contains("av__gallery-item") &&
            !targetElement.classList.contains("av__gallery-add")
        ))) {
            if (event.y > protyle.wysiwyg.element.lastElementChild.getBoundingClientRect().bottom) {
                insertEmptyBlock(protyle, "afterend", protyle.wysiwyg.element.lastElementChild.getAttribute("data-node-id"));
            } else {
                const range = getRangeByPoint(event.clientX, event.clientY);
                if (hasClosestByAttribute(range.startContainer, "data-type", "NodeBlockQueryEmbed")) {
                    return;
                } else {
                    focusByRange(range);
                }
            }
            let html = "";
            for (let i = 0; i < ids.length; i++) {
                if (ids.length > 1) {
                    html += "- ";
                }
                const response = await fetchSyncPost("/api/block/getRefText", { id: ids[i] });
                html += `((${ids[i]} '${response.data}'))`;
                if (ids.length > 1 && i !== ids.length - 1) {
                    html += "\n";
                }
            }
            insertHTML(protyle.lute.Md2BlockDOM(html), protyle);
        } else if (targetElement && !protyle.options.backlinkData && targetElement.className.indexOf("dragover__") > -1) {
            const scrollTop = protyle.contentElement.scrollTop;
            if (targetElement.classList.contains("av__row") ||
                targetElement.classList.contains("av__gallery-item") ||
                targetElement.classList.contains("av__gallery-add")) {
                // 拖拽到属性视图内
                const blockElement = hasClosestBlock(targetElement);
                if (blockElement) {
                    let previousID = "";
                    if (targetElement.classList.contains("dragover__bottom") || targetElement.classList.contains("dragover__right")) {
                        previousID = targetElement.getAttribute("data-id") || "";
                    } else if (targetElement.classList.contains("dragover__top") || targetElement.classList.contains("dragover__left")) {
                        previousID = targetElement.previousElementSibling?.getAttribute("data-id") || "";
                    }
                    const avID = blockElement.getAttribute("data-av-id");
                    const newUpdated = dayjs().format("YYYYMMDDHHmmss");
                    const srcs: IOperationSrcs[] = [];
                    const bodyElement = hasClosestByClassName(targetElement, "av__body");
                    const groupID = bodyElement && bodyElement.getAttribute("data-group-id");
                    ids.forEach(id => {
                        srcs.push({
                            itemID: Lute.NewNodeID(),
                            id,
                            isDetached: false,
                        });
                    });
                    transaction(protyle, [{
                        action: "insertAttrViewBlock",
                        avID,
                        previousID,
                        srcs,
                        blockID: blockElement.dataset.nodeId,
                        groupID
                    }, {
                        action: "doUpdateUpdated",
                        id: blockElement.dataset.nodeId,
                        data: newUpdated,
                    }], [{
                        action: "removeAttrViewBlock",
                        srcIDs: ids,
                        avID,
                    }, {
                        action: "doUpdateUpdated",
                        id: blockElement.dataset.nodeId,
                        data: blockElement.getAttribute("updated")
                    }]);
                    insertAttrViewBlockAnimation({
                        protyle,
                        blockElement,
                        srcIDs: ids,
                        previousId: previousID,
                        groupID
                    });
                    blockElement.setAttribute("updated", newUpdated);
                }
            } else {
                if (targetElement.classList.contains("dragover__bottom")) {
                    for (let i = ids.length - 1; i > -1; i--) {
                        if (ids[i]) {
                            await fetchSyncPost("/api/filetree/doc2Heading", {
                                srcID: ids[i],
                                after: true,
                                targetID: targetElement.getAttribute("data-node-id"),
                            });
                        }
                    }
                } else {
                    for (let i = 0; i < ids.length; i++) {
                        if (ids[i]) {
                            await fetchSyncPost("/api/filetree/doc2Heading", {
                                srcID: ids[i],
                                after: false,
                                targetID: targetElement.getAttribute("data-node-id"),
                            });
                        }
                    }
                }

                fetchPost("/api/filetree/getDoc", {
                    id: protyle.block.id,
                    size: window.siyuan.config.editor.dynamicLoadBlocks,
                }, getResponse => {
                    onGet({ data: getResponse, protyle });
                    // 文档标题互转后，需更新大纲
                    if (!isMobile) {
                        updatePanelByEditor({
                            protyle,
                            focus: false,
                            pushBackStack: false,
                            reload: true,
                            resize: false,
                        });
                    }
                    // 文档标题互转后，编辑区会跳转到开头 https://github.com/siyuan-note/siyuan/issues/2939
                    setTimeout(() => {
                        protyle.contentElement.scrollTop = scrollTop;
                        protyle.scroll.lastScrollTop = scrollTop - 1;
                    }, Constants.TIMEOUT_LOAD);
                });
            }
            targetElement.classList.remove("dragover__bottom", "dragover__top", "dragover__left", "dragover__right");
        }
    } else if (!window.siyuan.dragElement && (event.dataTransfer.types[0] === "Files" || event.dataTransfer.types.includes("text/html"))) {
        event.preventDefault();
        // 外部文件拖入编辑器中或者编辑器内选中文字拖拽
        // https://github.com/siyuan-note/siyuan/issues/9544
        const avElement = hasClosestByClassName(event.target, "av");
        if (!avElement) {
            focusByRange(getRangeByPoint(event.clientX, event.clientY));
            if (event.dataTransfer.types[0] === "Files" && !isBrowser()) {
                const files: string[] = [];
                for (let i = 0; i < event.dataTransfer.files.length; i++) {
                    files.push(getPathForFile(event.dataTransfer.files[i]));
                }
                uploadLocalFiles(files, protyle, !event.altKey);
            } else {
                paste(protyle, event);
            }
            clearSelect(["av", "img"], protyle.wysiwyg.element);
        } else {
            const cellElement = hasClosestByClassName(event.target, "av__cell");
            if (cellElement) {
                if (getTypeByCellElement(cellElement) === "mAsset" && event.dataTransfer.types[0] === "Files" && !isBrowser()) {
                    const files: string[] = [];
                    for (let i = 0; i < event.dataTransfer.files.length; i++) {
                        files.push(getPathForFile(event.dataTransfer.files[i]));
                    }
                    dragUpload(files, protyle, cellElement);
                    clearSelect(["cell"], avElement);
                }
            }
        }
    }
    if (window.siyuan.dragElement) {
        window.siyuan.dragElement.style.opacity = "";
        window.siyuan.dragElement = undefined;
    }
};
