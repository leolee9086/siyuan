import { hasClosestBlock, hasClosestByAttribute, hasClosestByClassName } from "../util/hasClosest";
import { getEditorRange } from "../util/selection";
import { isMobile } from "../../util/platform/functions";
import { Constants } from "../../constants";
import { hideElements } from "../ui/hideElements";
import { openFileById } from "../../editor/utils.openFileById";
import { openMobileFileById } from "../../mobile/editor";
import {checkFold} from "../../block/fold/checkFold";
import { pushBack } from "../../navigation/history/pushBack";
import {activeBlur} from "../../mobile/keyboard/activeBlur";
import { openLink } from "../../editor/openLink";
import { openGlobalSearch } from "../../search/util";
import { popSearch } from "../../mobile/menu/search";
import { BlockPanel } from "../../block/panel/Panel";
import { editAssetItem } from "../render/av/asset";
import { fetchPost } from "../../util/network/fetch";
import { parseSiYuanUriInfo } from "../../util/pathName";
import { processSiYuanUri } from "../../util/uri";

/**
 * 处理 click 事件中的导航类逻辑：块引用跳转、链接打开、标签搜索、嵌入块点击等。
 * @同步豁免: 遗留代码 - 从 WYSIWYG.bindEvent 的 click handler 中机械提取，原始代码为同步事件处理器
 *
 * @param protyle - 编辑器实例
 * @param event - 鼠标点击事件
 * @param range - 当前编辑器 range
 * @param aElement - 最近的链接元素（可能为 false）
 * @param aLink - 链接地址
 * @param ctrlIsPressed - 是否按下了 ctrl/meta 键
 * @param wysiwygElement - wysiwyg DOM 元素，用于 pushBack 时获取 range
 * @param clickState - 可变状态对象，用于在 setTimeout 回调中读取 mobileBlur
 * @returns 是否已处理事件（true 表示调用方应 return）
 */
