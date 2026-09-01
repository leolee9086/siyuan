/**
 * Block Popover 模块
 * 用于编辑器内容块引用/backlinks/tag/bookmark/套娃中的悬浮面板
 */

/** 用途：块面板类。使用范围：Popover 内容渲染。解耦评估：同目录模块直接导入。 */
import { BlockPanel } from "./panel/Panel";
/** 用途：通过属性查找 DOM 元素。使用范围：Popover 定位。解耦评估：通过 ./imports 转发。 */
import { hasClosestByAttribute } from "./imports";
/** 用途：通过类名查找最近祖先。使用范围：Popover 定位。解耦评估：通过 ./imports 转发。 */
import { hasClosestByClassName } from "./imports";
/** 用途：隐藏 Tooltip。使用范围：Popover 关闭时清理。解耦评估：通过 ./imports 转发。 */
import { hideTooltip } from "./imports";
/** 用途：应用实例类型。使用范围：Popover 上下文。解耦评估：通过 ./imports 转发。 */
import type { AppFacade } from "./imports";
/** 用途：系统常量。使用范围：Popover 配置。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：触屏设备判断。使用范围：Popover 交互适配。解耦评估：通过 ./imports 转发。 */
import { isTouchDevice } from "./imports";
/** 用途：安全获取 SiYuan 配置和状态。使用范围：Popover 初始化。解耦评估：通过 ./imports 转发。 */
import { getSiyuanBlockPanels } from "./imports";
/** 用途：获取键盘状态。使用范围：Popover 交互判断。解耦评估：通过 ./imports 转发。 */
import { getSiyuanKeyboardState } from "./imports";
/** 用途：获取拖拽元素。使用范围：Popover 拖拽状态。解耦评估：通过 ./imports 转发。 */
import { getSiyuanDragElement } from "./imports";
/** 用途：判断配置是否存在。使用范围：Popover 初始化守卫。解耦评估：通过 ./imports 转发。 */
import { hasSiyuanConfig } from "./imports";
/** 用途：获取菜单集合。使用范围：Popover 菜单。解耦评估：通过 ./imports 转发。 */
import { getSiyuanMenus } from "./imports";
/** 用途：获取配置。使用范围：Popover 行为配置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：安全 setTimeout。使用范围：Popover 延迟操作。解耦评估：通过 ./imports 转发。 */
import { setTimeout } from "./imports";
/** 用途：鼠标事件守卫和类型。使用范围：Popover 事件处理。解耦评估：通过 ./imports 转发。 */
import { asMouseEventWithPath } from "./imports";
/** 用途：鼠标事件 HTML 目标守卫。使用范围：Popover 事件处理。解耦评估：通过 ./imports 转发。 */
import { isMouseEventWithHTMLTarget } from "./imports";
/** 用途：鼠标事件路径类型。使用范围：Popover 事件类型标注。解耦评估：通过 ./imports 转发。 */
import type { MouseEventWithPath } from "./imports";
/** 用途：HTMLElement 类型守卫。使用范围：Popover DOM 操作。解耦评估：通过 ./imports 转发。 */
import { isHTMLElement } from "./imports";

// 子模块导入
/** 用途：Tooltip 工具提示信息类型。使用范围：Popover Tooltip 配置。解耦评估：同目录子模块。 */
import type { TooltipInfo } from "./popover/tooltip";
/** 用途：Tooltip 信息获取函数。使用范围：Popover 初始化。解耦评估：同目录子模块。 */
import { getTooltipInfo } from "./popover/tooltip";
/** 用途：Tooltip 显示处理函数。使用范围：Popover Tooltip 控制。解耦评估：同目录子模块。 */
import { handleTooltipDisplay } from "./popover/tooltip";
/** 用途：中断未完成的 tooltip 信息请求。使用范围：Mouseover 事件开始时调用。解耦评估：同目录子模块。 */
import { abortPendingTooltipRequest } from "./popover/tooltip";
/** 用途：获取 Popover 定位目标。使用范围：Popover 显示定位。解耦评估：同目录子模块。 */
import { getPopoverTargetElement } from "./popover/target";
/** 用途：隐藏 Popover。使用范围：Popover 关闭。解耦评估：同目录子模块。 */
import { hidePopover } from "./popover/target";
/** 用途：获取 Popover 目标。使用范围：Popover 定位。解耦评估：同目录子模块。 */
import { getTarget } from "./popover/target";
/** 用途：引用定义获取。使用范围：Popover 内容渲染。解耦评估：同目录子模块。 */
import { getRefDefs } from "./popover/refDefs";

