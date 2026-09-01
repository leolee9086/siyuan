/** 用途：完整 Editor 领域根。使用范围：切换、定位和动态加载流程不加载具体 class。 */
import type {EditorDomain} from "./model/editorDomain.types";
/** 用途：系统常量。使用范围：CB_GET_CONTEXT 等常量。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：阻止滚动。使用范围：定位内容时防止滚动偏移。解耦评估：通过 ./imports 转发。 */
import { preventScroll } from "./imports";
/** 用途：嵌入块判断。使用范围：查找块时排除嵌入块。解耦评估：通过 ./imports 转发。 */
import { isInEmbedBlock } from "./imports";
/** 用途：查找最近块元素。使用范围：定位编辑器选区。解耦评估：通过 ./imports 转发。 */
import { hasClosestBlock } from "./imports";
/** 用途：编辑器内容加载后处理。使用范围：动态加载块内容；解耦评估：通过 ./imports 转发，保持 switch owner 不直接依赖 Protyle 响应实现。 */
import {onGet} from "./imports";
/** 用途：块元素聚焦。使用范围：定位到指定块。解耦评估：通过 ./imports 转发。 */
import { focusBlock } from "./imports";
/** 用途：选区聚焦。使用范围：还原编辑器选区。解耦评估：通过 ./imports 转发。 */
import { focusByRange } from "./imports";
/** 用途：后退栈记录。使用范围：切换编辑器时记录位置；解耦评估：通过 ./imports 转发，避免 switch owner 直接耦合导航实现。 */
import {pushBack} from "./imports";
/** 用途：网络请求。使用范围：动态加载块内容。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：代码高亮。使用范围：定位到指定代码块；解耦评估：通过 ./imports 转发，避免 switch owner 直接依赖 DOM 定位实现。 */
import {highlightById} from "./imports";
/** 用途：滚动居中。使用范围：使定位块居中显示；解耦评估：通过 ./imports 转发，避免 switch owner 直接依赖 DOM 定位实现。 */
import {scrollCenter} from "./imports";
/** 用途：获取 SiYuan 配置。使用范围：读取动态加载块配置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：判断笔记本是否加密。使用范围：动态加载块时选择对应笔记本数据源。解耦评估：通过 ./imports 转发。 */
import { isEncryptedBox } from "./imports";
/** 用途：更新反链关系图。使用范围：动态加载后刷新反链面板。解耦评估：同目录模块直接导入。 */
import { updateBacklinkGraph } from "./util.updateBacklinkGraph";
/** 用途：创建可被用户输入中止的定位监听控制器。使用范围：临时 ResizeObserver 生命周期。解耦评估：浏览器实例化集中在 factory owner。 */
import { createUserScrollObserver } from "./factory/createUserScrollObserver.factory";

const SCROLL_CANCELLATION_KEY_RE = /^(PageUp|PageDown|Home|End|ArrowUp|ArrowDown| )$/;

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
function handleGetResponse(options: {
    getResponse: IWebSocketData,
    editor: EditorDomain,
    openOptions: IOpenFileOptions,
    allModels: IModels,
}) {
    onGet({ data: options.getResponse, protyle: options.editor.editor.protyle, action: options.openOptions.action });
    updateBacklinkGraph(options.allModels, options.editor.editor.protyle);
}

/**
 * 设置滚动位置观察器，在元素位置变化时重新居中
 */
function setupScrollObserver(editor: EditorDomain, nodeElement: Element) {
    const {abortController: userScrollAbort, observer: observerLoad} = createUserScrollObserver(() => {
        // 元素仍在文档中时重新居中定位
        if (document.contains(nodeElement)) {
            scrollCenter(editor.editor.protyle, nodeElement, true);
        }
    });
    /**
     * 作用：停止程序化重定位并注销临时输入监听。
     * 意图：用户开始滚动后不得再由 ResizeObserver 回写滚动位置。
     * 调用时机：用户滚动、导航按键或 3 秒保护超时。
     * 问题/改进：重复调用安全，AbortController 会统一释放 listener。
     */
    // @柯里化
    const stopObserve = () => {
        userScrollAbort.abort();
        observerLoad.disconnect();
    };
    const contentElement = editor.editor.protyle.contentElement;
    contentElement.addEventListener("wheel", stopObserve, {
        capture: true,
        passive: true,
        signal: userScrollAbort.signal,
    });
    contentElement.addEventListener("touchstart", stopObserve, {
        capture: true,
        passive: true,
        signal: userScrollAbort.signal,
    });
    contentElement.addEventListener("touchmove", stopObserve, {
        capture: true,
        passive: true,
        signal: userScrollAbort.signal,
    });
    contentElement.addEventListener("keydown", (event: KeyboardEvent) => {
        // 这些按键会触发用户可见的纵向滚动，应立即放弃初始定位的后续修正。
        if (SCROLL_CANCELLATION_KEY_RE.test(event.key)) {
            stopObserve();
        }
    }, {
        capture: true,
        signal: userScrollAbort.signal,
    });
    editor.editor.protyle.observerLoad = observerLoad;
    // 3 秒后自动断开观察器，避免持续监听导致性能问题
    setTimeout(stopObserve, 1000 * 3);
    observerLoad.observe(editor.editor.protyle.wysiwyg.element);
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
        const {zoomOut} = await import("../menus/protyleMenus/editorMenu/protyle.zoomOut");
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
        fetchPost("/api/filetree/getDoc", getDocParams, (getResponse) => handleGetResponse({getResponse, editor, openOptions: options, allModels}));
        return;
    }

    // 块已加载，直接定位
    preventScroll(editor.editor.protyle);
    editor.editor.protyle.observerLoad?.disconnect();

    handleFocusAction(nodeElement, editor, options);

    pushBack(editor.editor.protyle, editor.editor.protyle.toolbar.range);
};
