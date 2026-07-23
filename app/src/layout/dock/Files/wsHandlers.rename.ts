/**
 * @fileoverview WebSocket处理模块的重命名操作辅助函数
 *
 * 本模块包含文件树WebSocket消息处理中重命名操作相关的辅助函数。
 */

import { escapeHtml } from "../../../util/DOM/escape";

/**
 * 处理重命名笔记本的WebSocket消息
 * 
 * @description
 * 作用：当收到重命名笔记本的WebSocket消息时，更新文件树中笔记本的显示名称
 * 
 * 意图：保持文件树UI与后端数据同步
 * 
 * 调用时机：在Files类的msgCallback中，当收到renamenotebook命令时调用
 * 
 * @param element - 文件树的根元素
 * @param boxId - 笔记本ID
 * @param newName - 新的笔记本名称
 * @param escapeHtmlFn - HTML转义函数
 */
/** @同步豁免: UI构建 - WebSocket消息处理需要同步更新DOM以保持UI一致性 */
/**
 * 处理创建文档的WebSocket消息
 *
 * @description
 * 作用：当收到创建文档的WebSocket消息时，根据listDocTree标志决定是选中文档还是更新箭头
 *
 * 意图：保持文件树UI与后端数据同步
 *
 * 调用时机：在Files类的msgCallback中，当收到create命令时调用
 *
 * @param data - WebSocket消息数据
 * @param selectItemFn - 选中文档项的函数
 * @param updateItemArrowFn - 更新文档项箭头的函数
 */
/** @同步豁免: UI构建 - WebSocket消息处理需要同步更新DOM以保持UI一致性 */
export const handleCreate = (
    data: IWebSocketData,
    selectItemFn: (boxId: string, path: string) => void,
    updateItemArrowFn: (boxId: string, path: string) => void
): void => {
    const boxId = data.data?.box?.id;
    const path = data.data?.path;
    // 缺少必要参数时直接返回
    if (!boxId || !path) {
        return;
    }
    // listDocTree为true时选中文档项，否则更新箭头
    if (data.data?.listDocTree) {
        selectItemFn(boxId, path);
        return;
    }
    updateItemArrowFn(boxId, path);
};

/**
 * 处理重命名笔记本的WebSocket消息
 *
 * @description
 * 作用：当收到重命名笔记本的WebSocket消息时，更新文件树中笔记本的显示名称
 *
 * 意图：保持文件树UI与后端数据同步
 *
 * 调用时机：在Files类的msgCallback中，当收到renamenotebook命令时调用
 *
 * @param element - 文件树的根元素
 * @param boxId - 笔记本ID
 * @param newName - 新的笔记本名称
 * @param escapeHtmlFn - HTML转义函数
 */
/** @同步豁免: UI构建 - WebSocket消息处理需要同步更新DOM以保持UI一致性 */
export const handleRenameNotebook = (
    element: HTMLElement,
    closeElement: HTMLElement,
    boxId: string,
    newName: unknown
): void => {
    if (typeof newName !== "string") {
        return;
    }
    const notebook = window.siyuan.notebooks.find(item => item.id === boxId);
    if (notebook) {
        notebook.name = newName;
    }
    const textElement = element.querySelector(`[data-url="${boxId}"] .b3-list-item__text`) ||
        closeElement.querySelector(`[data-url="${boxId}"] .b3-list-item__text`);
    if (textElement) {
        textElement.textContent = newName;
    }
};

/**
 * 处理文档重命名事件
 *
 * @description
 * 作用：更新文件树中指定文档的显示名称
 * 意图：保持文件树UI与后端数据同步
 * 调用时机：当收到 rename WebSocket 消息时由 handleMsgCallback 调用
 *
 * @param element - 文件树容器元素
 * @param data - 重命名数据，包含路径、新标题和笔记本ID
 */
/** @同步豁免: UI构建 - WebSocket消息处理需要同步更新DOM以保持UI一致性 */
export const onRenameHandler = (
    element: HTMLElement,
    data: { path: string; title: string; box: string }
): void => {
    const fileItemElement = element.querySelector(`ul[data-url="${data.box}"] li[data-path="${data.path}"]`);
    // 文件项不存在时直接返回（可能已被删除或未加载）
    if (!fileItemElement) {
        return;
    }
    fileItemElement.setAttribute("data-name", Lute.EscapeHTMLStr(data.title));
    const textElement = fileItemElement.querySelector(".b3-list-item__text");
    // textElement 在 genFileHTML 中已确保存在
    if (textElement) {
        textElement.innerHTML = escapeHtml(data.title);
    }
};
