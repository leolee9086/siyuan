/**
 * Block Popover 模块
 * 用于编辑器内容块引用/backlinks/tag/bookmark/套娃中的悬浮面板
 */

import { BlockPanel } from "./Panel";
import { hasClosestByAttribute, hasClosestByClassName } from "../protyle/util/hasClosest";
import { hideTooltip } from "../dialog/tooltip";
import { App } from "../index";
import { Constants } from "../constants";
import { isTouchDevice } from "../util/platform/functions";
import {
    getSiyuanBlockPanels,
    getSiyuanKeyboardState,
    getSiyuanDragElement,
    hasSiyuanConfig,
    getSiyuanMenus,
    getSiyuanConfig,
} from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setTimeout } from "../util/siyuanEnvironments/windowTimer.environment";
import { MouseEventWithPath, asMouseEventWithPath, isMouseEventWithHTMLTarget, MouseEventWithHTMLTarget } from "../util/events/event.guard";
import { isHTMLElement } from "../util/DOM/element.guard";

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
// 类型守卫辅助函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 验证并转换鼠标事件为带有 HTMLElement target 的类型
 * 用于满足 getTarget 函数的类型要求
 * @returns 转换后的事件，如果 target 不是 HTMLElement 则返回 undefined
 */
function asEventWithHTMLTarget(event: MouseEvent): MouseEventWithHTMLTarget | undefined {
    if (isMouseEventWithHTMLTarget(event)) {
        return event;
    }
    return undefined;
}

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
function 处理Tooltip元素(aElement: HTMLElement, event: MouseEvent, target: HTMLElement): boolean {
    const tooltipInfo = getTooltipInfo(aElement, target);
    if (handleTooltipDisplay(aElement, event, tooltipInfo)) {
        return true;
    }
    hideTooltip();
    return false;
}

/** 处理非 tooltip 元素，检查是否应该隐藏 tooltip */
function 处理非Tooltip元素(target: HTMLElement): void {
    const tipElement = hasClosestByAttribute(target, "id", "tooltip", true);
    // 当不存在 tooltip 元素，或者 tooltip 内容未溢出（不需要滚动查看）时，隐藏 tooltip
    if (!tipElement || (
        tipElement && (tipElement.clientHeight >= tipElement.scrollHeight && tipElement.clientWidth >= tipElement.scrollWidth)
    )) {
        hideTooltip();
    }
}

/** 隐藏 Popover 的 setTimeout 回调 */
const 创建隐藏Popover回调 = (event: MouseEventWithPath) => () => {
    hidePopover(event);
};

/**
 * 按键触发模式(模式1)处理，返回 true 表示已处理完毕
 * 当用户配置为按键触发模式或按住 Shift 键时调用
 */
const 处理按键触发模式 = (
    app: App,
    event: MouseEventWithPath,
    target: HTMLElement,
    aElement: HTMLElement | false,
    clearTimeoutHide: () => void
): boolean => {
    clearTimeoutHide();
    // @setTimeout豁免: 用户感知延迟 - 需要等待用户输入稳定后再隐藏 popover，防止快速移动鼠标时闪烁
    setTimeout(创建隐藏Popover回调(event), Constants.TIMEOUT_INPUT);

    const eventWithTarget = asEventWithHTMLTarget(event);
    if (!eventWithTarget || !getTarget(eventWithTarget, aElement)) {
        return true;
    }

    // https://github.com/siyuan-note/siyuan/issues/9007
    // 当 relatedTarget 不在 document 中时（如从 iframe 移出），不处理 popover
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && !document.contains(relatedTarget)) {
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
    event: MouseEventWithPath,
    aElement: HTMLElement | false,
    getTimeout: () => number
) => () => {
    if (!hidePopover(event)) {
        return;
    }
    const popoverTargetElement = getPopoverTargetElement();
    // 当没有 popover 目标元素且没有链接元素时，清除显示定时器
    if (!popoverTargetElement && !aElement) {
        clearTimeout(getTimeout());
    }
};

/** 创建延迟显示 Popover 的回调 */
const 创建延迟显示回调 = (
    app: App,
    event: MouseEventWithPath,
    target: HTMLElement,
    aElement: HTMLElement | false,
    getTimeoutHide: () => number
) => () => {
    const eventWithTarget = asEventWithHTMLTarget(event);
    if (!eventWithTarget || !getTarget(eventWithTarget, aElement) || isTouchDevice()) {
        return;
    }
    clearTimeout(getTimeoutHide());
    showPopover(app);
};

/** 延迟触发模式(模式0)处理 */
const 处理延迟触发模式 = (
    app: App,
    event: MouseEventWithPath,
    target: HTMLElement,
    aElement: HTMLElement | false,
    setTimeouts: (t: number, th: number) => void,
    clearTimeouts: () => void
): void => {
    clearTimeouts();

    // 使用对象包装以避免闭包中的相互引用问题
    const timeoutRefs = { timeout: 0, timeoutHide: 0 };

    // @setTimeout豁免: 用户感知延迟 - 防抖处理，等待用户鼠标移动稳定后再隐藏 popover
    timeoutRefs.timeoutHide = setTimeout(
        创建延迟隐藏回调(event, aElement, () => timeoutRefs.timeout),
        Constants.TIMEOUT_INPUT
    );

    // @setTimeout豁免: 用户感知延迟 - 悬停延迟显示，避免鼠标快速划过时频繁弹出 popover
    timeoutRefs.timeout = setTimeout(
        创建延迟显示回调(app, event, target, aElement, () => timeoutRefs.timeoutHide),
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

    // 使用类型守卫验证 event.target 是 HTMLElement
    const target = event.target;
    if (!isHTMLElement(target)) {
        return;
    }

    const aElement = 查找Tooltip元素(target);

    // 处理 tooltip
    if (aElement && 处理Tooltip元素(aElement, event, target)) {
        event.stopPropagation();
        return;
    }

    if (!aElement) {
        处理非Tooltip元素(target);
    }

    // 将 MouseEvent 转换为 MouseEventWithPath（MouseEvent 本身就兼容此类型）
    const eventWithPath = asMouseEventWithPath(event);

    // Popover 模式处理
    const keyboardState = getSiyuanKeyboardState();
    // 当浮窗模式为按键触发(模式1)或用户按住 Shift 键时，使用按键触发模式
    if (getSiyuanConfig().editor.floatWindowMode === 1 || keyboardState.shiftIsPressed) {
        处理按键触发模式(app, eventWithPath, target, aElement, clearTimeoutHide);
        return;
    }

    处理延迟触发模式(app, eventWithPath, target, aElement, setTimeouts, clearTimeouts);
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
 * @同步豁免: 生命周期 - 此函数在应用初始化时同步调用，用于注册事件监听器，必须同步完成以确保事件处理器在应用启动前就绑定好
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
