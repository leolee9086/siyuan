import { Constants } from "../../constants";
import { matchHotKey } from "../../protyle/util/hotKey";
import { Dialog } from "../../dialog";
import { getLeaf } from "../pathName";

/**
 * 创建键盘事件处理器
 */
export function 创建键盘事件处理器(context: {
    inputElement: HTMLInputElement;
    searchListElement: HTMLElement;
    searchTreeElement: HTMLElement;
    toggleMovePathHistory: () => void;
    options: { flashcard: boolean; cb: (toPath: string[], toNotebook: string[]) => void };
    dialog: Dialog;
    lineHeight: number;
}) {
    const {
        inputElement,
        searchListElement,
        searchTreeElement,
        toggleMovePathHistory,
        options,
        dialog,
        lineHeight
    } = context;

    return (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        if (matchHotKey("⌥↓", event)) {
            event.stopPropagation();
            toggleMovePathHistory();
            return;
        }
        if (window.siyuan.menus?.menu.element.getAttribute("data-name") === Constants.MENU_MOVE_PATH_HISTORY) {
            return;
        }
        const currentPanelElement = searchListElement.classList.contains("fn__none") ? searchTreeElement : searchListElement;
        const currentItemElements = currentPanelElement.querySelectorAll(".b3-list-item--focus");
        if (currentItemElements.length === 0) {
            return;
        }
        let currentItemElement: HTMLElement = currentItemElements[0] as HTMLElement;
        if (event.key.startsWith("Arrow")) {
            for (let index = 1; index < currentItemElements.length; index++) {
                currentItemElements[index].classList.remove("b3-list-item--focus");
            }
        }
        if (searchListElement.classList.contains("fn__none")) {
            处理树视图方向键(event, currentItemElement, currentPanelElement, searchTreeElement, options);
            return;
        }
        处理列表视图方向键(event, currentItemElement, currentPanelElement, lineHeight);

        if (event.key === "Enter") {
            处理确认键(event, currentPanelElement, options, dialog);
        }
    };
}

/**
 * 处理树视图的方向键导航
 */
function 处理树视图方向键(
    event: KeyboardEvent,
    currentItemElement: HTMLElement,
    currentPanelElement: Element,
    searchTreeElement: HTMLElement,
    options: { flashcard: boolean }
) {
    const toggleElement = currentItemElement.querySelector(".b3-list-item__toggle");
    const arrowOpenElement = currentItemElement.querySelector(".b3-list-item__arrow--open");
    const shouldExpand = event.key === "ArrowRight" && !arrowOpenElement && toggleElement && !toggleElement.classList.contains("fn__hidden");
    const shouldCollapse = event.key === "ArrowLeft" && arrowOpenElement;

    if (shouldExpand || shouldCollapse) {
        getLeaf(currentItemElement, options.flashcard);
        event.preventDefault();
        return;
    }

    if (event.key === "ArrowLeft") {
        const parentElement = currentItemElement.parentElement?.previousElementSibling as HTMLElement | null;
        if (parentElement) {
            const targetElement = parentElement.tagName !== "LI"
                ? currentPanelElement.querySelector(".b3-list-item") as HTMLElement
                : parentElement;
            if (targetElement) {
                currentItemElement.classList.remove("b3-list-item--focus");
                targetElement.classList.add("b3-list-item--focus");
                滚动到可见区域(targetElement, currentPanelElement as HTMLElement);
            }
        }
        event.preventDefault();
        return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        const nextElement = 查找下一个元素(currentItemElement);
        if (nextElement?.classList.contains("b3-list-item")) {
            currentItemElement.classList.remove("b3-list-item--focus");
            nextElement.classList.add("b3-list-item--focus");
            滚动到可见区域(nextElement, searchTreeElement);
        }
        event.preventDefault();
        return;
    }

    if (event.key === "ArrowUp") {
        const previousElement = 查找上一个元素(currentItemElement);
        if (previousElement?.classList.contains("b3-list-item")) {
            currentItemElement.classList.remove("b3-list-item--focus");
            previousElement.classList.add("b3-list-item--focus");
            滚动到可见区域(previousElement, searchTreeElement);
        }
        event.preventDefault();
    }
}

/**
 * 处理列表视图的方向键导航
 */
