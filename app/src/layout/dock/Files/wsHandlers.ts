/**
 * @fileoverview WebSocket消息处理模块
 * 
 * 本模块包含文件树面板中处理WebSocket消息的函数。
 * 这些函数从Files.ts中提取出来，以提高代码的可维护性和可测试性。
 */

import { escapeLessThans } from "../../../util/DOM/escape";
import { setNoteBook } from "../../../util/file/pathName";
import { Constants } from "../../../constants";
import { isStringArray, isHTMLElement } from "./wsHandlers.guard";
import { removeDocumentNode, incrementCounter, decrementCounter } from "./wsHandlers.dom";
import { removeFromClosedList, createMountCallback, createCreateNotebookCallback } from "./wsHandlers.mount";
import { handleSourceElementExists, handleSourceElementNotExists, updateTargetParentState } from "./wsHandlers.move";

// ----------------------------------------------------------------------------
// handleUpdateDocInfo
// ----------------------------------------------------------------------------

/**
 * 处理文档信息更新的WebSocket消息
 * 
 * @description
 * 作用：当收到文档信息更新的WebSocket消息时，更新文件树中对应文档项的显示信息
 * 
 * 意图：保持文件树UI与后端数据同步，确保用户看到最新的文档元信息
 * （如子文件数量、aria-label等）
 * 
 * 调用时机：在Files类的msgCallback中，当收到updateDocInfo命令时调用
 * 
 * @param element - 文件树的根元素
 * @param data - WebSocket消息数据，包含rootID和subFileCount等信息
 * @param genDocAriaLabel - 生成文档aria-label的函数
 */
/** @同步豁免: UI构建 - WebSocket消息处理需要同步更新DOM以保持UI一致性 */
export const handleUpdateDocInfo = (
    element: HTMLElement,
    data: IWebSocketData,
    genDocAriaLabel: (item: IFile, escapeMethod: (text: string) => string) => string
): void => {
    const liElement = element.querySelector(`li[data-node-id="${data.data?.rootID}"]`);
    // 找不到对应元素时直接返回
    if (!liElement) {
        return;
    }
    
    liElement.setAttribute("data-count", data.data?.subFileCount ?? "0");
    const ariaLabelElement = liElement.querySelector(".ariaLabel");
    ariaLabelElement?.setAttribute("aria-label", genDocAriaLabel(data.data, escapeLessThans));
    
    const toggleElement = liElement.querySelector(".b3-list-item__toggle");
    // 没有子文件时隐藏展开箭头，有子文件时显示
    if (data.data?.subFileCount === 0) {
        toggleElement?.classList.add("fn__hidden");
        return;
    }
    toggleElement?.classList.remove("fn__hidden");
};

// ----------------------------------------------------------------------------
// handleRemove
// ----------------------------------------------------------------------------

/**
 * 从笔记本列表生成已关闭笔记本的HTML
 *
 * @description
 * 作用：遍历笔记本列表，生成已关闭笔记本的HTML字符串
 *
 * 调用时机：在handleUnmount的setNoteBook回调中使用
 */
/** @同步豁免: UI构建 - 纯计算函数，用于生成HTML */
const generateClosedNotebooksHTML = (
    notebooks: INotebook[],
    genNotebook: (item: INotebook) => string
): string => {
    let closeHTML = "";
    for (const item of notebooks) {
        // 只添加已关闭的笔记本
        if (item.closed) {
            closeHTML += genNotebook(item);
        }
    }
    return closeHTML;
};

