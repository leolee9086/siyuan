import { getAllModels } from "../layout/getAll";
import { Constants } from "../constants";
import { escapeHtml } from "../util/DOM/escape";
import {openFile} from "../editor/open/openFile";
import { openFileById } from "../editor/utils.openFileById";
import type {ProtyleDomain} from "../protyle/protyle.types";
import { hasClosestBlock, hasClosestByClassName } from "../protyle/util/hasClosest";
import {setStorageVal} from "../util/storage/setStorageVal";
import type { AppFacade } from "../app/AppFacade.types";
import {checkFold} from "../block/fold/checkFold";
import { isSupportCSSHL, searchMarkRender } from "../protyle/render/searchMarkRender";
import { highlightById } from "../util/DOM/highlightById";
import { scrollToCurrent } from "./utils/utils.scrollToCurrent";
import { getSelectionOffset } from "../protyle/util/selection";
import { getContenteditableElement } from "../protyle/wysiwyg/getBlock";

// inputEvent 已拆分到独立文件，导入供内部使用并重新导出
import { inputEvent } from "./inputEvent";
export { inputEvent };

export const openGlobalSearch = (app: AppFacade, text: string, replace: boolean, searchData?: Config.IUILayoutTabSearchConfig) => {
    text = text.trim();
    const searchModel = getAllModels().search.find((item) => {
        item.parent.parent.switchTab(item.parent.headElement);
        item.updateSearch(text, replace);
        return true;
    });
    if (searchModel) {
        return;
    }
    const localData = window.siyuan.storage[Constants.LOCAL_SEARCHDATA];
    openFile({
        app,
        searchData: {
            k: text,
            r: "",
            hasReplace: false,
            method: searchData ? searchData.method : (localData.method === 4 && !window.siyuan.config.ai.embedding.enabled ? 0 : localData.method),
            hPath: "",
            idPath: [],
            group: localData.group,
            sort: localData.sort,
            types: Object.assign({}, localData.types),
            subTypes: Object.assign({}, localData.subTypes),
            replaceTypes: Object.assign({}, localData.replaceTypes),
            removed: localData.removed,
            page: 1
        },
        position: (!window.siyuan.config.fileTree.noSplitScreenWhenOpenTab && (window.siyuan.layout.centerLayout.children.length > 1 || window.innerWidth > 1024)) ? "right" : undefined
    });
};

export const openSearchEditor = (options: {
    protyle: IProtyle,
    openPosition?: string,
    id: string,
    rootId: string,
    cb: () => void
}) => {
    let currentRange = (options.rootId === options.protyle.block.rootID && options.id === options.protyle.block.id) ?
        options.protyle.highlight.ranges[options.protyle.highlight.rangeIndex] : null;
    if (options.protyle.block.scroll) {
        currentRange = null;
    }
    if (currentRange) {
        const rangeBlockElement = hasClosestBlock(currentRange.startContainer);
        if (rangeBlockElement) {
            options.id = rangeBlockElement.getAttribute("data-node-id");
            const offset = getSelectionOffset(getContenteditableElement(rangeBlockElement) || rangeBlockElement,
                null, options.protyle.highlight.ranges[options.protyle.highlight.rangeIndex]);
            const scrollAttr: IScrollAttr = {
                rootId: options.protyle.block.rootID,
                focusId: options.id,
                focusStart: offset.start,
                focusEnd: offset.end,
                zoomInId: options.protyle.block.showAll ? options.protyle.block.id : undefined,
                scrollTop: options.protyle.contentElement.scrollTop,
            };
            window.siyuan.storage[Constants.LOCAL_FILEPOSITION][options.protyle.block.rootID] = scrollAttr;
            if (offset.start === offset.end) {
                currentRange = null;
            }
        }
    }
    checkFold(options.id, (zoomIn) => {
        openFileById({
            app: options.protyle.app,
            id: options.id,
            action: currentRange ?
                (zoomIn ? [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL, Constants.CB_GET_SCROLL, Constants.CB_GET_SEARCH] : [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT, Constants.CB_GET_SCROLL, Constants.CB_GET_SEARCH]) :
                (zoomIn ? [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL, Constants.CB_GET_HL] : [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT, Constants.CB_GET_HL]),
            zoomIn,
            position: options.openPosition,
            scrollPosition: "center"
        });
        if (options.cb) {
            options.cb();
        }
    });
};

export const renderNextSearchMark = (options: {
    id: string,
    edit: ProtyleDomain,
    target: Element,
}) => {
    const contentRect = options.edit.protyle.contentElement.getBoundingClientRect();
    if (isSupportCSSHL()) {
        options.edit.protyle.highlight.markHL.clear();
        options.edit.protyle.highlight.mark.clear();
        options.edit.protyle.highlight.rangeIndex++;
        if (options.edit.protyle.highlight.rangeIndex >= options.edit.protyle.highlight.ranges.length) {
            options.edit.protyle.highlight.rangeIndex = 0;
        }
        let currentRange: Range;
        options.edit.protyle.highlight.ranges.forEach((item, index) => {
            if (options.edit.protyle.highlight.rangeIndex === index) {
                options.edit.protyle.highlight.markHL.add(item);
                currentRange = item;
            } else {
                options.edit.protyle.highlight.mark.add(item);
            }
        });
        if (currentRange) {
            if (!currentRange.toString()) {
                highlightById(options.edit.protyle, options.id, "center");
            } else {
                scrollToCurrent(options.edit.protyle.contentElement, currentRange, contentRect);
            }
        }
        return;
    }
    let matchElement;
    const allMatchElements = Array.from(options.edit.protyle.wysiwyg.element.querySelectorAll('span[data-type~="search-mark"]'));
    allMatchElements.find((item, itemIndex) => {
        if (item.classList.contains("search-mark--hl")) {
            item.classList.remove("search-mark--hl");
            matchElement = allMatchElements[itemIndex + 1];
            return;
        }
    });
    if (!matchElement) {
        matchElement = allMatchElements[0];
    }
    if (matchElement) {
        matchElement.classList.add("search-mark--hl");
        options.edit.protyle.contentElement.scrollTop = options.edit.protyle.contentElement.scrollTop + matchElement.getBoundingClientRect().top - contentRect.top - contentRect.height / 2;
    }
};

// inputEvent 函数已拆分到 inputEvent.ts