function 处理列表视图方向键(
    event: KeyboardEvent,
    currentItemElement: HTMLElement,
    currentPanelElement: Element,
    lineHeight: number
) {
    const panel = currentPanelElement as HTMLElement;

    if (event.key === "ArrowDown") {
        currentItemElement.classList.remove("b3-list-item--focus");
        const nextSibling = currentItemElement.nextElementSibling;
        if (!nextSibling) {
            panel.children[0].classList.add("b3-list-item--focus");
        } else {
            nextSibling.classList.add("b3-list-item--focus");
        }
        const focusedItem = panel.querySelector(".b3-list-item--focus") as HTMLElement;
        if (focusedItem) {
            调整滚动位置(panel, focusedItem, lineHeight, "down");
        }
        event.preventDefault();
        return;
    }

    if (event.key === "ArrowUp") {
        currentItemElement.classList.remove("b3-list-item--focus");
        const prevSibling = currentItemElement.previousElementSibling;
        if (!prevSibling) {
            const lastChild = panel.children[panel.children.length - 1];
            lastChild.classList.add("b3-list-item--focus");
        } else {
            prevSibling.classList.add("b3-list-item--focus");
        }
        const focusedItem = panel.querySelector(".b3-list-item--focus") as HTMLElement;
        if (focusedItem) {
            调整滚动位置(panel, focusedItem, lineHeight, "up");
        }
        event.preventDefault();
    }
}

/**
 * 处理确认键事件
 */
function 处理确认键(
    event: KeyboardEvent,
    currentPanelElement: Element,
    options: { cb: (toPath: string[], toNotebook: string[]) => void },
    dialog: Dialog
) {
    const currentItemElements = currentPanelElement.querySelectorAll(".b3-list-item--focus");
    if (currentItemElements.length === 0) {
        return;
    }
    const pathList: string[] = [];
    const notebookIdList: string[] = [];
    for (const item of currentItemElements) {
        const path = item.getAttribute("data-path");
        const box = item.getAttribute("data-box");
        if (path) pathList.push(path);
        if (box) notebookIdList.push(box);
    }
    options.cb(pathList, notebookIdList);
    dialog.destroy();
    event.preventDefault();
}

/**
 * 查找下一个可见元素
 */
function 查找下一个元素(currentElement: HTMLElement): HTMLElement | null {
    let nextElement = currentElement;
    while (nextElement) {
        const sibling = nextElement.nextElementSibling;
        if (sibling) {
            if (sibling.classList.contains("fn__none")) {
                nextElement = sibling as HTMLElement;
                continue;
            }
            if (sibling.tagName === "UL") {
                return sibling.firstElementChild as HTMLElement;
            }
            return sibling as HTMLElement;
        }
        if (nextElement.parentElement?.id === "foldTree") {
            break;
        }
        nextElement = nextElement.parentElement as HTMLElement;
    }
    return nextElement;
}

/**
 * 查找上一个可见元素
 */
function 查找上一个元素(currentElement: HTMLElement): HTMLElement | null {
    let previousElement = currentElement;
    while (previousElement) {
        const sibling = previousElement.previousElementSibling;
        if (sibling) {
            if (sibling.classList.contains("fn__none")) {
                previousElement = sibling as HTMLElement;
                continue;
            }
            if (sibling.tagName === "LI") {
                return sibling as HTMLElement;
            }
            const liElements = sibling.querySelectorAll(".b3-list-item");
            return liElements[liElements.length - 1] as HTMLElement;
        }
        if (previousElement.parentElement?.id === "foldTree") {
            break;
        }
        previousElement = previousElement.parentElement as HTMLElement;
    }
    return previousElement;
}

/**
 * 将元素滚动到可见区域
 */
function 滚动到可见区域(element: HTMLElement, container: HTMLElement) {
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
        element.scrollIntoView(elementRect.top < containerRect.top);
    }
}

/**
 * 调整列表视图的滚动位置
 */
function 调整滚动位置(
    panel: HTMLElement,
    item: HTMLElement,
    lineHeight: number,
    direction: "up" | "down"
) {
    if (direction === "down") {
        if (panel.scrollTop < item.offsetTop - panel.clientHeight + lineHeight ||
            panel.scrollTop > item.offsetTop) {
            panel.scrollTop = item.offsetTop - panel.clientHeight + lineHeight;
        }
    } else {
        if (panel.scrollTop < item.offsetTop - panel.clientHeight + lineHeight ||
            panel.scrollTop > item.offsetTop - lineHeight * 2) {
            panel.scrollTop = item.offsetTop - lineHeight * 2;
        }
    }
}
