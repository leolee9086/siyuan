/**
 * 根据标志位切换元素的 fn__none 类
 * @param element - 要操作的DOM元素
 * @param flag - 布尔值标志，true表示添加fn__none类（隐藏元素），false表示移除fn__none类（显示元素）
 */
export const switchFnNoneByFlag = (element: Element, flag: boolean): void => {
    if (flag) {
        element.classList.add("fn__none");
    } else {
        element.classList.remove("fn__none");
    }
};