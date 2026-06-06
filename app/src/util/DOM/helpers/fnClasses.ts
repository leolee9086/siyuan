/**
 * 根据布尔标志切换 `fn__none`，让调用方只关注“是否隐藏”而不用重复写类名。
 * 调用时机：AI 菜单等基于筛选结果显示或隐藏元素时调用。
 * 问题/改进：如果后续有更多统一状态类切换需求，可抽象成更通用的类名开关工具。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const switchFnNoneByFlag = (element: Element, flag: boolean) => {
    if (flag) {
        element.classList.add("fn__none");
        return;
    }
    element.classList.remove("fn__none");
};

/**
 * 判断元素是否包含指定类名，供面板渲染逻辑做轻量判定。
 * 调用时机：块面板根据目标元素类型分支渲染时调用。
 * 问题/改进：当前是单类名检查，若后续需要更复杂组合判断应交给更明确的工具处理。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const checkClassListContain = (element: Element, className: string) => {
    const hasClassName = element.classList.contains(className);
    return hasClassName;
};

/**
 * 判断元素是否同时包含一组类名，避免调用方重复书写循环。
 * 调用时机：需要验证多个状态类同时存在时调用。
 * 问题/改进：当前按数组顺序逐个检查，类名集合很大时可再考虑 Set 优化。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const checkClassListContainAll = (element: Element, classNames: string[]) => {
    for (const className of classNames) {
        const hasClassName = element.classList.contains(className);
        if (!hasClassName) {
            return false;
        }
    }
    return true;
};

/**
 * 判断元素是否包含任意一个类名，供调用方快速命中多种可接受状态。
 * 调用时机：需要在多个候选类名中检测命中时调用。
 * 问题/改进：当前返回布尔值即可满足需求，如未来需要返回命中的类名可另建工具。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const checkClassListContainAny = (element: Element, classNames: string[]) => {
    for (const className of classNames) {
        const hasClassName = element.classList.contains(className);
        if (hasClassName) {
            return true;
        }
    }
    return false;
};
