import { Constants } from "../../constants";
import { matchHotKey } from "../../protyle/util/hotKey";
import { Dialog } from "../../dialog";
import { getLeaf } from "../pathName";
import { getSiyuanGlobalMenus } from "../siyuanEnvironments/getMenu.environment";

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
        if (处理通用快捷键(event, toggleMovePathHistory)) {
            return;
        }
        const currentPanelElement = searchListElement.classList.contains("fn__none") ? searchTreeElement : searchListElement;
        const currentItemElements = currentPanelElement.querySelectorAll(".b3-list-item--focus");
        if (currentItemElements.length === 0) {
            return;
        }
        const currentItemElement: HTMLElement = currentItemElements[0] as HTMLElement;
        if (event.key.startsWith("Arrow")) {
            for (let index = 1; index < currentItemElements.length; index++) {
                const item = currentItemElements[index];
                item?.classList.remove("b3-list-item--focus");
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
        处理左方向键导航(currentItemElement, currentPanelElement);
        event.preventDefault();
        return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        尝试切换树节点焦点(currentItemElement, searchTreeElement, 查找下一个元素);
        event.preventDefault();
        return;
    }

    if (event.key === "ArrowUp") {
        尝试切换树节点焦点(currentItemElement, searchTreeElement, 查找上一个元素);
        event.preventDefault();
    }
}

function 尝试切换树节点焦点(
    currentItemElement: HTMLElement,
    searchTreeElement: HTMLElement,
    finder: (element: HTMLElement) => HTMLElement | null
) {
    const targetElement = finder(currentItemElement);
    if (targetElement?.classList.contains("b3-list-item")) {
        currentItemElement.classList.remove("b3-list-item--focus");
        targetElement.classList.add("b3-list-item--focus");
        滚动到可见区域(targetElement, searchTreeElement);
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
        切换列表焦点(panel, currentItemElement, lineHeight, "down");
        event.preventDefault();
        return;
    }

    if (event.key === "ArrowUp") {
        切换列表焦点(panel, currentItemElement, lineHeight, "up");
        event.preventDefault();
    }
}

function 切换列表焦点(
    panel: HTMLElement,
    currentItemElement: HTMLElement,
    lineHeight: number,
    direction: "up" | "down"
) {
    currentItemElement.classList.remove("b3-list-item--focus");
    const targetElement = direction === "down"
        ? (currentItemElement.nextElementSibling ?? panel.children[0])
        : (currentItemElement.previousElementSibling ?? panel.children[panel.children.length - 1]);

    if (targetElement) {
        targetElement.classList.add("b3-list-item--focus");
        调整滚动位置(panel, targetElement as HTMLElement, lineHeight, direction);
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
        if (sibling && sibling.classList.contains("fn__none")) {
            nextElement = sibling as HTMLElement;
            continue;
        }
        if (sibling && sibling.tagName === "UL") {
            return sibling.firstElementChild as HTMLElement;
        }
        if (sibling) {
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
        if (sibling && sibling.classList.contains("fn__none")) {
            previousElement = sibling as HTMLElement;
            continue;
        }
        if (sibling?.tagName === "LI") {
            return sibling as HTMLElement;
        }
        if (sibling) {
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
 * 处理左方向键导航（跳转到父元素）
 */
function 处理左方向键导航(currentItemElement: HTMLElement, currentPanelElement: Element) {
    const parentElement = currentItemElement.parentElement?.previousElementSibling as HTMLElement | null;
    if (!parentElement) {
        return;
    }
    const targetElement = parentElement.tagName !== "LI"
        ? currentPanelElement.querySelector(".b3-list-item") as HTMLElement
        : parentElement;
    if (targetElement) {
        currentItemElement.classList.remove("b3-list-item--focus");
        targetElement.classList.add("b3-list-item--focus");
        滚动到可见区域(targetElement, currentPanelElement as HTMLElement);
    }
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
    const 需要调整向下滚动 = direction === "down" && (
        panel.scrollTop < item.offsetTop - panel.clientHeight + lineHeight ||
        panel.scrollTop > item.offsetTop
    );
    if (需要调整向下滚动) {
        panel.scrollTop = item.offsetTop - panel.clientHeight + lineHeight;
        return;
    }
    if (direction === "down") {
        return;
    }
    // direction === "up"
    const 需要调整向上滚动 = panel.scrollTop < item.offsetTop - panel.clientHeight + lineHeight ||
        panel.scrollTop > item.offsetTop - lineHeight * 2;
    if (需要调整向上滚动) {
        panel.scrollTop = item.offsetTop - lineHeight * 2;
    }
}

function 处理通用快捷键(event: KeyboardEvent, toggleMovePathHistory: () => void) {
    if (event.isComposing) {
        return true;
    }
    if (matchHotKey("⌥↓", event)) {
        event.stopPropagation();
        toggleMovePathHistory();
        return true;
    }
    if (getSiyuanGlobalMenus()?.menu.element.getAttribute("data-name") === Constants.MENU_MOVE_PATH_HISTORY) {
        return true;
    }
    return false;
}
