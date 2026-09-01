/**
 * 替代关系：本模块承接原 `wysiwyg/commonHotkey.ts` 的通用快捷键、块复制、范围解析和首页导航动作。
 */
import { matchHotKey } from "../../util/hotKey";
import { fetchPost, fetchSyncPost } from "../../../util/network/fetch";
import { writeText } from "../../util/compatibility";
import { focusBlock, } from "../../util/selection";
import { scrollCenter } from "../../../util/DOM/highlightById";
import {transaction} from "../transaction/submit";
import { onGet } from "../../util/onGet";
import { Constants } from "../../../constants";

import {net2LocalAssets} from "../../breadcrumb/assets/net2LocalAssets";
import { copyTextByType } from "../../toolbar/util";
import { hasTopClosestByClassName } from "../../util/hasClosest";
import { removeEmbed } from "../removeEmbed";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { clearBlockElement } from "../../util/clearSelect";
import { isMobile } from "../../../platform";
import {
    handleCopyHotKey,
    handlePluginHotKey} from "./commonHotkeyHelper";
import {
    getInitialCloneState,
    createTempElement,
    handleListWrapperLogic,
    updateNewBlockAttributes,
    updateOrderedMarker,
    insertDuplicateItem
} from "./commonHotkeyDuplicate";
import {
    handleFoldedHeading,
    finalizeDuplicateBlock
} from "./commonHotkeyDuplicateTransaction";

export const commonHotkey = (protyle: IProtyle, event: KeyboardEvent, nodeElement?: HTMLElement) => {
    const editorGeneral = getSiyuanConfig().keymap.editor.general;
    if (matchHotKey(editorGeneral.netImg2LocalAsset.custom, event)) {
        net2LocalAssets(protyle, "Img");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }

    if (matchHotKey(editorGeneral.netAssets2LocalAssets.custom, event)) {
        net2LocalAssets(protyle, "Assets");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }

    if (matchHotKey(editorGeneral.optimizeTypography.custom, event)) {
        fetchPost("/api/format/autoSpace", {
            id: protyle.block.rootID
        });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (matchHotKey(editorGeneral.copyHPath.custom, event)) {
        fetchPost("/api/filetree/getHPathByID", {
            id: protyle.block.rootID
        }, (response) => {
            writeText(response.data);
        });
        event.preventDefault();
        event.stopPropagation();
        return true;
    }

    if (handleCopyHotKey(protyle, event, nodeElement, editorGeneral.copyProtocolInMd.custom, "protocolMd") ||
        handleCopyHotKey(protyle, event, nodeElement, editorGeneral.copyID.custom, "id") ||
        handleCopyHotKey(protyle, event, nodeElement, editorGeneral.copyProtocol.custom, "protocol") ||
        handleCopyHotKey(protyle, event, nodeElement, editorGeneral.copyBlockEmbed.custom, "blockEmbed")) {
        return true;
    }

    if (!isMobile && handlePluginHotKey(protyle, event)) {
        return true;
    }
};

export const getStartEndElement = (selectElements: NodeListOf<Element> | Element[]) => {
    let startElement;
    let endElement;
    for (const item of selectElements) {
        if (item.getAttribute("select-start")) {
            startElement = item;
        }
        if (item.getAttribute("select-end")) {
            endElement = item;
        }
    }
    if (!startElement) {
        startElement = selectElements[0];
        startElement?.setAttribute("select-start", "true");
    }
    if (!endElement) {
        endElement = selectElements[selectElements.length - 1];
        endElement?.setAttribute("select-end", "true");
    }
    return {
        startElement,
        endElement
    };
};



export const duplicateBlock = async (nodeElements: Element[], protyle: IProtyle) => {
    let focusElement: Element | undefined;
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    const { starIndex, lastElement, isSameLi } = getInitialCloneState(nodeElements);

    if (!lastElement) {
        return;
    }

    let listHTML = "";


    for (let index = nodeElements.length - 1; index >= 0; --index) {
        const item = nodeElements[index];
        if (!item) {
            continue;
        }
        item.classList.remove("protyle-wysiwyg--select");
        let tempElement = await createTempElement(item);

        const listResult = handleListWrapperLogic(item, isSameLi, nodeElements, index, listHTML);
        if (listResult.shouldContinue) {
            listHTML = listResult.listHTML;
            continue;
        }
        if (listResult.tempElement) {
            tempElement = listResult.tempElement;
        }
        listHTML = listResult.listHTML;

        if (index === nodeElements.length - 1) {
            focusElement = tempElement;
        }

        const newId = Lute.NewNodeID();
        updateNewBlockAttributes(tempElement, newId);

        if (typeof starIndex === "number") {
            updateOrderedMarker(tempElement, starIndex, index);
        }

        insertDuplicateItem(tempElement, lastElement, newId, doOperations, undoOperations);

        const foldedHeadingOperations = await handleFoldedHeading(item, newId);
        doOperations.push(...foldedHeadingOperations.doOperations);
        undoOperations.push(...foldedHeadingOperations.undoOperations);
    }

    if (focusElement) {
        finalizeDuplicateBlock(protyle, focusElement, starIndex, nodeElements.length, doOperations, undoOperations);
    }
};

/**
 * 跳转到文档开头。
 * 
 * @description
 * - 作用：将编辑器视口滚动到文档开头，并将光标定位到第一个块。
 * - 意图：与 `goEnd` 配对，提供快速导航到文档头部的能力。
 * - 调用时机：
 *   - 用户按下 Ctrl+Home 快捷键时
 *   - 用户点击滚动条的向上箭头按钮时
 * 
 * @param protyle - 编辑器实例
 */
export const goHome = (protyle: IProtyle) => {
    const firstElement = protyle.wysiwyg?.element?.firstElementChild;
    if (!firstElement || (firstElement.getAttribute("data-node-index") !== "0" &&
        firstElement.getAttribute("data-eof") !== "1" &&
        !protyle.options.backlinkData)) {
        fetchPost("/api/filetree/getDoc", {
            id: protyle.block.rootID,
            mode: 0,
            size: getSiyuanConfig().editor.dynamicLoadBlocks,
        }, getResponse => {
            onGet({ data: getResponse, protyle, action: [Constants.CB_GET_FOCUS] });
        });
        return;
    }

    focusBlock(firstElement);
    if (protyle.contentElement) {
        protyle.contentElement.scrollTop = 0;
    }
    if (protyle.scroll) {
        protyle.scroll.lastScrollTop = 1;
    }
};

