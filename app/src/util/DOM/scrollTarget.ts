/** 用途：目标滚动完整参数；使用范围：本文件全部放置分支；解耦评估：纯类型直达真实声明。 */
import type {TargetScrollOptions} from "./scrollTarget.types";

/** 按顶部对齐方式滚动目标，并保留调用域明确提供的顶部空间。 */
const scrollTargetToStart = (
    container: HTMLElement,
    target: HTMLElement,
    options: Extract<TargetScrollOptions, {position: "start"}>
) => {
    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    container.scroll({
        top: container.scrollTop + targetRect.top - containerRect.top - options.topSpacing,
        behavior: options.behavior,
    });
};

/** 仅在目标完全离开容器可视区时按最近边缘滚动。 */
const scrollTargetToNearest = (
    container: HTMLElement,
    target: HTMLElement,
    behavior: ScrollBehavior
) => {
    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    // 目标整体位于可视区上方时，使目标顶部贴近容器顶部。
    if (targetRect.bottom < containerRect.top) {
        container.scroll({
            top: container.scrollTop + targetRect.top - containerRect.top,
            behavior,
        });
        return;
    }
    if (targetRect.top <= containerRect.bottom) {
        return;
    }
    const top = targetRect.height > containerRect.height
        ? container.scrollTop + targetRect.top - containerRect.top
        : container.scrollTop + targetRect.bottom - containerRect.bottom;
    container.scroll({top, behavior});
};

/** 沿用编辑器既有语义，以目标顶部为基准将目标置于容器纵向中央。 */
const scrollTargetToCenter = (
    container: HTMLElement,
    target: HTMLElement,
    behavior: ScrollBehavior
) => {
    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    container.scroll({
        top: container.scrollTop + targetRect.top - (containerRect.top + containerRect.height / 2),
        behavior,
    });
};

/**
 * 将明确的 DOM 目标滚动到容器内；不读取编辑器状态、Selection 或全局配置。
 * `start` 的布局间距由调用域显式提供，避免纯 DOM 原语反向依赖 Layout。
 * @同步豁免: 需要绝对同步的DOM访问
 * 调用方会在同一渲染帧内继续执行选择和高亮，滚动必须作用于当前已测量的 DOM。
 */
export const scrollTargetIntoView = (
    container: HTMLElement,
    target: HTMLElement,
    options: TargetScrollOptions
) => {
    // 顶部对齐需要使用调用域提供的间距，不能退化为其它位置算法。
    if (options.position === "start") {
        scrollTargetToStart(container, target, options);
        return;
    }
    // 最近边缘模式只在目标完全离开可视区时滚动。
    if (options.position === "nearest") {
        scrollTargetToNearest(container, target, options.behavior);
        return;
    }
    scrollTargetToCenter(container, target, options.behavior);
};