/**
 * 创建处理笔记本卸载的回调函数
 *
 * @description
 * 作用：创建一个回调函数，用于在setNoteBook中处理笔记本卸载后的UI更新
 *
 * 调用时机：在handleUnmount中调用
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const createUnmountCallback = (
    element: HTMLElement,
    closeElement: HTMLElement,
    data: IWebSocketData,
    genNotebook: (item: INotebook) => string
) => (notebooks: INotebook[]): void => {
    const targetElement = element.querySelector(
        `ul[data-url="${data.data.box}"] li[data-path="${"/"}"]`
    );
    // 找不到目标元素时直接返回
    if (!targetElement) {
        return;
    }
    
    // 移除笔记本的整个UL容器
    targetElement.parentElement?.remove();
    
    // CB_MOUNT_REMOVE表示完全删除笔记本，不需要添加到已关闭列表
    if (Constants.CB_MOUNT_REMOVE === data.callback) {
        return;
    }
    
    // 重新生成已关闭笔记本列表
    const closeHTML = generateClosedNotebooksHTML(notebooks, genNotebook);
    const closedListContainer = closeElement.lastElementChild;
    if (closedListContainer) {
        closedListContainer.innerHTML = closeHTML;
    }
    
    // 更新计数器
    const counterElement = closeElement.querySelector(".counter");
    incrementCounter(counterElement);
    
    // 显示已关闭笔记本区域
    closeElement.classList.remove("fn__none");
};

/**
 * 处理笔记本卸载时的UI更新
 *
 * @description
 * 作用：当笔记本被卸载时，从打开列表中移除并添加到已关闭列表
 *
 * 意图：保持文件树UI与后端状态同步
 *
 * 调用时机：在handleRemove中，当cmd为"unmount"时调用
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const handleUnmount = (
    element: HTMLElement,
    closeElement: HTMLElement,
    data: IWebSocketData,
    genNotebook: (item: INotebook) => string
): void => {
    // @内联回调 需要访问外部element和closeElement，无法提取为完全独立的函数
    setNoteBook(createUnmountCallback(element, closeElement, data, genNotebook));
    
    // 处理完全删除笔记本的情况（CB_MOUNT_REMOVE）
    if (Constants.CB_MOUNT_REMOVE !== data.callback) {
        return;
    }
    
    const removeElement = closeElement.querySelector(`li[data-url="${data.data.box}"]`);
    // 找不到要删除的元素时直接返回
    if (!removeElement) {
        return;
    }
    
    removeElement.remove();
    const counterElement = closeElement.querySelector(".counter");
    const newCount = decrementCounter(counterElement);
    
    // 没有已关闭的笔记本时隐藏该区域
    if (newCount === "0") {
        closeElement.classList.add("fn__none");
    }
};

/**
 * 处理关闭笔记本时的UI更新
 *
 * @description
 * 作用：从打开列表移除笔记本，并刷新已关闭笔记本列表
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const handleCloseBox = (
    element: HTMLElement,
    closeElement: HTMLElement,
    data: IWebSocketData,
    genNotebook: (item: INotebook) => string
): void => {
    const boxId = data.data?.box;
    if (!boxId) {
        return;
    }
    const targetElement = element.querySelector(`ul[data-url="${boxId}"] li[data-path="${"/"}"]`);
    if (!targetElement) {
        return;
    }

    targetElement.parentElement?.remove();
    setNoteBook((notebooks) => {
        const closedListContainer = closeElement.lastElementChild;
        if (closedListContainer) {
            closedListContainer.innerHTML = generateClosedNotebooksHTML(notebooks, genNotebook);
        }
    });

    const counterElement = closeElement.querySelector(".counter");
    incrementCounter(counterElement);
    closeElement.classList.remove("fn__none");
};

/**
 * 处理移除笔记本时的UI更新
 *
 * @description
 * 作用：从打开列表和已关闭列表中移除笔记本
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const handleRemoveBox = (
    element: HTMLElement,
    closeElement: HTMLElement,
    data: IWebSocketData
): void => {
    const boxId = data.data?.box;
    if (!boxId) {
        return;
    }

    const targetElement = element.querySelector(`ul[data-url="${boxId}"] li[data-path="${"/"}"]`);
    targetElement?.parentElement?.remove();

    const removeElement = closeElement.querySelector(`li[data-url="${boxId}"]`);
    if (!removeElement) {
        return;
    }

    removeElement.remove();
    const counterElement = closeElement.querySelector(".counter");
    const newCount = decrementCounter(counterElement);
    if (newCount === "0") {
        closeElement.classList.add("fn__none");
    }
};

/**
 * 处理删除文档时的UI更新
 *
 * @description
 * 作用：当文档被删除时，从文件树中移除对应的DOM元素
 *
 * 意图：保持文件树UI与后端状态同步
 *
 * 调用时机：在handleRemove中，当cmd为"removeDoc"时调用
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const handleRemoveDoc = (element: HTMLElement, ids: string[]): void => {
    for (const id of ids) {
        const targetElement = element.querySelector(`li.b3-list-item[data-node-id="${id}"]`);
        // 找不到目标元素时跳过
        if (!targetElement) {
            continue;
        }
        
        removeDocumentNode(targetElement);
    }
};

/**
 * 处理移除操作的WebSocket消息
 *
 * @description
 * 作用：处理笔记本卸载/关闭/移除和文档删除的WebSocket消息
 *
 * 意图：
 * - unmount：将笔记本从打开列表移动到已关闭列表，或完全删除
 * - removeDoc：从文件树中移除被删除的文档
 *
 * 调用时机：在Files类的msgCallback中，当收到unmount或removeDoc命令时调用
 *
 * @param element - 文件树的根元素（打开的笔记本列表）
 * @param closeElement - 已关闭笔记本的容器元素
 * @param data - WebSocket消息数据
 * @param genNotebook - 生成笔记本HTML的函数
 *
 * @example
 * // unmount命令的data结构
 * { cmd: "unmount", data: { box: "notebookId" }, callback: "CB_MOUNT_REMOVE" }
 *
 * // removeDoc命令的data结构
 * { cmd: "removeDoc", data: { ids: ["docId1", "docId2"] } }
 */
