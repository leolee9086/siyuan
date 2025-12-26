/**
 * @fileoverview 展开/折叠相关点击处理
 */

/**
 * 处理展开所有点击
 */
export function handleSearchExpand(searchPanelElement: Element): void {
    Array.from(searchPanelElement.children).forEach(item => {
        if (item.classList.contains("b3-list-item")) {
            item.querySelector(".b3-list-item__arrow")?.classList.add("b3-list-item__arrow--open");
            item.nextElementSibling?.classList.remove("fn__none");
        }
    });
}

/**
 * 处理折叠所有点击
 */
export function handleSearchCollapse(searchPanelElement: Element): void {
    Array.from(searchPanelElement.children).forEach(item => {
        if (item.classList.contains("b3-list-item")) {
            item.querySelector(".b3-list-item__arrow")?.classList.remove("b3-list-item__arrow--open");
            item.nextElementSibling?.classList.add("fn__none");
        }
    });
}
