/** 内部异常项判定。 */
const isAbnormalHintElement = (currentHintElement: HTMLElement | undefined, className: string): boolean => {
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

/** 获取基础类名。 */
const getHintBaseClassName = (classActiveName: string): string => {
    const baseClassName = classActiveName.split("--")[0];
    return baseClassName;
};

/** 获取当前激活项。 */
const getCurrentHintElement = (listElement: Element, classActiveName: string): HTMLElement | undefined => {
    const isHtmlElement = listElement instanceof HTMLElement;
    if (!isHtmlElement) {
        return undefined;
    }
    return listElement.querySelector<HTMLElement>(`.${classActiveName}`) ?? undefined;
};

/** 激活默认项。 */
const activateDefaultHintElement = (defaultElement: Element | undefined, classActiveName: string): boolean => {
    const isHtmlElement = defaultElement instanceof HTMLElement;
    if (!isHtmlElement) {
        return false;
    }
    defaultElement.classList.add(classActiveName);
    defaultElement.scrollIntoView(true);
    return true;
};

/** 收集可见项。 */
const getVisibleHintElements = (listElement: HTMLElement, className: string): HTMLElement[] => {
    const hintElements: HTMLElement[] = [];
    for (const item of listElement.querySelectorAll<HTMLElement>(`.${className}`)) {
        const abnormalItem = isAbnormalHintElement(item, className);
        if (abnormalItem) {
            continue;
        }
        hintElements.push(item);
    }
    return hintElements;
};

/** 前一个元素高度。 */
const getPreviousElementHeight = (currentHintElement: HTMLElement): number => {
    const previousElement = currentHintElement.previousElementSibling;
    const isHtmlElement = previousElement instanceof HTMLElement;
    if (!isHtmlElement) {
        return 0;
    }
    return previousElement.clientHeight;
};

/** 保证目标可见。 */
const ensureHintVisible = (
    listElement: HTMLElement,
    currentHintElement: HTMLElement,
    topOffset: number,
    keepPreviousContext = false
): void => {
    const previousHeight = keepPreviousContext ? getPreviousElementHeight(currentHintElement) : 0;
    const topBoundary = currentHintElement.offsetTop - topOffset - previousHeight;
    const isAboveViewport = listElement.scrollTop > topBoundary;
    const bottomBoundary = currentHintElement.offsetTop - topOffset - listElement.clientHeight + currentHintElement.clientHeight;
    const isBelowViewport = listElement.scrollTop < bottomBoundary;
    const shouldScroll = isAboveViewport || isBelowViewport;
    if (!shouldScroll) {
        return;
    }
    currentHintElement.scrollIntoView(isAboveViewport);
};

/** 选中目标项。 */
const selectHintElement = (
    listElement: HTMLElement,
    currentHintElement: HTMLElement,
    classActiveName: string,
    topOffset: number,
    keepPreviousContext = false
): HTMLElement => {
    currentHintElement.classList.add(classActiveName);
    ensureHintVisible(listElement, currentHintElement, topOffset, keepPreviousContext);
    return currentHintElement;
};

/** 环形获取相对项。 */
const getWrappedHintElement = (
    hintElements: HTMLElement[],
    currentHintElement: HTMLElement,
    offset: number
): HTMLElement | undefined => {
    const currentIndex = hintElements.indexOf(currentHintElement);
    const hasCurrentIndex = currentIndex > -1;
    if (!hasCurrentIndex) {
        return undefined;
    }
    const lastIndex = hintElements.length - 1;
    let nextIndex = currentIndex + offset;
    const isBeforeFirst = nextIndex < 0;
    if (isBeforeFirst) {
        nextIndex = lastIndex;
    }
    const isAfterLast = nextIndex > lastIndex;
    if (isAfterLast) {
        nextIndex = 0;
    }
    return hintElements[nextIndex];
};

/** 获取下一个可见项。 */
const getNextVisibleHintElement = (
    hintElements: HTMLElement[],
    currentHintElement: HTMLElement
): HTMLElement | undefined => {
    const currentIndex = hintElements.indexOf(currentHintElement);
    const hasCurrentIndex = currentIndex > -1;
    if (!hasCurrentIndex) {
        return undefined;
    }
    const nextIndex = currentIndex + 1;
    const hasNextIndex = nextIndex < hintElements.length;
    if (!hasNextIndex) {
        return undefined;
    }
    return hintElements[nextIndex];
};

/** 按偏移移动。 */
const moveVisibleHintByOffset = (
    listElement: HTMLElement,
    currentHintElement: HTMLElement,
    classActiveName: string,
    className: string,
    offset: number,
    topOffset: number,
    keepPreviousContext = false
): HTMLElement | undefined => {
    currentHintElement.classList.remove(classActiveName);
    const hintElements = getVisibleHintElements(listElement, className);
    const nextHintElement = getWrappedHintElement(hintElements, currentHintElement, offset);
    const hasNextHintElement = !!nextHintElement;
    if (!hasNextHintElement) {
        return undefined;
    }
    return selectHintElement(listElement, nextHintElement, classActiveName, topOffset, keepPreviousContext);
};

/** 移到边界。 */
const moveVisibleHintToBoundary = (
    listElement: HTMLElement,
    currentHintElement: HTMLElement,
    classActiveName: string,
    className: string,
    movesToStart: boolean
): HTMLElement | undefined => {
    currentHintElement.classList.remove(classActiveName);
    const hintElements = getVisibleHintElements(listElement, className);
    const targetHintElement = movesToStart ? hintElements[0] : hintElements[hintElements.length - 1];
    const hasTargetHintElement = !!targetHintElement;
    if (!hasTargetHintElement) {
        return undefined;
    }
    targetHintElement.classList.add(classActiveName);
    targetHintElement.scrollIntoView(movesToStart);
    return targetHintElement;
};

/** 展开箭头。 */
const getOpenArrowElement = (currentHintElement: HTMLElement): HTMLElement | undefined => {
    const arrowElement = currentHintElement.querySelector<HTMLElement>(".b3-list-item__arrow--open");
    return arrowElement ?? undefined;
};

/** 任意箭头。 */
const getArrowElement = (currentHintElement: HTMLElement): HTMLElement | undefined => {
    const arrowElement = currentHintElement.querySelector<HTMLElement>(".b3-list-item__arrow");
    return arrowElement ?? undefined;
};

/** 子列表。 */
const getChildListElement = (currentHintElement: HTMLElement): HTMLElement | undefined => {
    const childListElement = currentHintElement.nextElementSibling;
    const isHtmlElement = childListElement instanceof HTMLElement;
    if (!isHtmlElement) {
        return undefined;
    }
    return childListElement;
};

/** 父项。 */
const getParentHintElement = (currentHintElement: HTMLElement): HTMLElement | undefined => {
    const parentListElement = currentHintElement.parentElement;
    const parentHintElement = parentListElement?.previousElementSibling;
    const isHtmlElement = parentHintElement instanceof HTMLElement;
    if (!isHtmlElement) {
        return undefined;
    }
    return parentHintElement;
};

/** 第一个子项。 */
const getFirstChildHintElement = (
    currentHintElement: HTMLElement,
    className: string
): HTMLElement | undefined => {
    const childListElement = getChildListElement(currentHintElement);
    const hasChildListElement = !!childListElement;
    if (!hasChildListElement) {
        return undefined;
    }
    const childHintElement = childListElement.querySelector<HTMLElement>(`.${className}`) ?? undefined;
    const abnormalItem = isAbnormalHintElement(childHintElement, className);
    if (abnormalItem) {
        return undefined;
    }
    return childHintElement;
};

/** 折叠分支。 */
const collapseHintBranch = (currentHintElement: HTMLElement): boolean => {
    const openArrowElement = getOpenArrowElement(currentHintElement);
    const hasOpenArrowElement = !!openArrowElement;
    if (!hasOpenArrowElement) {
        return false;
    }
    openArrowElement.classList.remove("b3-list-item__arrow--open");
    const childListElement = getChildListElement(currentHintElement);
    const hasChildListElement = !!childListElement;
    if (hasChildListElement) {
        childListElement.classList.add("fn__none");
    }
    return true;
};

/** 展开分支。 */
const expandHintBranch = (currentHintElement: HTMLElement): boolean => {
    const arrowElement = getArrowElement(currentHintElement);
    const hasArrowElement = !!arrowElement;
    if (!hasArrowElement) {
        return false;
    }
    const isAlreadyOpen = arrowElement.classList.contains("b3-list-item__arrow--open");
    if (isAlreadyOpen) {
        return false;
    }
    arrowElement.classList.add("b3-list-item__arrow--open");
    const childListElement = getChildListElement(currentHintElement);
    const hasChildListElement = !!childListElement;
    if (hasChildListElement) {
        childListElement.classList.remove("fn__none");
    }
    return true;
};

/** 左移目标。 */
const resolveLeftHintElement = (
    listElement: HTMLElement,
    currentHintElement: HTMLElement,
    className: string
): HTMLElement => {
    const collapsedCurrentBranch = collapseHintBranch(currentHintElement);
    if (collapsedCurrentBranch) {
        return currentHintElement;
    }
    const parentHintElement = getParentHintElement(currentHintElement);
    const hasParentHintElement = !!parentHintElement;
    if (hasParentHintElement) {
        return parentHintElement;
    }
    const hintElements = getVisibleHintElements(listElement, className);
    return hintElements[0] || currentHintElement;
};

/** 右移目标。 */
const resolveRightHintElement = (
    listElement: HTMLElement,
    currentHintElement: HTMLElement,
    className: string
): HTMLElement => {
    const openArrowElement = getOpenArrowElement(currentHintElement);
    const firstChildHintElement = openArrowElement ? getFirstChildHintElement(currentHintElement, className) : undefined;
    const hasFirstChildHintElement = !!firstChildHintElement;
    if (hasFirstChildHintElement) {
        return firstChildHintElement;
    }
    const expandedCurrentBranch = expandHintBranch(currentHintElement);
    if (expandedCurrentBranch) {
        return currentHintElement;
    }
    const hintElements = getVisibleHintElements(listElement, className);
    const nextHintElement = getNextVisibleHintElement(hintElements, currentHintElement);
    const hasNextHintElement = !!nextHintElement;
    if (!hasNextHintElement) {
        return currentHintElement;
    }
    return nextHintElement;
};

const hintNavigationHelpers = {
    activateDefaultHintElement,
    getCurrentHintElement,
    getHintBaseClassName,
    moveVisibleHintByOffset,
    moveVisibleHintToBoundary,
    resolveLeftHintElement,
    resolveRightHintElement,
    selectHintElement,
};

/**
 * 提示列表导航辅助函数集合。
 * 使用范围：`upDownHint.ts` 对外公开 API 复用这些内部能力。
 * 解耦评估：这些 helper 只服务 DOM 提示导航，实现细节集中在单文件中更利于维护。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export default hintNavigationHelpers;