export function handleClickNavigation(
    protyle: IProtyle,
    event: MouseEvent & { target: HTMLElement },
    range: Range,
    aElement: HTMLElement | false,
    aLink: string,
    ctrlIsPressed: boolean,
    wysiwygElement: HTMLElement,
    clickState: { mobileBlur: boolean },
): boolean {
    const blockRefElement = hasClosestByAttribute(event.target, "data-type", "block-ref");
    const siyuanURIInfo = aLink.startsWith("siyuan://blocks/") ? parseSiYuanUriInfo(aLink) : undefined;
    if (siyuanURIInfo?.avItemID && (range.toString() === "" || event.shiftKey)) {
        event.stopPropagation();
        event.preventDefault();
        hideElements(["dialog", "toolbar"], protyle);
        processSiYuanUri(protyle.app, aLink);
        return true;
    }
    if (blockRefElement || aLink.startsWith("siyuan://blocks/")) {
        event.stopPropagation();
        event.preventDefault();
        hideElements(["dialog", "toolbar"], protyle);
        if (range.toString() === "" || event.shiftKey) {
            let refBlockId: string;
            if (blockRefElement) {
                refBlockId = (blockRefElement.getAttribute("data-id") || "").split(/\s+/)[0];
            } else if (aElement) {
                refBlockId = aLink.substring(16, 38);
            }
            checkFold(refBlockId, (zoomIn, action, isRoot) => {
                // 块引用跳转后需要短暂高亮目标块 https://github.com/siyuan-note/siyuan/issues/11542
                if (!isRoot) {
                    action.push(Constants.CB_GET_HL);
                }
                if (isMobile()) {
                    clickState.mobileBlur = true;
                    activeBlur();
                    openMobileFileById(protyle.app, refBlockId, zoomIn ? [Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL], "start");
                } else if (event.shiftKey) {
                    openFileById({
                        app: protyle.app,
                        id: refBlockId,
                        position: "bottom",
                        action,
                        zoomIn,
                        scrollPosition: "start"
                    });
                    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
                } else if (event.altKey) {
                    openFileById({
                        app: protyle.app,
                        id: refBlockId,
                        position: "right",
                        action,
                        zoomIn,
                        scrollPosition: "start"
                    });
                } else if (ctrlIsPressed) {
                    openFileById({
                        app: protyle.app,
                        id: refBlockId,
                        keepCursor: true,
                        action: zoomIn ? [Constants.CB_GET_HL, Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
                        zoomIn,
                        scrollPosition: "start"
                    });
                } else {
                    openFileById({
                        app: protyle.app,
                        id: refBlockId,
                        action,
                        zoomIn,
                        scrollPosition: "start"
                    });
                }
            });
            if (!isMobile() && protyle.model) {
                // 打开双链需记录到后退中 https://github.com/siyuan-note/insider/issues/801
                let blockElement: HTMLElement | false;
                if (blockRefElement) {
                    blockElement = hasClosestBlock(blockRefElement);
                } else if (aElement) {
                    blockElement = hasClosestBlock(aElement);
                }
                if (blockElement) {
                    pushBack(protyle, getEditorRange(wysiwygElement), blockElement);
                }
            }
            return true;
        }
    }
    if (isMobile()) {
        // https://github.com/siyuan-note/siyuan/issues/10513
        const virtualRefElement = hasClosestByAttribute(event.target, "data-type", "virtual-block-ref");
        if (virtualRefElement && range.toString() === "") {
            event.stopPropagation();
            event.preventDefault();
            fetchPost("/api/block/getBlockDefIDsByRefText", {
                anchor: virtualRefElement.textContent,
            }, (response) => {
                checkFold(response.data.refDefs[0].refID, (zoomIn) => {
                    clickState.mobileBlur = true;
                    activeBlur();
                    openMobileFileById(protyle.app, response.data.refDefs[0].refID, zoomIn ? [Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL]);
                });
            });
            return true;
        }
    }

    const fileElement = hasClosestByAttribute(event.target, "data-type", "file-annotation-ref");
    if (fileElement && range.toString() === "") {
        event.stopPropagation();
        event.preventDefault();
        openLink(protyle, fileElement.getAttribute("data-id"), event, ctrlIsPressed);
        return true;
    }

    if (aElement &&
        // https://github.com/siyuan-note/siyuan/issues/11980
        (event.shiftKey || range.toString() === "") &&
        // 如果aLink 为空时，当 data-type="a inline-math" 可继续后续操作
        aLink) {
        event.stopPropagation();
        event.preventDefault();
        openLink(protyle, aLink, event, ctrlIsPressed);
        return true;
    }

    if (aElement && aElement.classList.contains("av__celltext--url") && !aLink) {
        let index = 0;
        Array.from(aElement.parentElement.children).find((item, i) => {
            if (item === aElement) {
                index = i;
                return true;
            }
        });
        editAssetItem({
            protyle,
            cellElements: [aElement.parentElement],
            blockElement: hasClosestBlock(aElement) as HTMLElement,
            content: aElement.getAttribute("data-url"),
            type: "file",
            name: aElement.getAttribute("data-name"),
            index,
            rect: aElement.getBoundingClientRect()
        });
        return true;
    }

    const tagElement = hasClosestByAttribute(event.target, "data-type", "tag");
    if (tagElement && !event.altKey && !event.shiftKey && range.toString() === "") {
        if (!isMobile()) {
            openGlobalSearch(protyle.app, `#${tagElement.textContent}#`, !ctrlIsPressed, { method: 0 });
            hideElements(["dialog"]);
        } else {
            popSearch(protyle.app, {
                hasReplace: false,
                method: 0,
                hPath: "",
                idPath: [],
                k: `#${tagElement.textContent}#`,
                r: "",
                page: 1,
            });
        }
        return true;
    }

    const embedItemElement = hasClosestByClassName(event.target, "protyle-wysiwyg__embed");
    if (embedItemElement) {
        const embedId = embedItemElement.getAttribute("data-id");
        checkFold(embedId, (zoomIn, action) => {
            if (isMobile()) {
                clickState.mobileBlur = true;
                activeBlur();
                openMobileFileById(protyle.app, embedId, zoomIn ? [Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL]);
            } else if (event.shiftKey) {
                openFileById({
                    app: protyle.app,
                    id: embedId,
                    position: "bottom",
                    action,
                    zoomIn
                });
            } else if (event.altKey) {
                openFileById({
                    app: protyle.app,
                    id: embedId,
                    position: "right",
                    action,
                    zoomIn
                });
            } else if (ctrlIsPressed) {
                openFileById({
                    app: protyle.app,
                    id: embedId,
                    action: zoomIn ? [Constants.CB_GET_HL, Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT],
                    zoomIn,
                    keepCursor: true,
                });
            } else if (!protyle.disabled) {
                window.siyuan.blockPanels.push(new BlockPanel({
                    app: protyle.app,
                    targetElement: embedItemElement,
                    isBacklink: false,
                    refDefs: [{ refID: embedId }]
                }));
            }
        });
        // https://github.com/siyuan-note/siyuan/issues/12585
        if (!ctrlIsPressed) {
            event.stopPropagation();
            return true;
        }
    }

    return false;
}
