import { setStorageVal, fetchPost } from "../ai/imports";
import { Constants } from "../constants";
import { updateBacklinkGraph } from "../editor/util.updateBacklinkGraph";
import { getAllModels } from "../layout/getAll";
import { isMobile } from "../platform";
import { pushBack } from "../mobile/util/MobileBackFoward";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { onGet } from "../protyle/util/onGet";
import { focusBlock } from "../protyle/util/selection";
import { getFirstBlock } from "../protyle/wysiwyg/getBlock";
import { fetchSyncPost } from "../util/fetch";
import { scrollCenter } from "../util/highlightById";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";


export const zoomOut = (options: {
    protyle: IProtyle;
    id: string;
    focusId?: string;
    isPushBack?: boolean;
    callback?: () => void;
    reload?: boolean;
}) => {
    if (options.protyle.options.backlinkData) {
        return;
    }
    if (typeof options.isPushBack === "undefined") {
        options.isPushBack = true;
    }
    if (typeof options.reload === "undefined") {
        options.reload = false;
    }
    const blockPanelElement = hasClosestByClassName(options.protyle.element, "block__popover", true);
    if (blockPanelElement) {
        const pingElement = blockPanelElement.querySelector('[data-type="pin"]');
        if (pingElement && blockPanelElement.getAttribute("data-pin") !== "true") {
            pingElement.setAttribute("aria-label", siyuanI18n.unpin);
            pingElement.querySelector("use").setAttribute("xlink:href", "#iconUnpin");
            blockPanelElement.setAttribute("data-pin", "true");
        }
    }
    const breadcrumbHLElement = options.protyle.breadcrumb?.element.querySelector(".protyle-breadcrumb__item--active");
    if (!options.reload && breadcrumbHLElement && breadcrumbHLElement.getAttribute("data-node-id") === options.id) {
        if (options.id === options.protyle.block.rootID) {
            return;
        }
        const focusElement = options.protyle.wysiwyg.element.querySelector(`[data-node-id="${options.focusId || options.id}"]`);
        if (focusElement) {
            focusBlock(focusElement);
            focusElement.scrollIntoView();
            return;
        }
    }
    if (window.siyuan.mobile?.editor) {
        window.siyuan.storage[Constants.LOCAL_DOCINFO] = {
            id: options.id,
        };
        setStorageVal(Constants.LOCAL_DOCINFO, window.siyuan.storage[Constants.LOCAL_DOCINFO]);
        if (options.isPushBack) {
            pushBack();
        }
    }
    fetchPost("/api/filetree/getDoc", {
        id: options.id,
        size: options.id === options.protyle.block.rootID ? window.siyuan.config.editor.dynamicLoadBlocks : Constants.SIZE_GET_MAX,
    }, async (getResponse) => {
        if (options.isPushBack) {
            onGet({
                data: getResponse,
                protyle: options.protyle,
                action: options.id === options.protyle.block.rootID ? [Constants.CB_GET_FOCUS, Constants.CB_GET_HTML] : [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS, Constants.CB_GET_HTML],
                afterCB: options.callback,
            });
        } else {
            onGet({
                data: getResponse,
                protyle: options.protyle,
                action: options.id === options.protyle.block.rootID ? [Constants.CB_GET_FOCUS, Constants.CB_GET_HTML, Constants.CB_GET_UNUNDO] : [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS, Constants.CB_GET_UNUNDO, Constants.CB_GET_HTML],
                afterCB: options.callback,
            });
        }
        // https://github.com/siyuan-note/siyuan/issues/4874
        if (options.focusId) {
            let focusElement = options.protyle.wysiwyg.element.querySelector(`[data-node-id="${options.focusId}"]`);
            if (!focusElement) {
                const unfoldResponse = await fetchSyncPost("/api/block/getUnfoldedParentID", { id: options.focusId });
                options.focusId = unfoldResponse.data.parentID;
                focusElement = options.protyle.wysiwyg.element.querySelector(`[data-node-id="${unfoldResponse.data.parentID}"]`);
            }
            if (focusElement) {
                // 退出聚焦后块在折叠中 https://github.com/siyuan-note/siyuan/issues/10746
                let showElement = focusElement;
                while (showElement.getBoundingClientRect().height === 0) {
                    showElement = showElement.parentElement;
                }
                if (showElement.classList.contains("protyle-wysiwyg")) {
                    // 闪卡退出聚焦元素被隐藏 https://github.com/siyuan-note/siyuan/issues/10058#issuecomment-2029524211
                    showElement = focusElement.previousElementSibling || focusElement.nextElementSibling;
                } else {
                    showElement = getFirstBlock(showElement);
                }
                focusBlock(showElement);
                const resizeObserver = new ResizeObserver(() => {
                    scrollCenter(options.protyle, focusElement, "start");
                });
                resizeObserver.observe(options.protyle.wysiwyg.element);
                setTimeout(() => {
                    resizeObserver.disconnect();
                }, 1000 * 3);
            } else if (!options.focusId) {
                fetchPost("/api/filetree/getDoc", {
                    id: options.protyle.block.rootID,
                    size: window.siyuan.config.editor.dynamicLoadBlocks,
                }, getFocusResponse => {
                    onGet({
                        data: getFocusResponse,
                        protyle: options.protyle,
                        action: options.isPushBack ? [Constants.CB_GET_FOCUS] : [Constants.CB_GET_FOCUS, Constants.CB_GET_UNUNDO],
                    });
                });
                return;
            } else if (options.id === options.protyle.block.rootID) { // 聚焦返回后，该块是动态加载的，但是没加载出来
                fetchPost("/api/filetree/getDoc", {
                    id: options.focusId,
                    mode: 3,
                    size: window.siyuan.config.editor.dynamicLoadBlocks,
                }, getFocusResponse => {
                    onGet({
                        data: getFocusResponse,
                        protyle: options.protyle,
                        action: options.isPushBack ? [Constants.CB_GET_FOCUS] : [Constants.CB_GET_FOCUS, Constants.CB_GET_UNUNDO],
                    });
                });
                return;
            }
        } else if (options.id !== options.protyle.block.rootID) {
            options.protyle.wysiwyg.element.classList.add("protyle-wysiwyg--animate");
            setTimeout(() => {
                options.protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--animate");
            }, 365);
        }
        // 非移动端：更新大纲高亮和反向链接图
        if (!isMobile && options.protyle.model) {
            const allModels = getAllModels();
            allModels.outline.forEach(item => {
                if (item.blockId === options.protyle.block.rootID) {
                    item.setCurrent(options.protyle.wysiwyg.element.querySelector(`[data-node-id="${options.focusId || options.id}"]`));
                }
            });
            updateBacklinkGraph(allModels, options.protyle);
        }
    });
};
