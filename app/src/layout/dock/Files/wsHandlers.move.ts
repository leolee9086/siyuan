/**
 * @fileoverview WebSocket处理模块的移动操作辅助函数
 * 
 * 本模块包含文件树WebSocket消息处理中移动操作相关的辅助函数。
 */

import { pathPosix } from "../../../util/file/pathName";
import { Constants } from "../../../constants";
import { isHTMLElement } from "./wsHandlers.guard";
import { updateFolderToFileIcon, updateFileToFolderIcon } from "./wsHandlers.dom";
import {updateDocActionElement} from "./docActions";

/**
 * 更新父节点状态（移动操作后）
 */
const updateParentLiState = (treeElement: HTMLElement, parentLiElement: Element): void => {
    // 如果父节点不是根节点，隐藏展开按钮
    if (parentLiElement.getAttribute("data-type") !== "navigation-root" ||
        parentLiElement.getAttribute("data-node-id")) {
        const toggleElement = parentLiElement.querySelector(".b3-list-item__toggle");
        toggleElement?.classList.add("fn__hidden");
    }
    
    // 收起展开箭头
    const arrowElement = parentLiElement.querySelector(".b3-list-item__arrow");
    arrowElement?.classList.remove("b3-list-item__arrow--open");
    if (parentLiElement instanceof HTMLElement) {
        parentLiElement.dataset.count = "0";
        updateDocActionElement(treeElement, parentLiElement);
    }
    
    // 更新图标
    const emojiElement = parentLiElement.querySelector(".b3-list-item__icon");
    updateFolderToFileIcon(emojiElement);
};

/**
 * 处理源文档存在的情况
 */
/** @同步豁免: UI构建 - 需要同步从DOM中移除元素并更新状态 */
export const handleSourceElementExists = (treeElement: HTMLElement, sourceElement: HTMLElement): void => {
    // 如果源文档有展开的子节点，先移除子节点列表
    if (sourceElement.nextElementSibling?.tagName === "UL") {
        sourceElement.nextElementSibling.remove();
    }
    
    // 获取父元素
    const parentUl = sourceElement.parentElement;
    const parentLiElement = parentUl?.previousElementSibling ?? null;
    
    // 如果源文档不是父节点下的唯一子节点，只移除源文档
    if (parentUl?.childElementCount !== 1) {
        sourceElement.remove();
        return;
    }
    
    // 源文档是唯一子节点，需要更新父节点状态
    if (parentLiElement) {
        updateParentLiState(treeElement, parentLiElement);
    }
    
    parentUl?.remove();
};

/**
 * 处理源文档不存在的情况（更新父节点状态）
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素状态 */
export const handleSourceElementNotExists = (
    element: HTMLElement,
    fromNotebook: string,
    fromPath: string
): void => {
    const parentPath = pathPosix().dirname(fromPath);
    const parentElement = element.querySelector(
        `ul[data-url="${fromNotebook}"] li[data-path="${parentPath}.sy"]`
    );
    
    // 父元素不存在或不是HTMLElement时直接返回
    if (!isHTMLElement(parentElement)) {
        return;
    }
    
    // 如果父节点不是只有一个子文件，不需要更新状态
    if (parentElement.getAttribute("data-count") !== "1") {
        return;
    }
    
    const toggleElement = parentElement.querySelector(".b3-list-item__toggle");
    toggleElement?.classList.add("fn__hidden");
    
    const arrowElement = parentElement.querySelector(".b3-list-item__arrow");
    arrowElement?.classList.remove("b3-list-item__arrow--open");
};

/**
 * 更新目标位置的父节点状态
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素状态 */
export const updateTargetParentState = (
    treeElement: HTMLElement,
    newElement: HTMLElement,
    toNotebook: string,
    callback: string | undefined,
    getLeaf: (liElement: HTMLElement, notebookId: string, force?: boolean) => void
): void => {
    // 显示目标父节点的展开按钮
    const toggleElement = newElement.querySelector(".b3-list-item__toggle");
    toggleElement?.classList.remove("fn__hidden");
    if (newElement.dataset.type === "navigation-root") {
        newElement.dataset.count = Math.max(1, Number(newElement.dataset.count)).toString();
        updateDocActionElement(treeElement, newElement);
    }
    
    // 更新目标父节点的图标
    const emojiElement = newElement.querySelector(".b3-list-item__icon");
    updateFileToFolderIcon(emojiElement);
    
    // 检查是否需要重新加载子文档列表
    const arrowElement = newElement.querySelector(".b3-list-item__arrow");
    const isExpanded = arrowElement?.classList.contains("b3-list-item__arrow--open");
    const isSilentMove = callback === Constants.CB_MOVE_NOLIST;
    
    // 目标父节点已展开且不是静默移动时，重新加载子文档列表
    if (isExpanded && !isSilentMove) {
        getLeaf(newElement, toNotebook, true);
    }
};
