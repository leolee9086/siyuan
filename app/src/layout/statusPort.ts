/**
 * 状态栏宿主能力的最小参数。
 * 允许主应用传入 DOM id，微前端宿主也可以直接传入已创建的元素。
 */
export type StatusElementTarget = HTMLElement | string;

/** 将状态栏能力参数解析为元素；未提供或找不到元素表示宿主关闭了统计能力。 */
export const resolveStatusElement = (target?: StatusElementTarget) => {
    if (!target) {
        return undefined;
    }
    if (target instanceof HTMLElement) {
        return target;
    }
    return document.getElementById(target) || undefined;
};
