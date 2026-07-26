import {isOnlyMeta} from "./imports";
import {isHTMLElement} from "./imports";
import {getLeaf} from "./imports";
import {siyuanI18n} from "./imports";
import type {ClickHandlerContext} from "./model/movePathTo.types";
import {isMobilePlatform} from "./imports";

/**
 * 创建点击事件处理器
 */
export function 创建点击事件处理器(context: ClickHandlerContext) {
    return (event: MouseEvent) => {
        处理点击目标(event, context);
        if (!isMobilePlatform()) {
            context.inputElement.focus();
        }
    };
}

/**
 * 处理点击目标元素
 */
function 处理点击目标(event: MouseEvent, context: ClickHandlerContext) {
    const { searchListElement, searchTreeElement, toggleMovePathHistory, options, dialog } = context;
    let target = event.target;

    while (isHTMLElement(target) && !target.isEqualNode(dialog.element)) {
        const handled = 分派点击处理(target, {
            searchListElement, searchTreeElement, toggleMovePathHistory, options, dialog, event
        });
        // 如果事件已被处理，则停止向上冒泡
        if (handled) {
            break;
        }
        target = target.parentElement;
    }
}

/**
 * 分派点击事件到对应的处理器，返回是否已处理
 */
function 分派点击处理(target: HTMLElement, params: {
    searchListElement: HTMLElement;
    searchTreeElement: HTMLElement;
    toggleMovePathHistory: () => void;
    options: ClickHandlerContext["options"];
    dialog: ClickHandlerContext["dialog"];
    event: MouseEvent;
}): boolean {
    const { searchListElement, searchTreeElement, toggleMovePathHistory, options, dialog, event } = params;

    // 如果点击的是列表项的展开切换按钮
    if (target.classList.contains("b3-list-item__toggle") && target.parentElement) {
        getLeaf(target.parentElement, options.flashcard);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    // 如果点击的是历史记录图标
    if (target.classList.contains("b3-form__icon-list")) {
        toggleMovePathHistory();
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    // 如果点击的是确认按钮
    if (target.classList.contains("b3-button--text")) {
        处理确认按钮点击(searchListElement, searchTreeElement, options, dialog, event);
        return true;
    }
    // 如果点击的是取消按钮
    if (target.classList.contains("b3-button--cancel")) {
        dialog.destroy();
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    // 如果点击的是列表项
    if (target.classList.contains("b3-list-item")) {
        处理列表项点击(target, searchListElement, searchTreeElement, options, event);
        return true;
    }
    return false;
}

/**
 * 处理确认按钮点击
 */
function 处理确认按钮点击(
    searchListElement: HTMLElement,
    searchTreeElement: HTMLElement,
    options: { cb: (toPath: string[], toNotebook: string[]) => void },
    dialog: ClickHandlerContext["dialog"],
    event: MouseEvent
) {
    const currentPanelElement = searchListElement.classList.contains("fn__none") ? searchTreeElement : searchListElement;
    const currentItemElements = currentPanelElement.querySelectorAll(".b3-list-item--focus");
    // 如果没有选中的项
    if (currentItemElements.length === 0) {
        return;
    }
    const pathList: string[] = [];
    const notebookIdList: string[] = [];
    for (const item of currentItemElements) {
        const path = item.getAttribute("data-path");
        const box = item.getAttribute("data-box");
        // 如果 path 存在
        if (path) {
            pathList.push(path);
        }
        // 如果 box 存在
        if (box) {
            notebookIdList.push(box);
        }
    }
    options.cb(pathList, notebookIdList);
    dialog.destroy();
    event.preventDefault();
    event.stopPropagation();
}

/**
 * 处理列表项点击
 */
function 处理列表项点击(
    target: HTMLElement,
    searchListElement: HTMLElement,
    searchTreeElement: HTMLElement,
    options: { flashcard: boolean; title?: string },
    event: MouseEvent
) {
    const currentPanelElement = searchListElement.classList.contains("fn__none") ? searchTreeElement : searchListElement;
    const currentItemElements = currentPanelElement.querySelectorAll(".b3-list-item--focus");
    // 如果没有选中的项
    if (currentItemElements.length === 0) {
        return;
    }
    const isSpecifyPath = options.title === siyuanI18n.specifyPath;
    const isMeta = isOnlyMeta(event);

    // 多选模式：至少需选中一个
    const 是多选模式 = isSpecifyPath && isMeta;
    const 不是唯一选中项 = !(currentItemElements.length === 1 && currentItemElements[0] === target);
    // 如果是多选模式且不是唯一选中项
    if (是多选模式 && 不是唯一选中项) {
        target.classList.toggle("b3-list-item--focus");
    }
    // 单选模式
    if (!isSpecifyPath || !isMeta) {
        const firstItem = currentItemElements[0];
        firstItem?.classList.remove("b3-list-item--focus");
        target.classList.add("b3-list-item--focus");
    }

    // 如果点击的是根路径
    if (target.getAttribute("data-path") === "/") {
        getLeaf(target, options.flashcard);
    }
    event.preventDefault();
    event.stopPropagation();
}
