/**
 * @fileoverview WebSocket处理模块的DOM辅助函数
 * 
 * 本模块包含文件树WebSocket消息处理中使用的DOM操作辅助函数。
 */

import {unicode2Emoji} from "../../../emoji/emoji.render";
import { Constants } from "../../../constants";
import { getSiyuanStorage } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isHTMLElement } from "./wsHandlers.guard";
import {updateDocActionElement} from "./docActions";

// ============================================================================
// 图标处理
// ============================================================================

/**
 * 获取本地图片配置
 */
const getLocalImages = () => {
    const storage = getSiyuanStorage();
    const localImages = storage[Constants.LOCAL_IMAGES];
    return localImages ?? {};
};

/**
 * 获取文件夹emoji
 */
/** @同步豁免: UI构建 - 用于同步生成DOM元素的图标内容 */
export const getFolderEmoji = (): string => {
    const localImages = getLocalImages();
    return unicode2Emoji(localImages.folder ?? "");
};

/**
 * 获取文件emoji
 */
/** @同步豁免: UI构建 - 用于同步生成DOM元素的图标内容 */
export const getFileEmoji = (): string => {
    const localImages = getLocalImages();
    return unicode2Emoji(localImages.file ?? "");
};

/**
 * 将文件夹图标更新为文件图标
 * 当父节点下没有子文件时调用
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素的图标 */
export const updateFolderToFileIcon = (emojiElement: Element | null): void => {
    // 只有当前图标是文件夹图标时才更新为文件图标
    if (emojiElement?.innerHTML === getFolderEmoji()) {
        emojiElement.innerHTML = getFileEmoji();
    }
};

/**
 * 将文件图标更新为文件夹图标
 * 当父节点下有新子文件时调用
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素的图标 */
export const updateFileToFolderIcon = (emojiElement: Element | null): void => {
    // 只有当前图标是文件图标时才更新为文件夹图标
    if (emojiElement?.innerHTML === getFileEmoji()) {
        emojiElement.innerHTML = getFolderEmoji();
    }
};

// ============================================================================
// 计数器操作
// ============================================================================

/**
 * 递增计数器并返回新值
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素的文本内容 */
export const incrementCounter = (counterElement: Element | null): string => {
    const currentCount = parseInt(counterElement?.textContent ?? "0");
    const newCount = (currentCount + 1).toString();
    if (counterElement) {
        counterElement.textContent = newCount;
    }
    return newCount;
};

/**
 * 递减计数器并返回新值
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素的文本内容 */
export const decrementCounter = (counterElement: Element | null): string => {
    const currentCount = parseInt(counterElement?.textContent ?? "0");
    const newCount = (currentCount - 1).toString();
    if (counterElement) {
        counterElement.textContent = newCount;
    }
    return newCount;
};

// ============================================================================
// 父节点状态更新
// ============================================================================

/**
 * 更新父节点状态（当子节点被删除后）
 * 隐藏展开按钮、收起箭头、更新图标
 */
/** @同步豁免: UI构建 - 需要同步更新DOM元素的类和属性 */
export const updateParentStateAfterChildRemoval = (treeElement: HTMLElement, parentElement: Element | null): void => {
    // 父元素不存在时直接返回
    if (!parentElement) {
        return;
    }
    
    // 获取展开箭头图标
    const iconElement = parentElement.querySelector("svg");
    iconElement?.classList.remove("b3-list-item__arrow--open");
    
    // 如果不是根节点，隐藏展开按钮
    const parentDataset = isHTMLElement(parentElement) ? parentElement.dataset : null;
    // 根节点需要保留展开按钮，非根节点则隐藏
    if (parentDataset?.type !== "navigation-root" || parentDataset.nodeId) {
        iconElement?.parentElement?.classList.add("fn__hidden");
    }
    if (isHTMLElement(parentElement)) {
        parentElement.dataset.count = "0";
        updateDocActionElement(treeElement, parentElement);
    }
    
    // 更新图标（从文件夹变为文件）
    const emojiElement = iconElement?.parentElement?.nextElementSibling ?? null;
    updateFolderToFileIcon(emojiElement);
};

/**
 * 从文件树中移除单个文档节点
 */
/** @同步豁免: UI构建 - 需要同步从DOM中移除元素 */
export const removeDocumentNode = (treeElement: HTMLElement, targetElement: Element): void => {
    // 如果子节点已展开，先删除子节点列表
    if (targetElement.nextElementSibling?.tagName === "UL") {
        targetElement.nextElementSibling.remove();
    }
    
    // 获取父元素
    const parentUl = targetElement.parentElement;
    const parentLi = parentUl?.previousElementSibling ?? null;
    
    // 当前节点是父节点下的唯一子节点
    if (parentUl?.childElementCount === 1) {
        updateParentStateAfterChildRemoval(treeElement, parentLi);
        parentUl.remove();
        return;
    }
    
    // 还有其他兄弟节点，只移除当前节点
    targetElement.remove();
};
