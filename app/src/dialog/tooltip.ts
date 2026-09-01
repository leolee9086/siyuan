/**
 * 用途：判断当前是否为移动端环境。
 * 使用范围：tooltip 显示前的环境检测。
 * 解耦评估：平台判断通过 imports.ts 转发，避免直接路径耦合。
 */
import { isMobile } from "./imports";
/**
 * 用途：获取视口宽度。
 * 使用范围：tooltip 位置边界计算。
 * 解耦评估：尺寸读取已被 environment 层封装。
 */
import { getWindowWidth } from "./imports";
/**
 * 用途：获取视口高度。
 * 使用范围：tooltip 位置边界计算。
 * 解耦评估：尺寸读取已被 environment 层封装。
 */
import { getWindowHeight } from "./imports";
/**
 * 用途：获取 DOMPurify 实例。
 * 使用范围：tooltip HTML 内容安全过滤。
 * 解耦评估：DOMPurify 读取已被 environment 层封装。
 */
import { getDOMPurify } from "./imports";
/** 用途：Tooltip 定位和公共调用参数类型。使用范围：本模块内部定位策略。解耦评估：同目录类型契约。 */
import type {ITooltipCalculationContext} from "./dialog.types";
/** 用途：Tooltip 溢出参数类型。使用范围：本模块垂直边界调整。解耦评估：纯类型契约无需运行时注入。 */
import type {ITooltipOverflowContext} from "./dialog.types";
/** 用途：Tooltip 方向定位参数类型。使用范围：本模块四向定位策略。解耦评估：纯类型契约无需运行时注入。 */
import type {ITooltipPositionContext} from "./dialog.types";

/**
 * 用途：解析 position 属性中的偏移量数值部分
 * 使用范围：tooltip 各方向定位计算
 */
const parsePositionDiff = (position: string | null, space: number) => {
    return (position ? parseInt(position) : NaN) || space;
};
/**
 * 用途：获取消息元素容器，清空之前的位置样式
 * 使用范围：showTooltip 中每次显示前重置 tooltip 位置
 */
const getTooltipElement = () => {
    const messageElement = document.getElementById("tooltip");
    messageElement.removeAttribute("style");
    return messageElement;
};

/**
 * 用途：处理多行元素时选择最适合的 ClientRect
 * 使用范围：当 target 跨行时调用
 */
const findTargetRect = (target: Element, event: MouseEvent | undefined, targetRect: DOMRect) => {
    const clientRects = Array.from(target.getClientRects());
    if (clientRects.length <= 1) {
        return targetRect;
    }
    // 跨行元素：根据是否有鼠标事件选择合适的矩形
    if (event) {
        // 选择鼠标附近的矩形
        let resultRect = targetRect;
        for (const item of clientRects) {
            // 判断鼠标 Y 坐标是否在当前行的垂直范围内（包含 3px 容差）
            if (event.clientY >= item.top - 3 && event.clientY <= item.bottom) {
                resultRect = item;
            }
        }
        return resultRect;
    }
    // 选择宽度最大的矩形
    let resultRect = targetRect;
    let lastWidth = 0;
    for (const item of clientRects) {
        // 选出宽度最大的矩形作为 tooltip 的定位参考
        if (item.width > lastWidth) {
            resultRect = item;
            lastWidth = item.width;
        }
    }
    return resultRect;
};

/**
 * 用途：在父元素右侧定位（parentE）
 * 使用范围：文件树、大纲、反向链接等
 */
const positionParentE = (messageElement: HTMLElement, parentRect: DOMRect) => {
    const windowHeight = getWindowHeight();
    const windowWidth = getWindowWidth();
    // 垂直居中于父元素
    let top = Math.max(0, parentRect.top - (messageElement.clientHeight - parentRect.height) / 2);
    // 防止 tooltip 超出视口下边界
    if (top > windowHeight - messageElement.clientHeight) {
        top = windowHeight - messageElement.clientHeight;
    }
    let left = parentRect.right + 8;
    // 若右侧溢出则显示在左侧
    if (left + messageElement.clientWidth > windowWidth) {
        left = parentRect.left - messageElement.clientWidth - 8;
    }
    return { left, top };
};

/**
 * 用途：在父元素左侧定位（parentW）
 * 使用范围：属性视图、列、选择器等
 */
