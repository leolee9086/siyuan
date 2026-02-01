/**
 * @fileoverview 文件树操作模块
 * 
 * 本模块包含文件树面板中用于树操作的纯函数。
 * 这些函数从Files.ts中提取出来，以提高代码的可维护性和可测试性。
 * 所有函数都是纯函数，不依赖this，将所需的DOM元素作为参数传递。
 */

import { Constants } from "../../../constants";
import { setStorageVal } from "../../../protyle/util/compatibility";
import { hasClosestByTag } from "../../../protyle/util/hasClosest";
import { getSiyuanStorage } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isHTMLElement } from "./treeOperations.guard";

/**
 * 设置当前选中的文件项
 * 
 * @description
 * 作用：在文件树中高亮显示当前选中的文件项，并可选地滚动到该项
 * 
 * 意图：提供视觉反馈，让用户清楚地知道当前选中的是哪个文件
 * 
 * 调用时机：
 * - 用户点击文件项时
 * - 通过代码选中文件时（如打开文件后定位）
 * 
 * @param element - 文件树的根元素
 * @param target - 要设置为当前选中的目标元素
 * @param isScroll - 是否滚动到目标元素，默认为true
 * 
 * @example
 * ```typescript
 * setCurrent(filesElement, targetLiElement, true);
 * ```
 */
/** @同步豁免: UI构建 - 此函数用于同步设置DOM元素的焦点状态和滚动位置，在用户点击事件处理中被调用，必须同步执行以确保UI的即时响应 */
export const setCurrentItem = (
    element: HTMLElement,
    target: HTMLElement,
    isScroll = true
): void => {
    // 参数校验：如果目标元素或容器元素不存在，直接返回
    if (!target || !element) {
        return;
    }
    
    // 移除所有已选中项的焦点样式
    const focusedItems = element.querySelectorAll("li.b3-list-item--focus");
    for (const liItem of focusedItems) {
        liItem.classList.remove("b3-list-item--focus");
    }
    
    // 为目标元素添加焦点样式
    target.classList.add("b3-list-item--focus");

    // 如果需要滚动，计算并执行滚动，使目标元素居中显示
    if (isScroll) {
        const elementRect = element.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        element.scrollTop = element.scrollTop + 
            (targetRect.top - (elementRect.top + elementRect.height / 2));
    }
};

/**
 * 处理单个笔记本的打开路径收集
 *
 * @param item - 笔记本元素
 * @param element - 文件树根元素
 * @returns 笔记本路径信息，如果没有打开的路径则返回null
 */
const collectNotebookPaths = (
    item: Element,
    element: HTMLElement
): IFilesPath | null => {
    // 类型守卫：确保元素是HTMLElement
    if (!isHTMLElement(item)) {
        return null;
    }
    
    const notebookPaths: IFilesPath = {
        notebookId: item.getAttribute("data-url") ?? "",
        openPaths: []
    };
    
    // 收集所有展开的箭头对应的路径
    const openArrows = item.querySelectorAll(".b3-list-item__arrow--open");
    for (const openItem of openArrows) {
        const liElement = hasClosestByTag(openItem, "LI");
        // 只有当找到父级LI元素且路径存在时才添加到列表中
        const path = liElement ? liElement.getAttribute("data-path") : null;
        if (path) {
            notebookPaths.openPaths.push(path);
        }
    }
    
    // 如果没有打开的路径，返回null
    if (notebookPaths.openPaths.length === 0) {
        return null;
    }
    
    // 优化路径列表：移除被子路径包含的父路径
    for (let i = 0; i < notebookPaths.openPaths.length; i++) {
        for (let j = i + 1; j < notebookPaths.openPaths.length; j++) {
            const pathJ = notebookPaths.openPaths[j];
            const pathI = notebookPaths.openPaths[i];
            // 当路径j是路径i的子路径时，移除父路径i以避免冗余
            if (pathJ && pathI && pathJ.startsWith(pathI.replace(".sy", ""))) {
                notebookPaths.openPaths.splice(i, 1);
                j--;
            }
        }
    }
    
    // 更新路径为下一个子元素的路径（如果存在）
    for (let index = 0; index < notebookPaths.openPaths.length; index++) {
        const openPath = notebookPaths.openPaths[index];
        const liElement = element.querySelector(
            `[data-url="${notebookPaths.notebookId}"] li[data-path="${openPath}"]`
        );
        const nextSibling = liElement?.nextElementSibling;
        const firstChild = nextSibling?.firstElementChild;
        const nextPath = firstChild?.getAttribute("data-path");
        if (nextPath) {
            notebookPaths.openPaths[index] = nextPath;
        }
    }
    
    return notebookPaths;
};

