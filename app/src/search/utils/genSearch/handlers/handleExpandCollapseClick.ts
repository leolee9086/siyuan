/**
 * @fileoverview 展开/折叠相关点击处理
 */

/**
 * 处理展开所有点击
 */
export function handleSearchExpand(searchPanelElement: Element): void {
    for (const item of Array.from(searchPanelElement.children)) {
        if (item.classList.contains("b3-list-item")) {
            const arrowElement = item.querySelector(".b3-list-item__arrow");
            arrowElement?.classList.add("b3-list-item__arrow--open");
            const nextElement = item.nextElementSibling;
            nextElement?.classList.remove("fn__none");
        }
    }
}

/**
 * 处理折叠所有点击
 */
export function handleSearchCollapse(searchPanelElement: Element): void {
    for (const item of Array.from(searchPanelElement.children)) {
        if (item.classList.contains("b3-list-item")) {
            const arrowElement = item.querySelector(".b3-list-item__arrow");
            arrowElement?.classList.remove("b3-list-item__arrow--open");
            const nextElement = item.nextElementSibling;
            nextElement?.classList.add("fn__none");
        }
    }
}