const positionParentW = (messageElement: HTMLElement, parentRect: DOMRect) => {
    const windowHeight = getWindowHeight();
    // 垂直居中于父元素
    let top = Math.max(0, parentRect.top - (messageElement.clientHeight - parentRect.height) / 2);
    // 防止 tooltip 超出视口下边界
    if (top > windowHeight - messageElement.clientHeight) {
        top = windowHeight - messageElement.clientHeight;
    }
    let left = parentRect.left - messageElement.clientWidth;
    // 若左侧溢出则显示在右侧
    if (left < 0) {
        left = parentRect.right;
    }
    return { left, top };
};

/**
 * 用途：在目标元素左侧定位（west）
 * 使用范围：gutter、标题图标、av relation 等
 */
const positionWest = ({messageElement, targetRect, position, space}: ITooltipPositionContext) => {
    const positionDiff = parsePositionDiff(position, space);
    const windowHeight = getWindowHeight();
    // 垂直居中于目标元素
    let top = Math.max(0, targetRect.top - (messageElement.clientHeight - targetRect.height) / 2);
    // 防止 tooltip 超出视口下边界
    if (top > windowHeight - messageElement.clientHeight) {
        top = windowHeight - messageElement.clientHeight;
    }
    let left = targetRect.left - messageElement.clientWidth - positionDiff;
    // 若左侧溢出则显示在右侧
    if (left < 0) {
        left = targetRect.right;
    }
    return { left, top };
};

/**
 * 用途：在目标元素右侧定位（east）
 * 使用范围：布局菜单等
 */
const positionEast = ({messageElement, targetRect, position, space}: ITooltipPositionContext) => {
    const positionDiff = parsePositionDiff(position, space);
    const windowHeight = getWindowHeight();
    const windowWidth = getWindowWidth();
    // 垂直居中于目标元素
    let top = Math.max(0, targetRect.top - (messageElement.clientHeight - targetRect.height) / 2);
    // 防止 tooltip 超出视口下边界
    if (top > windowHeight - messageElement.clientHeight) {
        top = windowHeight - messageElement.clientHeight;
    }
    let left = targetRect.right + positionDiff;
    // 若右侧溢出则显示在左侧
    if (left + messageElement.clientWidth > windowWidth) {
        left = targetRect.left - messageElement.clientWidth - positionDiff;
    }
    return { left, top };
};

/**
 * 用途：当 north 定位上方空间不足时，选择下方或置顶
 */
const handleNorthTopOverflow = ({
    targetRect,
    positionDiff,
    messageElement,
    windowHeight,
}: ITooltipOverflowContext) => {
    // 下方空间更多时显示在元素下方
    if (targetRect.top < windowHeight - targetRect.bottom) {
        const top = targetRect.bottom + positionDiff;
        messageElement.style.maxHeight = (windowHeight - top) + "px";
        return top;
    }
    // 否则置顶显示
    messageElement.style.maxHeight = (targetRect.top - positionDiff) + "px";
    return 0;
};

/**
 * 用途：在目标元素上方定位（north）
 * 使用范围：属性视图、列、多选描述、protyle-icon 等
 */
const positionNorth = ({messageElement, targetRect, position, space}: ITooltipPositionContext) => {
    const positionDiff = parsePositionDiff(position, space);
    const windowHeight = getWindowHeight();
    const windowWidth = getWindowWidth();
    let left = Math.max(0, targetRect.left - (messageElement.clientWidth - targetRect.width) / 2);
    let top = targetRect.top - messageElement.clientHeight - positionDiff;

    // 若上方空间不足则根据可用空间决定显示位置
    if (top < 0) {
        top = handleNorthTopOverflow({targetRect, positionDiff, messageElement, windowHeight});
    }
    // 防止 tooltip 超出视口右边界
    if (left + messageElement.clientWidth > windowWidth) {
        left = windowWidth - messageElement.clientWidth;
    }
    return { left, top };
};

/**
 * 用途：当 south 定位下方空间不足时，选择上方或限制高度
 */
const handleSouthBottomOverflow = ({
    targetRect,
    positionDiff,
    top,
    messageElement,
    windowHeight,
}: ITooltipOverflowContext & {top: number}) => {
    // 上方空间更多时显示在元素上方
    if (targetRect.top - positionDiff > windowHeight - top) {
        const newTop = Math.max(0, targetRect.top - positionDiff - messageElement.clientHeight);
        messageElement.style.maxHeight = (targetRect.top - positionDiff) + "px";
        return newTop;
    }
    // 否则限制最大高度
    messageElement.style.maxHeight = (windowHeight - top) + "px";
    return top;
};

/**
 * 用途：在目标元素下方定位（south / 默认值）
 * 使用范围：默认定位方式
 */
