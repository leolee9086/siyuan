/**
 * @fileoverview WebSocket处理模块的挂载操作辅助函数
 * 
 * 本模块包含文件树WebSocket消息处理中挂载操作相关的辅助函数。
 */

import { decrementCounter } from "./wsHandlers.dom";

/**
 * 从已关闭列表中移除笔记本
 * 
 * @description
 * 作用：从已关闭笔记本列表中移除指定笔记本，并更新计数器
 * 
 * 意图：当笔记本被挂载时，需要从已关闭列表中移除
 * 
 * 调用时机：在handleMount中调用
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
export const removeFromClosedList = (closeElement: HTMLElement, boxId: string): void => {
    const liElement = closeElement.querySelector(`li[data-url="${boxId}"]`);
    // 找不到元素时直接返回
    if (!liElement) {
        return;
    }
    
    const counterElement = closeElement.querySelector(".counter");
    const newCount = decrementCounter(counterElement);
    // 没有已关闭的笔记本时隐藏该区域
    if (newCount === "0") {
        closeElement.classList.add("fn__none");
    }
    
    liElement.remove();
};

/**
 * 查找笔记本应该插入的位置
 * 
 * @description
 * 作用：在笔记本列表中查找新挂载笔记本应该插入的位置
 * 
 * 意图：保持笔记本的顺序与后端一致
 * 
 * 调用时机：在createMountCallback中调用
 */
/** @同步豁免: UI构建 - 纯计算函数，用于确定DOM插入位置 */
export const findInsertPosition = (
    notebooks: INotebook[],
    targetBoxId: string
): string | undefined => {
    let previousId: string | undefined;
    
    for (let index = 0; index < notebooks.length; index++) {
        const item = notebooks[index];
        // 跳过undefined项
        if (!item) {
            continue;
        }
        // 找到当前笔记本在列表中的位置
        if (item.id !== targetBoxId) {
            continue;
        }
        
        // 向前查找第一个未关闭的笔记本
        let searchIndex = index;
        while (searchIndex > 0) {
            const prevNotebook = notebooks[searchIndex - 1];
            // 找到未关闭的笔记本
            if (prevNotebook && !prevNotebook.closed) {
                previousId = prevNotebook.id;
                break;
            }
            searchIndex--;
        }
        break;
    }
    
    return previousId;
};

/**
 * 创建mount命令的回调函数
 * 
 * @description
 * 作用：创建一个回调函数，用于在setNoteBook中处理笔记本挂载后的UI更新
 * 
 * 意图：将笔记本添加到打开列表的正确位置
 * 
 * 调用时机：在handleMount中调用
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
export const createMountCallback = (
    element: HTMLElement,
    data: { data: { box: INotebook; existed?: boolean } },
    genNotebook: (notebook: INotebook) => string
) => (notebooks: INotebook[]): void => {
    const notebook = notebooks.find(item => item.id === data.data.box.id) || data.data.box;
    const html = genNotebook(notebook);
    
    // 如果打开列表为空，直接设置innerHTML
    if (element.childElementCount === 0) {
        element.innerHTML = html;
        return;
    }
    
    const previousId = findInsertPosition(notebooks, data.data.box.id);
    // 根据找到的位置插入HTML
    if (previousId) {
        const prevElement = element.querySelector(`[data-url="${previousId}"]`);
        prevElement?.insertAdjacentHTML("afterend", html);
        return;
    }
    
    // 插入到列表开头
    element.insertAdjacentHTML("afterbegin", html);
};

/**
 * 在笔记本列表中查找新创建笔记本的前一个笔记本ID
 *
 * @description
 * 作用：遍历笔记本列表，找到新创建笔记本应该插入位置的前一个笔记本
 *
 * @param notebooks - 笔记本列表
 * @param targetBoxId - 新创建的笔记本ID
 * @returns 前一个笔记本的ID，如果应该插入到开头则返回undefined
 */
/** @同步豁免: UI构建 - 纯计算函数 */
const findPreviousNotebookId = (
    notebooks: INotebook[],
    targetBoxId: string
): string | undefined => {
    let previousId: string | undefined;
    for (const item of notebooks) {
        // 跳过已关闭的笔记本
        if (item.closed) {
            continue;
        }
        // 找到目标笔记本时返回前一个ID
        if (item.id === targetBoxId) {
            return previousId;
        }
        previousId = item.id;
    }
    return undefined;
};

/**
 * 将笔记本HTML插入到正确位置
 *
 * @description
 * 作用：根据前一个笔记本ID，将新笔记本HTML插入到正确位置
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
const insertNotebookHtml = (
    element: HTMLElement,
    previousId: string | undefined,
    notebookHtml: string
): void => {
    // 没有前一个笔记本，插入到开头
    if (!previousId) {
        element.insertAdjacentHTML("afterbegin", notebookHtml);
        return;
    }
    // 有前一个笔记本，插入到其后面
    const prevElement = element.querySelector(`.b3-list[data-url="${previousId}"]`);
    prevElement?.insertAdjacentHTML("afterend", notebookHtml);
};

/**
 * 创建处理创建笔记本的回调函数
 *
 * @description
 * 作用：创建一个回调函数，用于在setNoteBook中处理笔记本创建后的UI更新
 *
 * 调用时机：在handleCreateNotebook中调用
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素 */
export const createCreateNotebookCallback = (
    element: HTMLElement,
    boxId: string,
    notebookHtml: string
) => (notebooks: INotebook[]): void => {
    const previousId = findPreviousNotebookId(notebooks, boxId);
    insertNotebookHtml(element, previousId, notebookHtml);
};
