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
import {
    getSiyuanBlockPanels,
    getSiyuanKeyboardState,
    getSiyuanDragElement,
    hasSiyuanConfig,
    getSiyuanMenus,
    getSiyuanConfig,
} from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setTimeout } from "../util/siyuanEnvironments/windowTimer.environment";

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

/** 检查面板是否已固定且内容相同 */
const 是已固定的相同面板 = (refDefs: IRefDefs[]) => (item: BlockPanel) =>
    (item.targetElement || typeof item.x === "number")
    && item.element?.getAttribute("data-pin") === "true"
    && JSON.stringify(refDefs) === JSON.stringify(item.refDefs);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mouseover 事件处理辅助函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 查找可能显示 tooltip 的元素 */
function 查找Tooltip元素(target: HTMLElement): HTMLElement | false {
    return hasClosestByAttribute(target, "data-type", "a", true) ||
        hasClosestByClassName(target, "ariaLabel") ||
        hasClosestByAttribute(target, "data-type", "tab-header") ||
        hasClosestByAttribute(target, "data-type", "inline-memo") ||
        hasClosestByClassName(target, "av__calc--ashow") ||
        hasClosestByClassName(target, "av__cell");
}

/** 处理 tooltip 元素的显示逻辑，返回 true 表示应该停止事件传播 */
function 处理Tooltip元素(aElement: HTMLElement, event: MouseEvent): boolean {
    const tooltipInfo = getTooltipInfo(aElement, event.target as HTMLElement);
    if (handleTooltipDisplay(aElement, event, tooltipInfo)) {
        return true;
    }
    hideTooltip();
    return false;
}

/** 处理非 tooltip 元素，检查是否应该隐藏 tooltip */
function 处理非Tooltip元素(target: HTMLElement): void {
    const tipElement = hasClosestByAttribute(target, "id", "tooltip", true);
    if (!tipElement || (
        tipElement && (tipElement.clientHeight >= tipElement.scrollHeight && tipElement.clientWidth >= tipElement.scrollWidth)
    )) {
        hideTooltip();
    }
}

/** 隐藏 Popover 的 setTimeout 回调 */
const 创建隐藏Popover回调 = (event: MouseEvent) => () => {
    hidePopover(event as MouseEvent & { path?: HTMLElement[] });
};

/** 按键触发模式(模式1)处理，返回 true 表示已处理完毕 */
const 处理按键触发模式 = (
    app: App,
    event: MouseEvent,
    aElement: HTMLElement | false,
    clearTimeoutHide: () => void
): boolean => {
    clearTimeoutHide();
    setTimeout(创建隐藏Popover回调(event), Constants.TIMEOUT_INPUT);

    if (!getTarget(event as MouseEvent & { target: HTMLElement }, aElement)) {
        return true;
    }

    // https://github.com/siyuan-note/siyuan/issues/9007
    const relatedTarget = (event as MouseEvent & { relatedTarget?: Node }).relatedTarget;
    if (relatedTarget && !document.contains(relatedTarget)) {
        return true;
    }

    const keyboardState = getSiyuanKeyboardState();
    if (keyboardState.ctrlIsPressed) {
        clearTimeoutHide();
        showPopover(app);
        return true;
    }

    if (keyboardState.shiftIsPressed) {
        clearTimeoutHide();
        showPopover(app, true);
    }
    return true;
};

/** 创建延迟隐藏 Popover 的回调 */
const 创建延迟隐藏回调 = (
    event: MouseEvent,
    aElement: HTMLElement | false,
    getTimeout: () => number
) => () => {
    if (!hidePopover(event as MouseEvent & { path?: HTMLElement[] })) {
        return;
    }
    const popoverTargetElement = getPopoverTargetElement();
    if (!popoverTargetElement && !aElement) {
        clearTimeout(getTimeout());
    }
};

/** 创建延迟显示 Popover 的回调 */
const 创建延迟显示回调 = (
    app: App,
    event: MouseEvent,
    aElement: HTMLElement | false,
    getTimeoutHide: () => number
) => () => {
    if (!getTarget(event as MouseEvent & { target: HTMLElement }, aElement) || isTouchDevice()) {
        return;
    }
    clearTimeout(getTimeoutHide());
    showPopover(app);
};

