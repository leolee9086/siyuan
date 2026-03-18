import { switchFnNoneByFlag } from "./imports";
import { selectAllThenEach } from "./utils/utils.selectors";
import { CSS_CLASSES, createSelector } from "./constants";

/**
 * 过滤AI菜单项，根据输入值显示/隐藏列表项和分隔符，并管理焦点
 * @param element 包含菜单项的容器元素
 * @param inputElement 用于过滤的输入框元素
 */
export const filterAIMenuItems = (element: HTMLElement, inputElement: HTMLInputElement) => {
    const filterValue = inputElement.value;
    // 1. 过滤列表项：根据输入值显示或隐藏
    selectAllThenEach(element, {
        selector: createSelector(CSS_CLASSES.LIST_ITEM),
        eachFn: (item) => {
            // 根据过滤结果设置显示状态
            const hasText = item.textContent?.indexOf(filterValue) > -1;
            switchFnNoneByFlag(item, !hasText);
        }
    });
    // 2. 处理分隔符：有输入值时隐藏所有分隔符
    selectAllThenEach(element, {
        selector: createSelector(CSS_CLASSES.MENU_SEPARATOR),
        eachFn: (item) => {
            // 当有输入值时隐藏分隔符
            switchFnNoneByFlag(item, !!filterValue);
        }
    });
    // 3. 管理焦点：移除当前焦点并设置到第一个可见项
    const focusedItem = element.querySelector(createSelector(CSS_CLASSES.LIST_ITEM_FOCUS));
    focusedItem?.classList.remove(CSS_CLASSES.LIST_ITEM_FOCUS);
    
    const firstVisibleItem = element.querySelector(`${createSelector(CSS_CLASSES.LIST_ITEM)}:not(.${CSS_CLASSES.HIDDEN_CLASS})`);
    firstVisibleItem?.classList.add(CSS_CLASSES.LIST_ITEM_FOCUS);
};
