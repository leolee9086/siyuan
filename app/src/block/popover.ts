/**
 * Block Popover 模块
 * 用于编辑器内容块引用/backlinks/tag/bookmark/套娃中的悬浮面板
 */

import { BlockPanel } from "./Panel";
import { hasClosestByAttribute, hasClosestByClassName } from "../protyle/util/hasClosest";
import { hideTooltip } from "../dialog/tooltip";
import { App } from "../index";
import { Constants } from "../constants";
import { isTouchDevice } from "../util/functions";

// 子模块导入
import { TooltipInfo, getTooltipInfo, handleTooltipDisplay } from "./popover/tooltip";
import { getPopoverTargetElement, hidePopover, getTarget } from "./popover/target";
import { getRefDefs } from "./popover/refDefs";

// 重新导出类型供外部使用
export type { TooltipInfo };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 常量定义
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Popover 显示延迟时间（毫秒） */
const POPOVER_SHOW_DELAY_MS = 620;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 主入口函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 初始化块 Popover
 * 用于编辑器内容块引用/backlinks/tag/bookmark/套娃中
 */
export const initBlockPopover = (app: App) => {
    let timeout: number;
    let timeoutHide: number;

    document.addEventListener("mouseover", (event: MouseEvent) => {
        // 前置条件检查
        if (!window.siyuan.config || !window.siyuan.menus ||
            // 拖拽时禁止
            window.siyuan.dragElement || document.onmousemove) {
            hideTooltip();
            return;
        }

        // 查找可能显示 tooltip 的元素
        const aElement = hasClosestByAttribute(event.target as HTMLElement, "data-type", "a", true) ||
            hasClosestByClassName(event.target as HTMLElement, "ariaLabel") ||
            hasClosestByAttribute(event.target as HTMLElement, "data-type", "tab-header") ||
            hasClosestByAttribute(event.target as HTMLElement, "data-type", "inline-memo") ||
            hasClosestByClassName(event.target as HTMLElement, "av__calc--ashow") ||
            hasClosestByClassName(event.target as HTMLElement, "av__cell");

        // 处理 tooltip
        if (aElement) {
            const tooltipInfo = getTooltipInfo(aElement, event.target as HTMLElement);

            if (handleTooltipDisplay(aElement, event, tooltipInfo)) {
                event.stopPropagation();
                return;
            }
            hideTooltip();
        } else {
            // 非 tooltip 元素，检查是否应该隐藏 tooltip
            const tipElement = hasClosestByAttribute(event.target as HTMLElement, "id", "tooltip", true);
            if (!tipElement || (
                tipElement && (tipElement.clientHeight >= tipElement.scrollHeight && tipElement.clientWidth >= tipElement.scrollWidth)
            )) {
                hideTooltip();
            }
        }

        // Popover 模式处理
        if (window.siyuan.config.editor.floatWindowMode === 1 || window.siyuan.shiftIsPressed) {
            // 模式1：按键触发模式
            clearTimeout(timeoutHide);
            timeoutHide = window.setTimeout(() => {
                hidePopover(event as MouseEvent & { path?: HTMLElement[] });
            }, Constants.TIMEOUT_INPUT);

            if (!getTarget(event as MouseEvent & { target: HTMLElement }, aElement)) {
                return;
            }

            // https://github.com/siyuan-note/siyuan/issues/9007
            if ((event as MouseEvent & { relatedTarget?: Node }).relatedTarget && !document.contains((event as MouseEvent & { relatedTarget?: Node }).relatedTarget)) {
                return;
            }

            if (window.siyuan.ctrlIsPressed) {
                clearTimeout(timeoutHide);
                showPopover(app);
            } else if (window.siyuan.shiftIsPressed) {
                clearTimeout(timeoutHide);
                showPopover(app, true);
            }
            return;
        }

        // 模式0：延迟触发模式
        clearTimeout(timeout);
        clearTimeout(timeoutHide);

        timeoutHide = window.setTimeout(() => {
            if (!hidePopover(event as MouseEvent & { path?: HTMLElement[] })) {
                return;
            }
            const popoverTargetElement = getPopoverTargetElement();
            if (!popoverTargetElement && !aElement) {
                clearTimeout(timeout);
            }
        }, Constants.TIMEOUT_INPUT);

        timeout = window.setTimeout(() => {
            if (!getTarget(event as MouseEvent & { target: HTMLElement }, aElement) || isTouchDevice()) {
                return;
            }
            clearTimeout(timeoutHide);
            showPopover(app);
        }, POPOVER_SHOW_DELAY_MS);
    });
};

/**
 * 显示 Popover
 */
export const showPopover = async (app: App, showRef = false) => {
    const popoverTargetElement = getPopoverTargetElement();
    if (!popoverTargetElement || (window.siyuan.menus.menu.data && window.siyuan.menus.menu.data === popoverTargetElement)) {
        return;
    }

    const { refDefs, originalRefBlockIDs } = await getRefDefs(showRef);

    if (refDefs.length === 0) {
        return;
    }

    // 检查是否已有相同内容的 pin 住的面板
    let hasPin = false;
    window.siyuan.blockPanels.find((item) => {
        if ((item.targetElement || typeof item.x === "number") && item.element.getAttribute("data-pin") === "true"
            && JSON.stringify(refDefs) === JSON.stringify(item.refDefs)) {
            hasPin = true;
            return true;
        }
    });

    // 创建新面板
    if (!hasPin && popoverTargetElement.parentElement &&
        popoverTargetElement.parentElement.style.opacity !== "0.38" // 反向面板图标拖拽时不应该弹层
    ) {
        window.siyuan.blockPanels.push(new BlockPanel({
            app,
            targetElement: popoverTargetElement,
            isBacklink: showRef || popoverTargetElement.classList.contains("protyle-attr--refcount") || popoverTargetElement.classList.contains("counter"),
            refDefs,
            originalRefBlockIDs,
        }));
    }
    // 不能清除，否则ctrl 后 shift 就无效 popoverTargetElement = undefined;
};
