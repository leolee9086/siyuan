import { Editor } from ".";
import { Constants } from "../constants";
import { zoomOut } from "../menus/protyle";
import { preventScroll } from "../protyle/scroll/preventScroll";
import { isInEmbedBlock, hasClosestBlock } from "../protyle/util/hasClosest";
import { onGet } from "../protyle/util/onGet";
import { focusBlock, focusByRange } from "../protyle/util/selection";
import { setEditMode } from "../protyle/util/setEditMode";
import { pushBack } from "../util/backForward";
import { fetchPost } from "../util/fetch";
import { highlightById, scrollCenter } from "../util/highlightById";
import { updateBacklinkGraph } from "./util";

export const switchEditor = (editor: Editor, options: IOpenFileOptions, allModels: IModels) => {
    if (options.keepCursor) {
        editor.parent.headElement.setAttribute("keep-cursor", options.id);
        return true;
    }
    editor.parent.parent.switchTab(editor.parent.headElement);
    editor.parent.parent.showHeading();
    if (options.mode !== "preview" && !editor.editor.protyle.preview.element.classList.contains("fn__none")) {
        // TODO https://github.com/siyuan-note/siyuan/issues/3059
        return true;
    }
    if (options.zoomIn) {
        zoomOut({ protyle: editor.editor.protyle, id: options.id });
        return true;
    }
    let nodeElement: Element;
    Array.from(editor.editor.protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${options.id}"]`)).find(item => {
        if (!isInEmbedBlock(item)) {
            nodeElement = item;
            return true;
        }
    });
    if ((!nodeElement || nodeElement?.clientHeight === 0) && options.id !== options.rootID) {
        fetchPost("/api/filetree/getDoc", {
            id: options.id,
            mode: (options.action && options.action.includes(Constants.CB_GET_CONTEXT)) ? 3 : 0,
            size: window.siyuan.config.editor.dynamicLoadBlocks,
        }, getResponse => {
            onGet({ data: getResponse, protyle: editor.editor.protyle, action: options.action });
            // 大纲点击折叠标题下的内容时，需更新反链面板
            updateBacklinkGraph(allModels, editor.editor.protyle);
        });
    } else {
        // 点击大纲产生滚动时会动态加载内容，最终导致定位不准确
        preventScroll(editor.editor.protyle);
        editor.editor.protyle.observerLoad?.disconnect();
        if (options.action?.includes(Constants.CB_GET_HL)) {
            highlightById(editor.editor.protyle, options.id, true);
        } else if (options.action?.includes(Constants.CB_GET_FOCUS)) {
            if (nodeElement) {
                const newRange = focusBlock(nodeElement, undefined, options.action?.includes(Constants.CB_GET_OUTLINE) ? false : true);
                if (newRange) {
                    editor.editor.protyle.toolbar.range = newRange;
                }
                scrollCenter(editor.editor.protyle, nodeElement, true);
                editor.editor.protyle.observerLoad = new ResizeObserver(() => {
                    if (document.contains(nodeElement)) {
                        scrollCenter(editor.editor.protyle, nodeElement, true);
                    }
                });
                setTimeout(() => {
                    editor.editor.protyle.observerLoad.disconnect();
                }, 1000 * 3);
                editor.editor.protyle.observerLoad.observe(editor.editor.protyle.wysiwyg.element);
            } else if (editor.editor.protyle.block.rootID === options.id) {
                // 由于 https://github.com/siyuan-note/siyuan/issues/5420，移除定位
            } else if (editor.editor.protyle.toolbar.range) {
                nodeElement = hasClosestBlock(editor.editor.protyle.toolbar.range.startContainer) as Element;
                focusByRange(editor.editor.protyle.toolbar.range);
                if (nodeElement) {
                    scrollCenter(editor.editor.protyle, nodeElement);
                }
            }
        }
        pushBack(editor.editor.protyle, undefined, nodeElement || editor.editor.protyle.wysiwyg.element.firstElementChild);
    }
    if (options.mode) {
        setEditMode(editor.editor.protyle, options.mode);
    }
};