const positionSouth = ({messageElement, targetRect, position, space}: ITooltipPositionContext) => {
    const positionDiff = parsePositionDiff(position, space);
    const windowHeight = getWindowHeight();
    const windowWidth = getWindowWidth();
    let left = Math.max(0, targetRect.left - (messageElement.clientWidth - targetRect.width) / 2);
    let top = targetRect.bottom + positionDiff;

    // 若下方空间不足则调整显示位置
    if (top + messageElement.clientHeight > windowHeight) {
        top = handleSouthBottomOverflow({targetRect, positionDiff, top, messageElement, windowHeight});
    }
    // 防止 tooltip 超出视口右边界
    if (left + messageElement.clientWidth > windowWidth) {
        left = windowWidth - messageElement.clientWidth;
    }
    return { left, top };
};

/**
 * 用途：根据 position 属性选择对应的定位策略并计算最终位置
 * 使用范围：showTooltip 中确定 tooltip 展示位置
 */
const calculateTooltipPosition = ({
    messageElement,
    target,
    targetRect,
    position,
    space,
}: ITooltipCalculationContext) => {
    const parentRect = target.parentElement.getBoundingClientRect();

    if (position === "parentE") {
        return positionParentE(messageElement, parentRect);
    }
    if (position === "parentW") {
        return positionParentW(messageElement, parentRect);
    }
    if (position?.endsWith("west")) {
        return positionWest({messageElement, targetRect, position, space});
    }
    if (position?.endsWith("east")) {
        return positionEast({messageElement, targetRect, position, space});
    }
    if (position?.endsWith("north")) {
        return positionNorth({messageElement, targetRect, position, space});
    }
    // south / 默认值
    return positionSouth({messageElement, targetRect, position, space});
};

/**
 * 用途：显示 tooltip 提示信息，根据目标元素位置自动计算最佳展示方向
 * 调用时机：当用户悬停或聚焦到需要提示信息的 UI 元素时调用
 * @同步豁免: UI构建 - 必须在当前鼠标事件内完成尺寸读取和定位，延后会使用到变化后的目标布局
 */
export const showTooltip = (
    message: string,
    target: Element,
    tooltipClass?: string,
    event?: MouseEvent,
    space: number = 0.5,
    positionOverride?: string,
) => {
    if (isMobile() || !message) {
        return;
    }
    const messageElement = getTooltipElement();
    // 允许插件在展示前通过事件总线调整提示内容
    const showDetail = {
        message,
        target,
        tooltipElement: messageElement,
    };
    window.siyuan.ws.app.plugins.forEach(plugin => {
        plugin.eventBus.emit("before-show-tooltip", showDetail);
    });
    message = showDetail.message;
    if (!message) {
        hideTooltip();
        return;
    }
    let targetRect = target.getBoundingClientRect();
    // 处理跨行元素，选择合适的矩形
    targetRect = findTargetRect(target, event, targetRect);

    // 目标元素不可见时隐藏 tooltip
    if (targetRect.height === 0) {
        hideTooltip();
        return;
    }
    messageElement.className = tooltipClass ? `tooltip tooltip--${tooltipClass}` : "tooltip";
    // 使用 DOMPurify 过滤 HTML 防止 XSS
    messageElement.innerHTML = getDOMPurify().sanitize(message);
    // 定位来源优先使用显式覆盖值，未提供时回退到触发元素的 data-position 属性
    const position = positionOverride || target.getAttribute("data-position");
    const { left, top } = calculateTooltipPosition({messageElement, target, targetRect, position, space});

    messageElement.style.top = top + "px";
    messageElement.style.left = Math.max(0, left) + "px";
    // 与 data-position 同套风格：触发元素可用 data-delay 指定悬浮延迟（毫秒），未设置时沿用 SCSS 默认值
    const tooltipDelay = target.getAttribute("data-delay");
    if (tooltipDelay) {
        messageElement.style.animationDelay = tooltipDelay + "ms";
    }
};

/**
 * 用途：隐藏 tooltip 提示信息
 * 调用时机：当用户移出目标元素或 tooltip 超时时调用
 * @同步豁免: UI构建 - 必须在当前鼠标事件内立即隐藏，避免后续事件重新显示时出现竞态闪烁
 */
export const hideTooltip = () => {
    const messageElement = document.getElementById("tooltip");
    // 已处于隐藏状态时不重复处理，也避免向插件重复广播事件
    if (messageElement.classList.contains("fn__none")) {
        return;
    }
    window.siyuan.ws.app.plugins.forEach(plugin => {
        plugin.eventBus.emit("before-hide-tooltip", {
            tooltipElement: messageElement,
        });
    });
    messageElement.classList.add("fn__none");
};
