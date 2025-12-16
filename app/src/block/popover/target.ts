/**
 * Popover Target 相关函数
 * 从 popover.ts 拆分出来，处理目标元素检测和 BlockPanel 清理逻辑
 */

import { BlockPanel } from "../Panel";
import { hasClosestByAttribute, hasClosestByClassName, hasClosestBlock } from "../../protyle/util/hasClosest";
import { Constants } from "../../constants";
import { isTouchDevice } from "../../util/functions";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 模块状态
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 当前悬停的 Popover 目标元素 */
let popoverTargetElement: HTMLElement;

/** 获取当前 popover 目标元素 */
export const getPopoverTargetElement = (): HTMLElement => popoverTargetElement;

/** 设置当前 popover 目标元素 */
export const setPopoverTargetElement = (element: HTMLElement) => {
    popoverTargetElement = element;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 目标检测辅助函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 查找块引用目标元素
 * 统一 hidePopover 和 getTarget 中的重复查找逻辑
 */
export const findBlockRefTarget = (target: HTMLElement): HTMLElement | undefined => {
    let element = hasClosestByAttribute(target, "data-type", "block-ref") as HTMLElement ||
        hasClosestByAttribute(target, "data-type", "virtual-block-ref") as HTMLElement;

    if (element && element.classList.contains("b3-tooltips")) {
        return undefined;
    }

    if (!element) {
        element = hasClosestByClassName(target, "popover__block") as HTMLElement;
    }

    return element || undefined;
};

/**
 * 检查目标元素是否为特殊元素（不应处理 popover）
 */
export const isSpecialElement = (target: HTMLElement): boolean => {
    return (target.id && target.tagName !== "svg" && (
        target.id.startsWith("minder_node") ||
        target.id.startsWith("kity_") ||
        target.id.startsWith("node_")
    )) ||
        target.classList.contains("counter") ||
        target.tagName === "circle";
};

/**
 * 检查是否有阻止 popover 销毁的 AV 面板
 */
export const hasBlockingAVPanel = (target: HTMLElement): boolean => {
    const avPanelElement = hasClosestByClassName(target, "av__panel") || hasClosestByClassName(target, "av__mask");
    if (avPanelElement) {
        const blockPanel = window.siyuan.blockPanels.find((item) => {
            if (item.element.style.zIndex < (avPanelElement as HTMLElement).style.zIndex) {
                return true;
            }
        });
        return !!blockPanel;
    }
    return false;
};

/**
 * 检查是否有阻止 popover 销毁的菜单
 */
export const hasBlockingMenu = (target: HTMLElement): boolean => {
    const menuElement = hasClosestByClassName(target, "b3-menu");
    if (menuElement && menuElement.getAttribute("data-name") !== Constants.MENU_DOC_TREE_MORE) {
        const blockPanel = window.siyuan.blockPanels.find((item) => {
            if (item.element.style.zIndex < menuElement.style.zIndex) {
                return true;
            }
        });
        return !!blockPanel;
    }
    return false;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BlockPanel 清理函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 获取最大编辑层级映射
 */
const getMaxEditLevels = (): Record<string, number> => {
    const maxEditLevels: Record<string, number> = { oid: 0 };
    window.siyuan.blockPanels.forEach((item) => {
        if ((item.targetElement || typeof item.x === "number") && item.element.getAttribute("data-pin") === "true") {
            const level = parseInt(item.element.getAttribute("data-level"));
            const oid = item.element.getAttribute("data-oid");
            if (maxEditLevels[oid]) {
                if (level > maxEditLevels[oid]) {
                    maxEditLevels[oid] = level;
                }
            } else {
                maxEditLevels[oid] = level; // 不能为1，否则 pin 住第三层，第二层会消失
            }
        }
    });
    return maxEditLevels;
};

/**
 * 检查 BlockPanel 是否有打开的工具栏
 */
const hasOpenToolbar = (item: BlockPanel): boolean => {
    return !!item.editors.find(editItem => {
        if (!editItem.protyle.toolbar.subElement.classList.contains("fn__none")) {
            return true;
        }
    });
};

/**
 * 清理指定层级以上的 BlockPanel（当有块元素时）
 */
const cleanupBlockPanelsWithBlock = (
    blockElement: HTMLElement,
    maxEditLevels: Record<string, number>,
    menuLevel: number
): void => {
    const blockLevel = parseInt(blockElement.getAttribute("data-level"));

    for (let i = window.siyuan.blockPanels.length - 1; i >= 0; i--) {
        const item = window.siyuan.blockPanels[i];
        const itemLevel = parseInt(item.element.getAttribute("data-level"));

        if ((item.targetElement || typeof item.x === "number") &&
            itemLevel > (maxEditLevels[item.element.getAttribute("data-oid")] || 0) &&
            item.element.getAttribute("data-pin") === "false" &&
            itemLevel > blockLevel) {

            if (menuLevel && menuLevel >= itemLevel) {
                // 有 gutter 菜单时不隐藏
                break;
            }
            if (hasOpenToolbar(item)) {
                break;
            }
            item.destroy();
        }
    }
};

/**
 * 清理所有未 pin 的 BlockPanel
 */
const cleanupAllUnpinnedBlockPanels = (
    targetElement: HTMLElement,
    menuLevel: number
): void => {
    for (let i = window.siyuan.blockPanels.length - 1; i >= 0; i--) {
        const item = window.siyuan.blockPanels[i];
        const itemLevel = parseInt(item.element.getAttribute("data-level"));

        if ((item.targetElement || typeof item.x === "number") && item.element.getAttribute("data-pin") === "false") {
            if (menuLevel && menuLevel >= itemLevel) {
                // 有 gutter 菜单时不隐藏
                break;
            }
            // 点击嵌入块后浮窗消失后再快速点击嵌入块无法弹出浮窗 https://github.com/siyuan-note/siyuan/issues/12511
            if (item.targetElement?.classList.contains("protyle-wysiwyg__embed") &&
                item.targetElement.contains(targetElement)) {
                break;
            }
            if (hasOpenToolbar(item)) {
                break;
            }
            item.destroy();
        }
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Popover 控制函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 隐藏 Popover
 * @returns 是否应该继续处理
 */
export const hidePopover = (event: MouseEvent & { path?: HTMLElement[] }): boolean => {
    // pad 端点击后 event.target 不会更新
    const target = isTouchDevice() ? document.elementFromPoint(event.clientX, event.clientY) as HTMLElement : event.target as HTMLElement;
    if (!target) {
        return false;
    }

    // gutter & mindmap & 文件树上的数字 & 关系图节点不处理
    if (isSpecialElement(target)) {
        return false;
    }

    // 检查 AV 面板和菜单
    if (hasBlockingAVPanel(target) || hasBlockingMenu(target)) {
        return false;
    }

    // 更新 popoverTargetElement
    popoverTargetElement = findBlockRefTarget(target);
    if (!popoverTargetElement) {
        const linkElement = hasClosestByAttribute(target, "data-type", "a", true);
        if (linkElement && linkElement.getAttribute("data-href")?.startsWith("siyuan://blocks")) {
            popoverTargetElement = linkElement;
        }
    }

    // 处理 BlockPanel 清理
    if (!popoverTargetElement || (popoverTargetElement && window.siyuan.menus.menu.data && window.siyuan.menus.menu.data === popoverTargetElement)) {
        // 移动到弹窗的 loading 元素上，但经过 settimeout 后 loading 已经被移除了
        // https://ld246.com/article/1673596577519/comment/1673767749885#comments
        let targetElement = target;
        if (!targetElement.parentElement && event.path?.[1]) {
            targetElement = event.path[1];
        }

        const blockElement = hasClosestByClassName(targetElement, "block__popover", true);
        const maxEditLevels = getMaxEditLevels();
        const menuLevel = parseInt(window.siyuan.menus.menu.element.dataset.from);

        if (blockElement) {
            cleanupBlockPanelsWithBlock(blockElement, maxEditLevels, menuLevel);
        } else {
            cleanupAllUnpinnedBlockPanels(targetElement, menuLevel);
        }
    }

    return true;
};

/**
 * 获取 Popover 目标
 * @returns 是否找到有效目标
 */
export const getTarget = (event: MouseEvent & { target: HTMLElement }, aElement: false | HTMLElement): boolean => {
    if (window.siyuan.config.editor.floatWindowMode === 2 || hasClosestByClassName(event.target, "history__repo", true)) {
        return false;
    }

    popoverTargetElement = findBlockRefTarget(event.target);

    // 处理链接元素
    if (!popoverTargetElement && aElement) {
        if (aElement.getAttribute("data-href")?.startsWith("siyuan://blocks") && aElement.getAttribute("prevent-popover") !== "true") {
            popoverTargetElement = aElement;
        } else if (aElement.classList.contains("av__cell")) {
            const textElement = aElement.querySelector(".av__celltext--url") as HTMLElement;
            if (textElement?.dataset.type === "url" && textElement.dataset.href?.startsWith("siyuan://blocks")) {
                popoverTargetElement = textElement;
            }
        }
    }

    // 检查是否应该显示 popover
    if (!popoverTargetElement || window.siyuan.altIsPressed ||
        (window.siyuan.config.editor.floatWindowMode === 0 && window.siyuan.ctrlIsPressed) ||
        popoverTargetElement?.getAttribute("prevent-popover") === "true") {
        return false;
    }

    // https://github.com/siyuan-note/siyuan/issues/4314
    // 选中文本时不显示 popover
    if (popoverTargetElement && getSelection().rangeCount > 0) {
        const range = getSelection().getRangeAt(0);
        if (range.toString() !== "" && popoverTargetElement.contains(range.startContainer)) {
            return false;
        }
    }

    return true;
};