/**
 * 获取文件树中所有打开的路径
 * 
 * @description
 * 作用：遍历文件树，收集所有展开状态的文件夹路径
 * 
 * 意图：用于保存文件树的展开状态，以便在刷新或重新加载时恢复
 * 
 * 调用时机：
 * - 文件树展开/折叠操作后
 * - 文件树刷新前保存状态
 * 
 * @param element - 文件树的根元素
 * @returns 包含所有笔记本及其打开路径的数组
 * 
 * @example
 * ```typescript
 * const paths = getOpenPaths(filesElement);
 * // 返回: [{ notebookId: "xxx", openPaths: ["/path1.sy", "/path2.sy"] }]
 * ```
 */
/** @同步豁免: UI构建 - 此函数用于同步收集DOM树中的展开状态，在文件树状态保存时被调用，必须同步执行以确保状态的一致性 */
export const getOpenPaths = (element: HTMLElement): IFilesPath[] => {
    const filesPaths: IFilesPath[] = [];
    
    const notebooks = element.querySelectorAll(".b3-list[data-url]");
    for (const item of notebooks) {
        const notebookPaths = collectNotebookPaths(item, element);
        // 只有当笔记本有打开的路径时才添加到结果中
        if (notebookPaths) {
            filesPaths.push(notebookPaths);
        }
    }
    
    return filesPaths;
};

/**
 * 保存文件树的打开路径到存储
 * 
 * @description
 * 作用：将文件树的展开状态保存到本地存储
 * 
 * 意图：持久化文件树状态，以便下次打开时恢复
 * 
 * @param element - 文件树的根元素
 */
/** @同步豁免: UI构建 - 此函数用于同步保存文件树状态到存储，在用户操作后立即调用，必须同步执行以确保状态不丢失 */
export const saveOpenPaths = (element: HTMLElement): void => {
    const filesPaths = getOpenPaths(element);
    const storage = getSiyuanStorage();
    if (storage) {
        storage[Constants.LOCAL_FILESPATHS] = filesPaths;
    }
    setStorageVal(Constants.LOCAL_FILESPATHS, filesPaths);
};

/**
 * 清除所有选择状态
 * 
 * @description
 * 作用：移除文件树中所有元素的选择相关属性
 * 
 * 意图：在完成选择操作后清理状态
 * 
 * @param element - 文件树的根元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 此函数用于同步清除DOM元素的选择状态属性，在拖拽操作结束时被调用，必须同步执行以确保状态清理的即时性 */
export const clearSelectionState = (element: HTMLElement): void => {
    const selectEndElement = element.querySelector('[select-end="true"]');
    if (selectEndElement) {
        selectEndElement.removeAttribute("select-end");
    }
    
    const selectStartElement = element.querySelector('[select-start="true"]');
    if (selectStartElement) {
        selectStartElement.removeAttribute("select-start");
    }
};

/**
 * 执行范围选择
 * 
 * @description
 * 作用：在文件树中选择从起始元素到结束元素之间的所有项
 * 
 * 意图：实现Shift+点击的范围选择功能
 * 
 * @param element - 文件树的根元素
 * @param startElement - 选择的起始元素
 * @param endElement - 选择的结束元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 此函数用于同步处理Shift+点击的范围选择，在用户点击事件中被调用，必须同步执行以确保选择的即时视觉反馈 */
export const selectRange = (
    element: HTMLElement,
    startElement: Element,
    endElement: Element
): void => {
    // 先清除所有已选中项
    const focusedItems = element.querySelectorAll(".b3-list-item--focus");
    for (const item of focusedItems) {
        item.classList.remove("b3-list-item--focus");
    }

    // 获取所有文档项
    const allFiles = Array.from(element.querySelectorAll("li.b3-list-item"));

    // 获取起始和结束索引
    const startIndex = allFiles.indexOf(startElement);
    const endIndex = allFiles.indexOf(endElement);

    // 确定选择范围
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    // 添加新选择
    for (let i = start; i <= end; i++) {
        const fileItem = allFiles[i];
        // 使用类型守卫确保元素存在且是HTMLElement
        if (fileItem && isHTMLElement(fileItem)) {
            fileItem.classList.add("b3-list-item--focus");
        }
    }
};
