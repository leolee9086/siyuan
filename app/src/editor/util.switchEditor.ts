/** 用途：完整 Editor 领域根。使用范围：切换、定位和动态加载流程不加载具体 class。 */
import type {EditorDomain} from "./model/editorDomain.types";
/** 用途：系统常量。使用范围：CB_GET_CONTEXT 等常量。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：编辑器缩放命令。使用范围：切换编辑器时放大块；解耦评估：直达命令唯一实现，不经 Editor 总网关。 */
import {zoomOut} from "../menus/protyleMenus/editorMenu/protyle.zoomOut";
/** 用途：阻止滚动。使用范围：定位内容时防止滚动偏移。解耦评估：通过 ./imports 转发。 */
import { preventScroll } from "./imports";
/** 用途：嵌入块判断。使用范围：查找块时排除嵌入块。解耦评估：通过 ./imports 转发。 */
import { isInEmbedBlock } from "./imports";
/** 用途：查找最近块元素。使用范围：定位编辑器选区。解耦评估：通过 ./imports 转发。 */
import { hasClosestBlock } from "./imports";
/** 用途：编辑器内容加载后处理。使用范围：动态加载块内容；解耦评估：直达 Protyle 响应处理唯一实现。 */
import {onGet} from "../protyle/util/onGet";
/** 用途：块元素聚焦。使用范围：定位到指定块。解耦评估：通过 ./imports 转发。 */
import { focusBlock } from "./imports";
/** 用途：选区聚焦。使用范围：还原编辑器选区。解耦评估：通过 ./imports 转发。 */
import { focusByRange } from "./imports";
/** 用途：后退栈记录。使用范围：切换编辑器时记录位置；解耦评估：直达导航历史唯一实现。 */
import {pushBack} from "../navigation/history/pushBack";
/** 用途：网络请求。使用范围：动态加载块内容。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：代码高亮。使用范围：定位到指定代码块；解耦评估：直达稳定 DOM 定位唯一实现。 */
import {highlightById} from "../util/DOM/highlightById";
/** 用途：滚动居中。使用范围：使定位块居中显示；解耦评估：直达稳定 DOM 定位唯一实现。 */
import {scrollCenter} from "../util/DOM/highlightById";
/** 用途：获取 SiYuan 配置。使用范围：读取动态加载块配置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：判断笔记本是否加密。使用范围：动态加载块时选择对应笔记本数据源。解耦评估：通过 ./imports 转发。 */
import { isEncryptedBox } from "./imports";
/** 用途：更新反链关系图。使用范围：动态加载后刷新反链面板。解耦评估：同目录模块直接导入。 */
import { updateBacklinkGraph } from "./util.updateBacklinkGraph";

/**
 * 在编辑器子元素中查找目标块节点（排除嵌入块）
 */
function findTargetNode(wysiwyg: Element, targetId: string) {
    const items = wysiwyg.querySelectorAll(`[data-node-id="${targetId}"]`);
    for (const item of items) {
        if (!isInEmbedBlock(item)) {
            return item;
        }
    }
    return undefined;
}

/**
 * 加载块内容后的处理
 */
function handleGetResponse(getResponse: IWebSocketData, editor: EditorDomain, options: IOpenFileOptions, allModels: IModels) {
    onGet({ data: getResponse, protyle: editor.editor.protyle, action: options.action });
    updateBacklinkGraph(allModels, editor.editor.protyle);
}

/**
 * 设置滚动位置观察器，在元素位置变化时重新居中
 */
function setupScrollObserver(editor: EditorDomain, nodeElement: Element) {
    editor.editor.protyle.observerLoad = new ResizeObserver(() => {
        // 元素仍在文档中时重新居中定位
        if (document.contains(nodeElement)) {
            scrollCenter(editor.editor.protyle, nodeElement, true);
        }
    });
    // 3 秒后自动断开观察器，避免持续监听导致性能问题
    setTimeout(() => {
        editor.editor.protyle.observerLoad.disconnect();
    }, 1000 * 3);
    editor.editor.protyle.observerLoad.observe(editor.editor.protyle.wysiwyg.element);
}

/**
 * 处理获取焦点操作（高亮或聚焦）
 */
function handleFocusAction(nodeElement: Element | undefined, editor: EditorDomain, options: IOpenFileOptions) {
    // 高亮模式：使用 highlightById 定位代码块
    if (options.action?.includes(Constants.CB_GET_HL)) {
        highlightById(editor.editor.protyle, options.id, true);
        return;
    }

    // 聚焦模式且有目标元素：聚焦到指定块并设置滚动观察器
    if (options.action?.includes(Constants.CB_GET_FOCUS) && nodeElement) {
        const showOutline = options.action?.includes(Constants.CB_GET_OUTLINE) ? false : true;
        const newRange = focusBlock(nodeElement, undefined, showOutline);
        editor.editor.protyle.toolbar.range = newRange ?? editor.editor.protyle.toolbar.range;
        scrollCenter(editor.editor.protyle, nodeElement, true);
        setupScrollObserver(editor, nodeElement);
        return;
    }

    // 聚焦模式且无 nodeElement 但有选区：从选区起始容器定位
    if (options.action?.includes(Constants.CB_GET_FOCUS) && editor.editor.protyle.toolbar.range) {
        const range = editor.editor.protyle.toolbar.range;
        const closestBlock = hasClosestBlock(range.startContainer);
        focusByRange(range);
        scrollCenter(editor.editor.protyle, closestBlock);
    }
}

/**
 * 切换编辑器焦点
 */
export const switchEditor = async (editor: EditorDomain, options: IOpenFileOptions, allModels: IModels) => {
    // keepCursor 模式：标记光标位置后直接返回
    if (options.keepCursor) {
        editor.parent.headElement.setAttribute("keep-cursor", options.id);
        return true;
    }

    editor.parent.parent.switchTab(editor.parent.headElement);
    editor.parent.parent.showHeading();

    // zoomIn 模式：放大块后直接返回
    if (options.zoomIn) {
        zoomOut({ protyle: editor.editor.protyle, id: options.id });
        return true;
    }

    const wysiwyg = editor.editor.protyle.wysiwyg.element;
    const nodeElement = findTargetNode(wysiwyg, options.id);
    const needsLoad = !nodeElement || nodeElement?.clientHeight === 0;

    // 块内容未加载则动态获取，否则直接定位
    if (needsLoad && options.id !== options.rootID) {
        const mode = (options.action && options.action.includes(Constants.CB_GET_CONTEXT)) ? 3 : 0;
        const size = getSiyuanConfig().editor.dynamicLoadBlocks;
        const notebookId = editor.editor.protyle.notebookId;
        const getDocParams: IObject = {
            id: options.id,
            mode,
            size,
            ...(isEncryptedBox(notebookId) ? {notebook: notebookId} : {}),
        };
        fetchPost("/api/filetree/getDoc", getDocParams, (getResponse) => {
            handleGetResponse(getResponse, editor, options, allModels);
        });
        return;
    }

    // 块已加载，直接定位
    preventScroll(editor.editor.protyle);
    editor.editor.protyle.observerLoad?.disconnect();

    handleFocusAction(nodeElement, editor, options);

    pushBack(editor.editor.protyle, editor.editor.protyle.toolbar.range);
};