/** @同步豁免: UI构建 - WebSocket消息处理需要同步更新DOM以保持UI一致性 */
export function handleRemove(
    element: HTMLElement,
    closeElement: HTMLElement,
    data: IWebSocketData,
    genNotebook: (item: INotebook) => string
): void {
    // "doc2heading" 后删除文件或挂载帮助文档前的 unmount
    if (data.cmd === "unmount") {
        handleUnmount(element, closeElement, data, genNotebook);
        return;
    }

    if (data.cmd === "closeBox") {
        handleCloseBox(element, closeElement, data, genNotebook);
        return;
    }

    if (data.cmd === "removeBox") {
        handleRemoveBox(element, closeElement, data);
        return;
    }
    
    // 处理removeDoc命令：删除文档
    const ids = data.data?.ids;
    // ids不是字符串数组时直接返回
    if (!isStringArray(ids)) {
        return;
    }
    
    handleRemoveDoc(element, ids);
}

// ----------------------------------------------------------------------------
// handleMount
// ----------------------------------------------------------------------------

/**
 * 处理笔记本挂载的WebSocket消息
 *
 * @description
 * 作用：当收到笔记本挂载的WebSocket消息时，更新文件树UI
 *
 * 意图：
 * - 如果笔记本已存在，不做任何操作
 * - 从已关闭列表中移除笔记本
 * - 将笔记本添加到打开列表的正确位置
 *
 * 调用时机：在Files类的msgCallback中，当收到mount命令时调用
 *
 * @param element - 文件树的根元素（打开的笔记本列表）
 * @param closeElement - 已关闭笔记本的容器元素
 * @param data - WebSocket消息数据，包含box信息和existed标志
 * @param genNotebook - 生成笔记本HTML的函数
 *
 * @example
 * // mount命令的data结构
 * { cmd: "mount", data: { box: notebookObject, existed: false } }
 */
