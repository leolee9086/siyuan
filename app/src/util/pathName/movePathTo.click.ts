import { Dialog } from "../../dialog";
import { isOnlyMeta } from "../../protyle/util/compatibility";
import { getLeaf } from "../pathName";
import { siyuanI18n } from "../siyuanEnvironments/i18n.getI18n.environment";

/** 点击事件处理器的上下文类型 */
type ClickHandlerContext = {
    searchListElement: HTMLElement;
    searchTreeElement: HTMLElement;
    toggleMovePathHistory: () => void;
    options: {
        flashcard: boolean;
        title?: string;
        cb: (toPath: string[], toNotebook: string[]) => void;
    };
    dialog: Dialog;
    inputElement: HTMLInputElement;
};

/**
 * 创建点击事件处理器
 */
export function 创建点击事件处理器(context: ClickHandlerContext) {
    return (event: MouseEvent) => {
        处理点击目标(event, context);
        /// #if !MOBILE
        context.inputElement.focus();
        /// #endif
    };
}

/**
 * 处理点击目标元素
 */
function 处理点击目标(event: MouseEvent, context: ClickHandlerContext) {
    const { searchListElement, searchTreeElement, toggleMovePathHistory, options, dialog } = context;
    let target = event.target as HTMLElement;

    while (target && !target.isEqualNode(dialog.element)) {
        const handled = 分派点击处理(target, {
            searchListElement, searchTreeElement, toggleMovePathHistory, options, dialog, event
        });
        if (handled) break;
        target = target.parentElement as HTMLElement;
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
    dialog: Dialog;
    event: MouseEvent;
}): boolean {
    const { searchListElement, searchTreeElement, toggleMovePathHistory, options, dialog, event } = params;

    if (target.classList.contains("b3-list-item__toggle") && target.parentElement) {
        getLeaf(target.parentElement, options.flashcard);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (target.classList.contains("b3-form__icon-list")) {
        toggleMovePathHistory();
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (target.classList.contains("b3-button--text")) {
        处理确认按钮点击(searchListElement, searchTreeElement, options, dialog, event);
        return true;
    }
    if (target.classList.contains("b3-button--cancel")) {
        dialog.destroy();
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
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
    dialog: Dialog,
    event: MouseEvent
) {
    const currentPanelElement = searchListElement.classList.contains("fn__none") ? searchTreeElement : searchListElement;
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
    if (currentItemElements.length === 0) {
        return;
    }
    const isSpecifyPath = options.title === siyuanI18n.specifyPath;
    const isMeta = isOnlyMeta(event);

    // 多选模式：至少需选中一个
    const 是多选模式 = isSpecifyPath && isMeta;
    const 不是唯一选中项 = !(currentItemElements.length === 1 && currentItemElements[0] === target);
    if (是多选模式 && 不是唯一选中项) {
        target.classList.toggle("b3-list-item--focus");
    }
    // 单选模式
    if (!isSpecifyPath || !isMeta) {
        const firstItem = currentItemElements[0];
        firstItem?.classList.remove("b3-list-item--focus");
        target.classList.add("b3-list-item--focus");
    }

    if (target.getAttribute("data-path") === "/") {
        getLeaf(target, options.flashcard);
    }
    event.preventDefault();
    event.stopPropagation();
}
