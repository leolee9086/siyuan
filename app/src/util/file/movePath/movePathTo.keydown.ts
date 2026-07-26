import {Constants} from "./imports";
import {matchHotKey} from "./imports";
import {Dialog} from "./imports";
import {getLeaf} from "./imports";
import {getSiyuanGlobalMenus} from "./imports";

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
    const { inputElement, searchListElement, searchTreeElement, toggleMovePathHistory, options, dialog, lineHeight } = context;

    return (event: KeyboardEvent) => {
        // 如果这一通用快捷键被处理（如切换历史），则不再继续执行后续逻辑
        if (处理通用快捷键(event, toggleMovePathHistory)) {
            return;
        }
        const currentPanelElement = searchListElement.classList.contains("fn__none") ? searchTreeElement : searchListElement;
        const currentItemElements = currentPanelElement.querySelectorAll(".b3-list-item--focus");
        // 如果当前没有任何项处于聚焦状态，则不处理后续键盘事件
        if (currentItemElements.length === 0) {
            return;
        }
        const currentItemElement = currentItemElements[0];
        // 确保获取到的第一个元素是合法的 HTMLElement
        if (!(currentItemElement instanceof HTMLElement)) {
            return;
        }
        // 当按下方向键进行导航时，如果有多个元素处于聚焦状态，
        // 强制移除除第一个元素以外的所有元素的焦点，确保导航基于唯一的焦点元素开始。
        if (event.key.startsWith("Arrow")) {
            for (let index = 1; index < currentItemElements.length; index++) {
                const item = currentItemElements[index];
                item?.classList.remove("b3-list-item--focus");
            }
        }
        // 如果列表视图被隐藏（即处于树视图模式），使用树视图的导航逻辑
        if (searchListElement.classList.contains("fn__none")) {
            处理树视图方向键(event, currentItemElement, currentPanelElement, searchTreeElement, options);
            return;
        }
        处理列表视图方向键(event, currentItemElement, currentPanelElement, lineHeight);

        // 当按下回车键时，确认当前的选中项并执行回调操作
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
    currentPanelElement: HTMLElement,
    searchTreeElement: HTMLElement,
    options: { flashcard: boolean }
) {
    const toggleElement = currentItemElement.querySelector(".b3-list-item__toggle");
    const arrowOpenElement = currentItemElement.querySelector(".b3-list-item__arrow--open");
    const shouldExpand = event.key === "ArrowRight" && !arrowOpenElement && toggleElement && !toggleElement.classList.contains("fn__hidden");
    const shouldCollapse = event.key === "ArrowLeft" && arrowOpenElement;

    // 如果满足展开或折叠节点的条件（右键展开，左键折叠），则执行相应操作
    if (shouldExpand || shouldCollapse) {
        getLeaf(currentItemElement, options.flashcard);
        event.preventDefault();
        return;
    }

    // 如果按下左方向键且不满足折叠条件，尝试导航到父级节点
    if (event.key === "ArrowLeft") {
        处理左方向键导航(currentItemElement, currentPanelElement);
        event.preventDefault();
        return;
    }

    // 如果按下下方向键或右方向键（且未触发展开），尝试导航到下一个可见节点
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        尝试切换树节点焦点(currentItemElement, searchTreeElement, 查找下一个元素);
        event.preventDefault();
        return;
    }

    // 如果按下上方向键，尝试导航到上一个可见节点
    if (event.key === "ArrowUp") {
        尝试切换树节点焦点(currentItemElement, searchTreeElement, 查找上一个元素);
        event.preventDefault();
    }
}

/**
 * 尝试切换树节点焦点
 *
 * 作用：在树形视图中尝试切换焦点到目标节点
 * 意图：封装节点查找和焦点切换逻辑
 * 调用时机：树视图方向键导航时
 */
function 尝试切换树节点焦点(
    currentItemElement: HTMLElement,
    searchTreeElement: HTMLElement,
    finder: (element: HTMLElement) => HTMLElement | null
) {
    const targetElement = finder(currentItemElement);
    // 如果找到了目标元素且目标元素是有效的列表项，则切换焦点并滚动到可见区域
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
    panel: HTMLElement,
    lineHeight: number
) {
    // 如果按下下方向键，切换列表焦点到下一项
    if (event.key === "ArrowDown") {
        切换列表焦点(panel, currentItemElement, lineHeight, "down");
        event.preventDefault();
        return;
    }

    // 如果按下上方向键，切换列表焦点到上一项
    if (event.key === "ArrowUp") {
        切换列表焦点(panel, currentItemElement, lineHeight, "up");
        event.preventDefault();
    }
}