// 重新导出类型供外部使用
export type { TooltipInfo };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 常量定义
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
function asEventWithHTMLTarget(event: MouseEvent) {
    if (isMouseEventWithHTMLTarget(event)) {
        return event;
    }
    return undefined;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mouseover 事件处理辅助函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 查找可能显示 tooltip 的元素 */
function 查找Tooltip元素(target: HTMLElement) {
    return hasClosestByAttribute(target, "data-type", "a", true) ||
        hasClosestByClassName(target, "ariaLabel") ||
        hasClosestByAttribute(target, "data-type", "tab-header") ||
        hasClosestByAttribute(target, "data-type", "inline-memo") ||
        hasClosestByClassName(target, "av__calc--ashow") ||
        hasClosestByClassName(target, "av__cell");
}

/** 处理 tooltip 元素的显示逻辑，返回 true 表示应该停止事件传播 */
function 处理Tooltip元素(aElement: HTMLElement, event: MouseEvent, target: HTMLElement) {
    const tooltipInfo = getTooltipInfo(aElement, target);
    if (handleTooltipDisplay(aElement, event, tooltipInfo)) {
        return true;
    }
    hideTooltip();
    return false;
}

/** 处理非 tooltip 元素，检查是否应该隐藏 tooltip */
function 处理非Tooltip元素(target: HTMLElement) {
    const tipElement = hasClosestByAttribute(target, "id", "tooltip", true);
    // 鼠标位于可滚动 Tooltip 内时保持显示，其他非触发区域沿用即时隐藏行为。
    if (!tipElement || tipElement.clientHeight >= tipElement.scrollHeight) {
        hideTooltip();
    }
}

/** 隐藏 Popover 的 setTimeout 回调 */
const 创建隐藏Popover回调 = (event: MouseEventWithPath) => () => {
    hidePopover(event);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Android 平板支持（移植自上游 v3.8.0）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** pointermove 日志节流间隔（毫秒），避免高频指针移动刷爆原生日志 */
const POINTER_MOVE_LOG_INTERVAL = 250;
let lastPointerMoveLogTime = 0;

/** 记录 Android 输入事件详情，交由原生端（window.JSAndroid.logInputEvent）诊断悬浮窗交互问题 */
const 记录Android输入事件 = (event: MouseEvent | PointerEvent) => {
    if (!window.JSAndroid?.logInputEvent) {
        return;
    }
    const target = event.target instanceof Element ? event.target : undefined;
    const pointerEvent = event as PointerEvent;
    const targetClasses = target?.getAttribute("class")?.trim().split(/\s+/).slice(0, 4).join(".") || "";
    const targetDetails = target ? [
        target.tagName.toLowerCase(),
        target.getAttribute("data-type") ? `data-type=${target.getAttribute("data-type")}` : "",
        targetClasses ? `class=${targetClasses}` : "",
    ].filter(Boolean).join(" ") : "unknown";
    window.JSAndroid.logInputEvent([
        `type=${event.type}`,
        `pointerType=${pointerEvent.pointerType || "unavailable"}`,
        `buttons=${event.buttons}`,
        `button=${event.button}`,
        `pressure=${typeof pointerEvent.pressure === "number" ? pointerEvent.pressure : "unavailable"}`,
        `primary=${typeof pointerEvent.isPrimary === "boolean" ? pointerEvent.isPrimary : "unavailable"}`,
        `client=(${Math.round(event.clientX)},${Math.round(event.clientY)})`,
        `target=${targetDetails}`,
        `touchDevice=${isTouchDevice()}`,
        // 配置可能在启动早期尚未注入，此处仅为诊断输出，不允许抛错
        `floatWindowMode=${hasSiyuanConfig() ? getSiyuanConfig().editor.floatWindowMode : "unavailable"}`,
    ].join(", "));
};

/**
 * 注册 Android 平板悬停笔的浮窗处理
 * 上游 v3.8.0：Android 平板通过 Pointer Events 单独处理悬停笔浮窗，
 * 触发逻辑与鼠标延迟模式(模式0)一致，但使用独立的定时器组。
 */
const 注册Android悬停笔处理 = (app: AppFacade, timeoutManager: TimeoutManager) => {
    let penTimeout = 0;
    let penTimeoutHide = 0;

    /** 悬停笔移出、按下或取消时清理悬停定时器 */
    const 取消悬停笔悬停 = (event: PointerEvent) => {
        记录Android输入事件(event);
        if (event.pointerType === "pen") {
            clearTimeout(penTimeout);
            clearTimeout(penTimeoutHide);
        }
    };

    document.addEventListener("pointerover", (event: PointerEvent) => {
        记录Android输入事件(event);
        if (event.pointerType !== "pen") {
            return;
        }
        clearTimeout(penTimeout);
        clearTimeout(penTimeoutHide);
        if (event.buttons !== 0 ||
            !hasSiyuanConfig() || !getSiyuanMenus() ||
            getSiyuanDragElement() || document.onmousemove ||
            getSiyuanConfig().editor.floatWindowMode !== 0 || getSiyuanKeyboardState().shiftIsPressed) {
            return;
        }
        const target = event.target;
        if (!isHTMLElement(target)) {
            return;
        }
        const aElement = 查找Tooltip元素(target);
        // @setTimeout豁免: 用户感知延迟 - 需要等待用户输入稳定后再隐藏浮窗，防止快速移动时闪烁
        penTimeoutHide = setTimeout(() => {
            if (!hidePopover(asMouseEventWithPath(event))) {
                return;
            }
            if (!getPopoverTargetElement() && !aElement) {
                clearTimeout(penTimeout);
            }
        }, Constants.TIMEOUT_INPUT);
        // @setTimeout豁免: 用户感知延迟 - 悬停延迟显示，避免误触发浮窗
        penTimeout = setTimeout(() => {
            const eventWithTarget = asEventWithHTMLTarget(event);
            if (!eventWithTarget || !getTarget(eventWithTarget, aElement)) {
                return;
            }
            clearTimeout(penTimeoutHide);
            // 同步清理鼠标链路的隐藏定时器，避免刚弹出的悬停笔浮窗被其关闭
            timeoutManager.clearHide();
            showPopover(app);
        }, getSiyuanConfig().editor.floatWindowDelay);
    }, {capture: true, passive: true});

    document.addEventListener("pointermove", (event: PointerEvent) => {
        const now = performance.now();
        if (now - lastPointerMoveLogTime < POINTER_MOVE_LOG_INTERVAL) {
            return;
        }
        lastPointerMoveLogTime = now;
        记录Android输入事件(event);
    }, {capture: true, passive: true});

    /** 悬停笔按下时立即关闭已打开的浮窗 */
    const 处理悬停笔按下 = (event: PointerEvent) => {
        记录Android输入事件(event);
        if (event.pointerType !== "pen") {
            return;
        }
        取消悬停笔悬停(event);
        if (getSiyuanMenus()) {
            hidePopover(asMouseEventWithPath(event));
        }
    };

    document.addEventListener("pointerout", 取消悬停笔悬停, {capture: true, passive: true});
    document.addEventListener("pointerdown", 处理悬停笔按下, {capture: true, passive: true});
    document.addEventListener("pointercancel", 取消悬停笔悬停, {capture: true, passive: true});
};

/** 表示一次 Popover 触发模式计算所需的应用、事件、链接目标和计时器状态。 */
interface IPopoverModeContext {
    app: AppFacade;
    event: MouseEventWithPath;
    aElement: HTMLElement | false;
    timeoutManager: TimeoutManager;
}

/** 表示全局 mouseover 入口传入业务处理器的稳定依赖，关联同一 Popover 计时器实例。 */
interface IMouseoverContext {
    app: AppFacade;
    event: MouseEvent;
    timeoutManager: TimeoutManager;
}
/**
 * 按键触发模式(模式1)处理，返回 true 表示已处理完毕
 * 当用户配置为按键触发模式或按住 Shift 键时调用
 */
const 处理按键触发模式 = ({app, event, aElement, timeoutManager}: IPopoverModeContext) => {
    timeoutManager.clearHide();
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
        timeoutManager.clearHide();
        showPopover(app);
        return true;
    }

    if (keyboardState.shiftIsPressed) {
        timeoutManager.clearHide();
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
const 创建延迟显示回调 = ({app, event, aElement, timeoutManager}: IPopoverModeContext) => () => {
    const eventWithTarget = asEventWithHTMLTarget(event);
    if (!eventWithTarget || !getTarget(eventWithTarget, aElement) || isTouchDevice()) {
        return;
    }
    timeoutManager.clearHide();
    showPopover(app);
};

/** 延迟触发模式(模式0)处理 */
const 处理延迟触发模式 = ({app, event, aElement, timeoutManager}: IPopoverModeContext) => {
    timeoutManager.clearAll();

    // 使用对象包装以避免闭包中的相互引用问题
    const timeoutRefs = { timeout: 0, timeoutHide: 0 };

    // @setTimeout豁免: 用户感知延迟 - 防抖处理，等待用户鼠标移动稳定后再隐藏 popover
    timeoutRefs.timeoutHide = setTimeout(
        创建延迟隐藏回调(event, aElement, () => timeoutRefs.timeout),
        Constants.TIMEOUT_INPUT
    );

    // @setTimeout豁免: 用户感知延迟 - 悬停延迟显示，避免鼠标快速划过时频繁弹出 popover
    timeoutRefs.timeout = setTimeout(
        创建延迟显示回调({app, event, aElement, timeoutManager}),
        getSiyuanConfig().editor.floatWindowDelay
    );

    timeoutManager.set(timeoutRefs.timeout, timeoutRefs.timeoutHide);
};

/** 处理 mouseover 事件 */
const 处理Mouseover事件 = ({app, event, timeoutManager}: IMouseoverContext) => {
    // 鼠标进入新元素时中断上一轮尚未完成的 tooltip 信息请求
    abortPendingTooltipRequest();

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
        处理按键触发模式({app, event: eventWithPath, aElement, timeoutManager});
        return;
    }

    处理延迟触发模式({app, event: eventWithPath, aElement, timeoutManager});
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
export const initBlockPopover = (app: AppFacade) => {
    const timeoutManager = new TimeoutManager();

    document.addEventListener("mouseover", (event: MouseEvent) => {
        // 上游 v3.8.0：进入新元素时先记录 Android 输入事件，供平板端诊断悬浮窗交互
        记录Android输入事件(event);
        处理Mouseover事件({app, event, timeoutManager});
    });

    if (window.JSAndroid) {
        // Android 平板通过 Pointer Events 单独处理悬停笔浮窗。
        注册Android悬停笔处理(app, timeoutManager);
    }
};

/**
 * 显示 Popover
 */
export const showPopover = async (app: AppFacade, showRef = false) => {
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
