/** 用途：读取定位计算需要的工具栏高度常量；使用范围：`setPosition` 的边界裁剪；解耦评估：常量属于全局配置边界，通过本目录网关依赖最稳定。 */
import { Constants } from "./imports";
/** 用途：读取当前视口高度；使用范围：`setPosition` 的纵向越界判断；解耦评估：窗口访问已在 environment 封装，通过网关访问可避免直接触碰全局对象。 */
import { getWindowHeight } from "./imports";
/** 用途：读取当前视口宽度；使用范围：`setPosition` 的横向越界判断；解耦评估：窗口访问已在 environment 封装，通过网关访问可避免直接触碰全局对象。 */
import { getWindowWidth } from "./imports";

/** @简洁函数 @显式返回类型原因: 返回 {width, height} 结构化数据，调用方解构后用于视口裁剪计算，显式类型可防止结构字段丢失。 */
const getViewportSize = (): { width: number; height: number } => ({ width: getWindowWidth(), height: getWindowHeight() });

/**
 * 计算垂直方向的最终 top 值，把弹层限制在工具栏和视口范围内。
 * 调用时机：`calculatePosition` 在检测到可能越界时同步调用。
 * 问题/改进：当前策略优先维持元素完整显示，若未来需要跟随不同菜单样式可继续细化。
 * @显式返回类型原因: 返回 top CSS 值或 undefined，调用方需处理 undefined 分支以决定是否覆盖默认 top。显式联合类型可防止遗漏空值处理。
 */
const resolveTopPosition = (input: {
    y: number;
    elementHeight: number;
    elementTop: number;
    elementBottom: number;
    targetHeight: number;
    viewportHeight: number;
}): string | undefined => {
    const touchesToolbar = input.elementTop < Constants.SIZE_TOOLBAR_HEIGHT;
    if (touchesToolbar) {
        return `${Constants.SIZE_TOOLBAR_HEIGHT}px`;
    }
    const exceedsViewportBottom = input.elementBottom > input.viewportHeight;
    if (!exceedsViewportBottom) {
        return undefined;
    }
    const shiftedTop = input.y - input.elementHeight - input.targetHeight;
    const staysBelowToolbar = shiftedTop > Constants.SIZE_TOOLBAR_HEIGHT;
    const fitsAfterShift = shiftedTop + input.elementHeight < input.viewportHeight;
    const canMoveAboveTarget = staysBelowToolbar && fitsAfterShift;
    if (canMoveAboveTarget) {
        return `${shiftedTop}px`;
    }
    const clampedTop = Math.max(Constants.SIZE_TOOLBAR_HEIGHT, input.viewportHeight - input.elementHeight);
    return `${clampedTop}px`;
};

/**
 * 计算弹层在当前视口中的修正位置，只负责几何结果，不直接操作 DOM。
 * 调用时机：`setPosition` 在写入初始坐标后立即调用。
 * 问题/改进：当前返回轻量字符串结果，若未来需要更多诊断信息可扩展返回结构。
 * @显式返回类型原因: 返回结构化位置修正对象，调用方解构后分别写入 top/left。显式类型可确保调用方正确处理所有字段。
 */
const calculatePosition = (input: {
    y: number;
    elementWidth: number;
    elementHeight: number;
    elementTop: number;
    elementBottom: number;
    elementLeft: number;
    elementRight: number;
    targetHeight: number;
    targetLeft: number;
    viewport: { width: number; height: number };
}): { top?: string; left?: string } => {
    const position: { top?: string; left?: string } = {};
    const nextTop = resolveTopPosition({
        y: input.y,
        elementHeight: input.elementHeight,
        elementTop: input.elementTop,
        elementBottom: input.elementBottom,
        targetHeight: input.targetHeight,
        viewportHeight: input.viewport.height,
    });
    const hasTopAdjustment = nextTop !== undefined;
    if (hasTopAdjustment) {
        position.top = nextTop;
    }
    const exceedsViewportRight = input.elementRight > input.viewport.width;
    if (exceedsViewportRight) {
        position.left = `${input.viewport.width - input.elementWidth - input.targetLeft}px`;
        return position;
    }
    const exceedsViewportLeft = input.elementLeft < 0;
    if (exceedsViewportLeft) {
        position.left = "0";
    }
    return position;
};

/**
 * 设置弹层的最终位置，先写入期望坐标，再按视口边界同步回调到可见范围内。
 * 调用时机：菜单、面板、提示层渲染完成并拿到尺寸后立即调用。
 * 问题/改进：当前依赖同步布局读取，如果未来能提前拿到尺寸可减少一次回流。
 * @同步豁免: 需要绝对同步的DOM访问
 * 公共定位 API 被菜单、工具栏和浮层广泛调用，保持签名可避免把无关迁移扩散到调用语义。
 */
/** @参数豁免: 遗留代码 - 公共定位 API 签名 */
export function setPosition(element: HTMLElement, x: number, y: number, targetHeight = 0, targetLeft = 0) {
    element.style.top = `${y}px`;
    element.style.left = `${x}px`;
    const rect = element.getBoundingClientRect();
    const viewport = getViewportSize();
    const nextPosition = calculatePosition({
        y,
        elementWidth: rect.width,
        elementHeight: rect.height,
        elementTop: rect.top,
        elementBottom: rect.bottom,
        elementLeft: rect.left,
        elementRight: rect.right,
        targetHeight,
        targetLeft,
        viewport
    });
    const nextTop = nextPosition.top;
    if (nextTop !== undefined) {
        element.style.top = nextTop;
    }
    const nextLeft = nextPosition.left;
    if (nextLeft === undefined) {
        return;
    }
    element.style.left = nextLeft;
}
