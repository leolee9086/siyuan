/** 用途：复用提示列表导航 helper 集合；使用范围：`upDownHint` 与 `UDLRHint` 主流程；解耦评估：内部导航细节已下沉到 helper，主文件只保留公开 API 更利于维护。 */
import hintNavigationHelpers from "./helpers/hintNavigation";

const TREE_SCROLL_OFFSET = 46;

/** 统一消费方向键事件。 */
const consumeHintEvent = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
};

/** 统一处理树形列表左右方向的最终选中逻辑。 */
const moveTreeResolvedHintElement = (
    listElement: HTMLElement,
    currentHintElement: HTMLElement,
    targetElement: HTMLElement,
    classActiveName: string,
    keepPreviousContext = false
) => {
    currentHintElement.classList.remove(classActiveName);
    return hintNavigationHelpers.selectHintElement(listElement, targetElement, classActiveName, TREE_SCROLL_OFFSET, keepPreviousContext);
};

/** 初始化当前激活项，必要时回退到默认项。 */
const resolveInitialHintElement = (
    listElement: Element,
    classActiveName: string,
    defaultElement?: Element
) => {
    const currentHintElement = hintNavigationHelpers.getCurrentHintElement(listElement, classActiveName);
    const hasCurrentHintElement = !!currentHintElement;
    if (hasCurrentHintElement) {
        return currentHintElement;
    }
    hintNavigationHelpers.activateDefaultHintElement(defaultElement, classActiveName);
    return undefined;
};

/**
 * 判断候选提示项是否不可用，统一过滤空节点、隐藏节点和高度为 0 的节点。
 * 调用时机：提示列表导航和 `protyle/hint` 相关逻辑在筛选候选项时调用。
 * 问题/改进：当前仍以 `height === 0` 作为可见性近似判断，若后续有更明确标记可继续收敛。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const isAbnormalItem = (currentHintElement: HTMLElement | undefined, className: string) => {
    const hasElement = !!currentHintElement;
    if (!hasElement) {
        return true;
    }
    const hasExpectedClass = currentHintElement.classList.contains(className);
    if (!hasExpectedClass) {
        return true;
    }
    const itemHeight = currentHintElement.getBoundingClientRect().height;
    return itemHeight === 0;
};

/**
 * 在线性提示列表中处理上下与 Home/End 导航，并保证头尾循环。
 * 调用时机：搜索提示、菜单列表等线性列表按键导航时调用。
 * 问题/改进：当前主函数只负责分发，复杂导航细节已下沉到 helper。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const upDownHint = (
    listElement: Element,
    event: KeyboardEvent,
    classActiveName = "b3-list-item--focus",
    defaultElement?: Element
) => {
    const currentHintElement = resolveInitialHintElement(listElement, classActiveName, defaultElement);
    const hasCurrentHintElement = !!currentHintElement;
    if (!hasCurrentHintElement) {
        return undefined;
    }
    const isHtmlElement = listElement instanceof HTMLElement;
    if (!isHtmlElement) {
        return undefined;
    }
    const className = hintNavigationHelpers.getHintBaseClassName(classActiveName);
    const isArrowDownKey = event.key === "ArrowDown";
    if (isArrowDownKey) {
        consumeHintEvent(event);
        return hintNavigationHelpers.moveVisibleHintByOffset(listElement, currentHintElement, classActiveName, className, 1, 0);
    }
    const isArrowUpKey = event.key === "ArrowUp";
    if (isArrowUpKey) {
        consumeHintEvent(event);
        return hintNavigationHelpers.moveVisibleHintByOffset(listElement, currentHintElement, classActiveName, className, -1, 0, true);
    }
    const isHomeKey = event.key === "Home";
    if (isHomeKey) {
        consumeHintEvent(event);
        return hintNavigationHelpers.moveVisibleHintToBoundary(listElement, currentHintElement, classActiveName, className, true);
    }
    const isEndKey = event.key === "End";
    if (!isEndKey) {
        return undefined;
    }
    consumeHintEvent(event);
    return hintNavigationHelpers.moveVisibleHintToBoundary(listElement, currentHintElement, classActiveName, className, false);
};

/**
 * 在树形提示列表中处理上下左右和 Home/End 导航，兼顾展开、折叠与父子层级切换。
 * 调用时机：关系面板等树形菜单使用方向键导航时调用。
 * 问题/改进：当前主函数只负责公开 API 编排，父子层级推导逻辑已下沉到 helper。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const UDLRHint = (
    listElement: Element,
    event: KeyboardEvent,
    classActiveName = "b3-list-item--focus",
    defaultElement?: Element
) => {
    const currentHintElement = resolveInitialHintElement(listElement, classActiveName, defaultElement);
    const hasCurrentHintElement = !!currentHintElement;
    if (!hasCurrentHintElement) {
        return undefined;
    }
    const isHtmlElement = listElement instanceof HTMLElement;
    if (!isHtmlElement) {
        return undefined;
    }
    const className = hintNavigationHelpers.getHintBaseClassName(classActiveName);
    const isArrowLeftKey = event.key === "ArrowLeft";
    if (isArrowLeftKey) {
        consumeHintEvent(event);
        const targetElement = hintNavigationHelpers.resolveLeftHintElement(listElement, currentHintElement, className);
        return moveTreeResolvedHintElement(listElement, currentHintElement, targetElement, classActiveName, true);
    }
    const isArrowRightKey = event.key === "ArrowRight";
    if (isArrowRightKey) {
        consumeHintEvent(event);
        const targetElement = hintNavigationHelpers.resolveRightHintElement(listElement, currentHintElement, className);
        return moveTreeResolvedHintElement(listElement, currentHintElement, targetElement, classActiveName);
    }
    const isArrowDownKey = event.key === "ArrowDown";
    if (isArrowDownKey) {
        consumeHintEvent(event);
        return hintNavigationHelpers.moveVisibleHintByOffset(listElement, currentHintElement, classActiveName, className, 1, TREE_SCROLL_OFFSET);
    }
    const isArrowUpKey = event.key === "ArrowUp";
    if (isArrowUpKey) {
        consumeHintEvent(event);
        return hintNavigationHelpers.moveVisibleHintByOffset(listElement, currentHintElement, classActiveName, className, -1, TREE_SCROLL_OFFSET, true);
    }
    const isHomeKey = event.key === "Home";
    if (isHomeKey) {
        consumeHintEvent(event);
        return hintNavigationHelpers.moveVisibleHintToBoundary(listElement, currentHintElement, classActiveName, className, true);
    }
    const isEndKey = event.key === "End";
    if (!isEndKey) {
        return undefined;
    }
    consumeHintEvent(event);
    return hintNavigationHelpers.moveVisibleHintToBoundary(listElement, currentHintElement, classActiveName, className, false);
};
