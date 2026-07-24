import { App } from "../..";
import { getContenteditableElement, focusByRange } from "../../ai/imports";
import { Constants } from "../../constants";
import { showMessage } from "../../dialog/message";
import { Editor } from "../../editor";
import {createEditor} from "../../editor/factory/createEditor.factory";
import { getAllModels } from "../../layout/getAll";
import { Tab } from "../../layout/Tab";
import { getInstanceById, getWndByLayout } from "../../layout/util";
import { Wnd } from "../../layout/Wnd";
import { zoomOut } from "../../menus/protyleMenus/editorMenu/protyle.zoomOut";
import { saveScroll } from "../../protyle/scroll/saveScroll";
import { hideElements } from "../../protyle/ui/hideElements";
import { isInEmbedBlock } from "../../protyle/util/hasClosest";
import { onGet } from "../../protyle/util/onGet";
import { focusByOffset } from "../../protyle/util/selection";
import { fetchSyncPost, fetchPost } from "../network/fetch";
import { scrollCenter } from "../DOM/highlightById";
import { getSiyuanBackStack, getSiyuanConfig, getSiyuanLayout, getSiyuanStorage } from "../siyuanEnvironments/getSiyuanConfig.environment";
import {replaceNavigationHistoryProtyle} from "./navigation/replaceHistoryProtyle";

const getBlockElement = (protyle: IProtyle, id: string) => {
    let blockElement: HTMLElement | undefined;
    if (!protyle.wysiwyg) {
        return;
    }
    const elements = Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${id}"]`));
    for (const item of elements) {
        if (!isInEmbedBlock(item as HTMLElement)) {
            blockElement = item as HTMLElement;
            break;
        }
    }
    return blockElement;
};

const switchTabIfHidden = (stack: IBackStack) => {
    if (!stack.protyle || !stack.protyle.title) {
        return;
    }
    if (stack.protyle.title.editElement.getBoundingClientRect().height !== 0) {
        return;
    }

    if (stack.protyle.model) {
        stack.protyle.model.parent.parent.switchTab(stack.protyle.model.parent.headElement);
    }
    if (stack.protyle.toolbar) {
        stack.protyle.toolbar.range = undefined;
    }
};

const focusRoot = (stack: IBackStack) => {
    if (!stack.protyle || !stack.protyle.title) {
        return false;
    }
    switchTabIfHidden(stack);
    if (stack.position) {
        focusByOffset(stack.protyle.title.editElement, stack.position.start, stack.position.end);
    }
    return true;
};

const focusExistingBlock = (stack: IBackStack, blockElement: HTMLElement) => {
    if (!stack.protyle) {
        return false;
    }
    if (blockElement.getBoundingClientRect().height === 0 && stack.protyle.model) {
        // 切换 tab
        stack.protyle.model.parent.parent.switchTab(stack.protyle.model.parent.headElement);
    }
    const editableElement = getContenteditableElement(blockElement);
    if (stack.position && editableElement) {
        focusByOffset(editableElement, stack.position.start, stack.position.end);
    }
    scrollCenter(stack.protyle);
    const outline = getAllModels().outline;
    for (const item of outline) {
        if (item.blockId === stack.protyle.block.rootID) {
            item.setCurrent(blockElement);
        }
    }
    return true;
};

const focusAfterLoadOrZoom = (stack: IBackStack) => {
    if (!stack.protyle) {
        return;
    }
    const newBlockElement = getBlockElement(stack.protyle, stack.id);
    if (!newBlockElement) {
        return;
    }
    const outline = getAllModels().outline;
    for (const item of outline) {
        if (item.blockId === stack.protyle.block.rootID) {
            item.setCurrent(newBlockElement);
        }
    }
    const editableElement = getContenteditableElement(newBlockElement);
    if (stack.position && editableElement) {
        focusByOffset(editableElement, stack.position.start, stack.position.end);
    }
    scrollCenter(stack.protyle);
};

const handleDynamicBlockResponse = (stack: IBackStack, getResponse: any) => {
    if (!stack.protyle) {
        return;
    }
    onGet({
        data: getResponse,
        protyle: stack.protyle,
        afterCB() {
            focusAfterLoadOrZoom(stack);
        }
    });
};

const loadDynamicBlock = (stack: IBackStack) => {
    const config = getSiyuanConfig();
    if (!config.editor.dynamicLoadBlocks) {
        return;
    }
    fetchPost("/api/filetree/getDoc", {
        id: stack.id,
        mode: 3,
        size: config.editor.dynamicLoadBlocks,
    }, response => handleDynamicBlockResponse(stack, response));
};

const zoomToBlock = (stack: IBackStack) => {
    if (!stack.protyle) {
        return;
    }
    const id = stack.zoomId || stack.protyle.block.rootID;
    if (!id) {
        return;
    }
    zoomOut({
        protyle: stack.protyle,
        id,
        isPushBack: false,
        callback: () => {
            focusAfterLoadOrZoom(stack);
        }
    });
};

const handleBlockMissing = () => {
    // 块被删除
    const selection = getSelection();
    if (selection && selection.rangeCount > 0) {
        focusByRange(selection.getRangeAt(0));
    }
    return false;
};

