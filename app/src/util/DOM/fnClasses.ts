/**
 * 根据标志位切换元素的 fn__none 类
 * @param element - 要操作的DOM元素
 * @param flag - 布尔值标志，true表示添加fn__none类（隐藏元素），false表示移除fn__none类（显示元素）
 */
export const switchFnNoneByFlag = (element: Element, flag: boolean): void => {
    if (flag) {
        element.classList.add("fn__none");
        return;
    }
    element.classList.remove("fn__none");
};

/**
 * 检查元素的 classList 是否包含指定的 className
 * @param element - 要检查的 DOM 元素
 * @param className - 要检查的 className
 * @returns - 如果 classList 包含 className，返回 true；否则返回 false
 */
export const checkClassListContain = (element: Element, className: string): boolean => {
    return !!element.classList.contains(className);
};

/**
 * 检查元素的 classList 是否包含指定的 className
 * @param element - 要检查的 DOM 元素
 * @param classNames - 要检查的 className 数组
 * @returns - 如果 classList 包含所有 className，返回 true；否则返回 false
 */
export const checkClassListContainAll = (element: Element, classNames: string[]): boolean => {
    return !!classNames.every((className) => element.classList.contains(className));
};
/**
 * 检查元素的 classList 是否包含指定的 className
 * @param element - 要检查的 DOM 元素
 * @param classNames - 要检查的 className 数组
 * @returns - 如果 classList 包含任意一个 className，返回 true；否则返回 false
 */
export const checkClassListContainAny = (element: Element, classNames: string[]): boolean => {
    return !!classNames.some((className) => element.classList.contains(className));
};