/** @同步豁免: UI构建 - WebSocket消息处理需要同步更新DOM以保持UI一致性 */
export function handleMount(
    element: HTMLElement,
    closeElement: HTMLElement,
    data: { data: { box: INotebook; existed?: boolean }; callback?: string },
    genNotebook: (item: INotebook) => string
): void {
    // 如果笔记本已存在，直接返回，不需要重复添加
    if (data.data.existed) {
        return;
    }

    // 从关闭列表中移除笔记本项并更新计数器
    removeFromClosedList(closeElement, data.data.box.id);

    // 调用setNoteBook获取最新笔记本列表，并执行挂载回调
    setNoteBook(createMountCallback(element, data, genNotebook));
}

// ----------------------------------------------------------------------------
// handleMove
// ----------------------------------------------------------------------------

/**
 * 处理文件移动操作的WebSocket消息
 *
 * @description
 * 作用：当收到文件移动的WebSocket消息时，更新文件树UI以反映新的文件位置
 *
 * 意图：保持文件树UI与后端数据同步，确保用户看到文件的实际位置
 *
 * 调用时机：在Files类的msgCallback中，当收到move命令时调用
 *
 * 处理流程：
 * 1. 处理源文件元素的移除（从原位置）
 * 2. 更新源文件父节点的状态（箭头、图标）
 * 3. 更新目标文件夹的状态（显示展开箭头、更新图标）
 * 4. 如果目标文件夹已展开，刷新其内容
 *
 * @param element - 文件树的根元素
 * @param response - WebSocket消息数据，包含fromNotebook, fromPath, toNotebook, toPath等信息
 * @param getLeaf - 获取子文档列表的函数
 */
/** @同步豁免: UI构建 - WebSocket消息处理需要同步更新DOM以保持UI一致性 */
export const handleMove = (
    element: HTMLElement,
    response: IWebSocketData,
    getLeaf: (liElement: Element, notebookId: string, focusUpdate?: boolean) => void
): void => {
    // 查找源文件元素
    const sourceElement = element.querySelector(
        `ul[data-url="${response.data?.fromNotebook}"] li[data-path="${response.data?.fromPath}"]`
    );

    // 源文件元素存在时处理移除
    if (isHTMLElement(sourceElement)) {
        handleSourceElementExists(sourceElement);
    }

    // 源文件元素不存在时，更新父节点状态
    if (!isHTMLElement(sourceElement)) {
        handleSourceElementNotExists(
            element,
            response.data?.fromNotebook ?? "",
            response.data?.fromPath ?? ""
        );
    }

    // 查找目标文件夹元素
    const newElement = element.querySelector(
        `[data-url="${response.data?.toNotebook}"] li[data-path="${response.data?.toPath}"]`
    );

    // 目标文件夹元素不存在时直接返回
    if (!isHTMLElement(newElement)) {
        return;
    }

    // 更新目标文件夹状态
    updateTargetParentState(
        newElement,
        response.data?.toNotebook ?? "",
        response.data?.callback,
        getLeaf
    );
};

// ----------------------------------------------------------------------------
// handleCreateNotebook
// ----------------------------------------------------------------------------

/**
 * 处理创建笔记本的WebSocket消息
 *
 * @description
 * 作用：当收到创建笔记本的WebSocket消息时，将新笔记本添加到文件树UI
 *
 * 意图：保持文件树UI与后端数据同步，确保新创建的笔记本立即显示
 *
 * 调用时机：在Files类的msgCallback中，当收到createnotebook命令时调用
 *
 * @param element - 文件树的根元素
 * @param data - WebSocket消息数据，包含新创建的笔记本信息
 * @param genNotebook - 生成笔记本HTML的函数
 */
/** @同步豁免: UI构建 - WebSocket消息处理需要同步更新DOM以保持UI一致性 */
export const handleCreateNotebook = (
    element: HTMLElement,
    data: IWebSocketData,
    genNotebook: (notebook: INotebook) => string
): void => {
    const boxId = data.data?.box?.id;
    // 没有笔记本ID时直接返回
    if (!boxId) {
        return;
    }
    const notebookHtml = genNotebook(data.data.box);
    setNoteBook(createCreateNotebookCallback(element, boxId, notebookHtml));
};