const checkAndLoad = async (stack: IBackStack, blockElement: HTMLElement | undefined) => {
    if (!stack.protyle) {
        return false;
    }
    if (!stack.protyle.element.parentElement) {
        return;
    }

    const response = await fetchSyncPost("/api/block/checkBlockExist", { id: stack.id });
    if (!response.data) {
        return handleBlockMissing();
    }
    // 动态加载导致内容移除 https://github.com/siyuan-note/siyuan/issues/10692
    if (!blockElement && !stack.zoomId && !stack.protyle.scroll?.element.classList.contains("fn__none")) {
        loadDynamicBlock(stack);
        return true;
    }

    // 缩放
    zoomToBlock(stack);
    return true;
};

const createTabForStack = (app: App, stack: IBackStack, info: any) => {
    return new Tab({
        title: info.data.rootTitle,
        docIcon: info.data.rootIcon,
        callback(tab) {
            if (!stack.protyle) {
                return;
            }
            const scrollAttr = saveScroll(stack.protyle, true) as IScrollAttr;
            scrollAttr.rootId = stack.protyle.block.rootID || "";
            scrollAttr.focusId = stack.id;
            if (stack.position) {
                scrollAttr.focusStart = stack.position.start;
                scrollAttr.focusEnd = stack.position.end;
            }
            try {
                const rootID = stack.protyle.block.rootID;
                if (rootID) {
                    const storage = getSiyuanStorage();
                    const localFilePosition = storage[Constants.LOCAL_FILEPOSITION];
                    localFilePosition[rootID] = scrollAttr;
                }
            } catch (e) {
                // ignore
            }
            const editor = createEditor({
                app: app,
                tab,
                blockId: stack.zoomId || stack.id || stack.protyle.block.rootID || "",
                rootId: stack.protyle.block.rootID || "",
                action: stack.zoomId ? [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL, Constants.CB_GET_ALL, Constants.CB_GET_UNUNDO] :
                    [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL, Constants.CB_GET_UNUNDO]
            });
            tab.addModel(editor);
        }
    });
};

const findTargetWnd = () => {
    const element = document.querySelector(".layout__wnd--active");
    const id = element?.getAttribute("data-id");
    if (id) {
        return getInstanceById(id) as Wnd;
    }
    try {
        const layout = getSiyuanLayout();
        if (layout.centerLayout) {
            return getWndByLayout(layout.centerLayout);
        }
    } catch (e) {
        // ignore
    }
    return undefined;
};

const handleTabInWnd = (wnd: Wnd, tab: Tab) => {
    if (!getSiyuanConfig().fileTree.openFilesUseCurrentTab) {
        wnd.addTab(tab);
        return;
    }
    let unUpdateTab: Tab | undefined;
    for (const item of wnd.children) {
        if (item.headElement && item.headElement.classList.contains("item--unupdate") && !item.headElement.classList.contains("item--pin")) {
            unUpdateTab = item;
        }
    }
    wnd.addTab(tab);
    if (unUpdateTab) {
        wnd.removeTab(unUpdateTab.id);
    }
};

const focusBlockContent = (protyle: IProtyle, stack: IBackStack) => {
    const blockElement = getBlockElement(protyle, stack.id);
    const editableElement = blockElement ? getContenteditableElement(blockElement) : undefined;
    if (editableElement && stack.position) {
        focusByOffset(editableElement, stack.position.start, stack.position.end);
    }
    scrollCenter(protyle);
};

const focusAfterTabCreation = (stack: IBackStack, protyle: IProtyle, rootID: string) => {
    if (rootID !== stack.id) {
        focusBlockContent(protyle, stack);
        return;
    }
    if (protyle.title && stack.position) {
        focusByOffset(protyle.title.editElement, stack.position.start, stack.position.end);
    }
};

const openProtyleInNewTab = async (
    app: App,
    stack: IBackStack,
    navigationForwardStack: IBackStack[],
) => {
    if (!stack.protyle) {
        return false;
    }
    const response = await fetchSyncPost("/api/block/checkBlockExist", { id: stack.protyle.block.rootID });
    if (!response.data) {
        return false;
    }

    const wnd = findTargetWnd();
    if (!wnd) {
        return false;
    }

    const info = await fetchSyncPost("/api/block/getBlockInfo", { id: stack.id });
    if (info.code === 3) {
        showMessage(info.msg);
        return;
    }

    const tab = createTabForStack(app, stack, info);
    handleTabInWnd(wnd, tab);
    wnd.showHeading();

    const protyle = (tab.model as Editor).editor.protyle;
    stack.protyle = protyle;
    replaceNavigationHistoryProtyle({
        forwardEntries: navigationForwardStack,
        backEntries: getSiyuanBackStack(),
        newProtyle: protyle,
        rootID: info.data.rootID,
    });

    focusAfterTabCreation(stack, protyle, info.data.rootID);
    return true;
};

export const focusStack = async (app: App, stack: IBackStack, navigationForwardStack: IBackStack[]) => {
    if (!stack.protyle) {
        return;
    }
    hideElements(["gutter", "toolbar", "hint", "util", "dialog"], stack.protyle);
    if (!document.contains(stack.protyle.element)) {
        return await openProtyleInNewTab(app, stack, navigationForwardStack);
    }
    if (stack.protyle.block.rootID === stack.id) {
        return focusRoot(stack);
    }
    const blockElement = getBlockElement(stack.protyle, stack.id);
    if (blockElement &&
        // 即使块存在，折叠的情况需要也需要 zoomOut，否则折叠块内的光标无法定位
        (!stack.zoomId || (stack.zoomId && stack.zoomId === stack.protyle.block.id))) {
        return focusExistingBlock(stack, blockElement);
    }
    return await checkAndLoad(stack, blockElement);
};