/** 延迟触发模式(模式0)处理 */
const 处理延迟触发模式 = (
    app: App,
    event: MouseEvent,
    aElement: HTMLElement | false,
    setTimeouts: (t: number, th: number) => void,
    clearTimeouts: () => void
): void => {
    clearTimeouts();

    // 使用对象包装以避免闭包中的相互引用问题
    const timeoutRefs = { timeout: 0, timeoutHide: 0 };

    timeoutRefs.timeoutHide = setTimeout(
        创建延迟隐藏回调(event, aElement, () => timeoutRefs.timeout),
        Constants.TIMEOUT_INPUT
    );

    timeoutRefs.timeout = setTimeout(
        创建延迟显示回调(app, event, aElement, () => timeoutRefs.timeoutHide),
        POPOVER_SHOW_DELAY_MS
    );

    setTimeouts(timeoutRefs.timeout, timeoutRefs.timeoutHide);
};

/** 处理 mouseover 事件 */
const 处理Mouseover事件 = (
    app: App,
    event: MouseEvent,
    clearTimeouts: () => void,
    setTimeouts: (t: number, th: number) => void,
    clearTimeoutHide: () => void
): void => {
    // 前置条件检查
    if (!hasSiyuanConfig() || !getSiyuanMenus() ||
        getSiyuanDragElement() || document.onmousemove) {
        hideTooltip();
        return;
    }

    const target = event.target as HTMLElement;
    const aElement = 查找Tooltip元素(target);

    // 处理 tooltip
    if (aElement && 处理Tooltip元素(aElement, event)) {
        event.stopPropagation();
        return;
    }

    if (!aElement) {
        处理非Tooltip元素(target);
    }

    // Popover 模式处理
    const keyboardState = getSiyuanKeyboardState();
    if (getSiyuanConfig().editor.floatWindowMode === 1 || keyboardState.shiftIsPressed) {
        处理按键触发模式(app, event, aElement, clearTimeoutHide);
        return;
    }

    处理延迟触发模式(app, event, aElement, setTimeouts, clearTimeouts);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 主入口函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Timeout 状态管理器 */
class TimeoutManager {
    private timeout = 0;
    private timeoutHide = 0;

    clearAll = () => {
        clearTimeout(this.timeout);
        clearTimeout(this.timeoutHide);
    };

    set = (t: number, th: number) => {
        this.timeout = t;
        this.timeoutHide = th;
    };

    clearHide = () => clearTimeout(this.timeoutHide);
}

/**
 * 初始化块 Popover
 * 用于编辑器内容块引用/backlinks/tag/bookmark/套娃中
 */
export const initBlockPopover = (app: App) => {
    const timeoutManager = new TimeoutManager();

    document.addEventListener("mouseover", (event: MouseEvent) => {
        处理Mouseover事件(app, event, timeoutManager.clearAll, timeoutManager.set, timeoutManager.clearHide);
    });
};

/**
 * 显示 Popover
 */
export const showPopover = async (app: App, showRef = false) => {
    const popoverTargetElement = getPopoverTargetElement();
    const menuData = getSiyuanMenus()?.menu?.data;
    if (!popoverTargetElement || (menuData && menuData === popoverTargetElement)) {
        return;
    }

    const { refDefs, originalRefBlockIDs } = await getRefDefs(showRef);

    if (refDefs.length === 0) {
        return;
    }

    // 检查是否已有相同内容的 pin 住的面板
    const blockPanels = getSiyuanBlockPanels();
    const hasPin = blockPanels.some(是已固定的相同面板(refDefs));

    // 创建新面板
    if (!hasPin && popoverTargetElement.parentElement &&
        popoverTargetElement.parentElement.style.opacity !== "0.38" // 反向面板图标拖拽时不应该弹层
    ) {
        blockPanels.push(new BlockPanel({
            app,
            targetElement: popoverTargetElement,
            isBacklink: showRef || popoverTargetElement.classList.contains("protyle-attr--refcount") || popoverTargetElement.classList.contains("counter"),
            refDefs,
            originalRefBlockIDs,
        }));
    }
    // 不能清除，否则ctrl 后 shift 就无效 popoverTargetElement = undefined;
};