/**
 * 切换列表焦点
 *
 * 作用：在列表视图中切换焦点到上一个或下一个项目
 * 意图：处理单纯的列表垂直导航
 * 调用时机：列表视图方向键导航时
 * 问题/改进：
 * - 边界情况处理依赖于 DOM 结构 (panel.children)
 */
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

    // 确保目标元素是有效的 HTMLElement，避免类型错误
    if (targetElement instanceof HTMLElement) {
        targetElement.classList.add("b3-list-item--focus");
        调整滚动位置(panel, targetElement, lineHeight, direction);
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
    // 如果当前没有选中的项，则无法执行确认操作
    if (currentItemElements.length === 0) {
        return;
    }
    const pathList: string[] = [];
    const notebookIdList: string[] = [];
    for (const item of currentItemElements) {
        const path = item.getAttribute("data-path");
        const box = item.getAttribute("data-box");
        // 收集有效的路径
        if (path) {
            pathList.push(path);
        }
        // 收集有效的笔记本 ID
        if (box) {
            notebookIdList.push(box);
        }
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
        // 如果遇到隐藏元素，则跳过并继续查找下一个兄弟节点
        if (sibling && sibling.classList.contains("fn__none") && sibling instanceof HTMLElement) {
            nextElement = sibling;
            continue;
        }
        // 如果是展开的列表（UL），尝试进入子列表的第一个元素
        if (sibling && sibling.tagName === "UL") {
            const firstChild = sibling.firstElementChild;
            return firstChild instanceof HTMLElement ? firstChild : null;
        }
        // 如果是普通的可见兄弟节点，直接返回
        if (sibling instanceof HTMLElement) {
            return sibling;
        }
        // 如果父节点是根节点容器，停止查找
        if (nextElement.parentElement?.id === "foldTree") {
            break;
        }
        // 如果没有父节点，停止查找
        if (!nextElement.parentElement) {
            break;
        }
        // 回溯到父节点继续查找兄弟
        nextElement = nextElement.parentElement;
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
        // 如果遇到隐藏元素，则跳过并继续查找上一个兄弟节点
        if (sibling && sibling.classList.contains("fn__none") && sibling instanceof HTMLElement) {
            previousElement = sibling;
            continue;
        }
        // 如果是列表项且是 HTMLElement，直接返回
        if (sibling?.tagName === "LI" && sibling instanceof HTMLElement) {
            return sibling;
        }
        // 如果是其他元素（可能包含子列表），查找其最后一个列表项
        const liElements = sibling?.querySelectorAll(".b3-list-item");
        const lastLi = liElements?.[liElements.length - 1];
        // 确保找到的元素是有效的 HTMLElement
        if (lastLi instanceof HTMLElement) {
            return lastLi;
        }
        // 如果父节点是根节点容器，停止查找
        if (previousElement.parentElement?.id === "foldTree") {
            break;
        }
        // 如果没有父节点，停止查找
        if (!previousElement.parentElement) {
            break;
        }
        // 回溯到父节点继续查找
        previousElement = previousElement.parentElement;
    }
    return previousElement;
}

/**
 * 处理左方向键导航（跳转到父元素）
 */
function 处理左方向键导航(currentItemElement: HTMLElement, currentPanelElement: HTMLElement) {
    const parentElement = currentItemElement.parentElement?.previousElementSibling;
    // 如果没有父元素或者父元素不是 HTMLElement，无法导航
    if (!parentElement || !(parentElement instanceof HTMLElement)) {
        return;
    }
    let targetElement: HTMLElement | null = parentElement;
    // 如果父元素不是列表项（例如根目录），则尝试选中第一个列表项
    if (parentElement.tagName !== "LI") {
        const firstItem = currentPanelElement.querySelector(".b3-list-item");
        targetElement = (firstItem instanceof HTMLElement) ? firstItem : null;
    }
    // 如果确定了目标元素，进行焦点切换和滚动
    if (targetElement) {
        currentItemElement.classList.remove("b3-list-item--focus");
        targetElement.classList.add("b3-list-item--focus");
        滚动到可见区域(targetElement, currentPanelElement);
    }
}

/**
 * 将元素滚动到可见区域
 */
function 滚动到可见区域(element: HTMLElement, container: HTMLElement) {
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    // 如果元素超出可视区域（偏上或偏下），通过 scrollIntoView 滚动到可见位置
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
    // 如果需要向下滚动调整视图
    if (需要调整向下滚动) {
        panel.scrollTop = item.offsetTop - panel.clientHeight + lineHeight;
        return;
    }
    // 如果仅是向下方向操作且不需要调整滚动，直接返回
    if (direction === "down") {
        return;
    }
    // direction === "up"
    const 需要调整向上滚动 = panel.scrollTop < item.offsetTop - panel.clientHeight + lineHeight ||
        panel.scrollTop > item.offsetTop - lineHeight * 2;
    // 如果需要向上滚动调整视图
    if (需要调整向上滚动) {
        panel.scrollTop = item.offsetTop - lineHeight * 2;
    }
}

/**
 * 处理通用快捷键
 *
 * 作用：拦截并处理通用的键盘快捷键事件，如打开历史记录菜单
 * 意图：统一管理全局快捷键，防止与默认行为冲突
 * 调用时机：在键盘事件处理器入口处调用
 * 问题/改进：
 * - 快捷键目前是硬编码的
 * - 未来应考虑从配置中读取快捷键设置
 */
function 处理通用快捷键(event: KeyboardEvent, toggleMovePathHistory: () => void) {
    // 如果正在输入法输入中，不处理快捷键
    if (event.isComposing) {
        return true;
    }
    // 如果按下了切换历史记录的快捷键 (Option/Alt + Down)
    if (matchHotKey("⌥↓", event)) {
        event.stopPropagation();
        toggleMovePathHistory();
        return true;
    }
    // 如果当前已经打开了移动路径历史菜单，阻止后续事件，避免冲突
    if (getSiyuanGlobalMenus()?.menu.element.getAttribute("data-name") === Constants.MENU_MOVE_PATH_HISTORY) {
        return true;
    }
    return false;
}
