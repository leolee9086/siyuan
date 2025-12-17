import { Dialog } from "../../dialog";
import { isOnlyMeta } from "../../protyle/util/compatibility";
import { getLeaf } from "../pathName";

/**
 * 创建点击事件处理器
 */
export function 创建点击事件处理器(context: {
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
}) {
    const {
        searchListElement,
        searchTreeElement,
        toggleMovePathHistory,
        options,
        dialog,
        inputElement
    } = context;

    return (event: MouseEvent) => {
        let target = event.target as HTMLElement;
        while (target && !target.isEqualNode(dialog.element)) {
            if (target.classList.contains("b3-list-item__toggle")) {
                getLeaf(target.parentElement, options.flashcard);
                event.preventDefault();
                event.stopPropagation();
                break;
            }
            if (target.classList.contains("b3-form__icon-list")) {
                toggleMovePathHistory();
                event.preventDefault();
                event.stopPropagation();
                break;
            }
            if (target.classList.contains("b3-button--text")) {
                处理确认按钮点击(searchListElement, searchTreeElement, options, dialog, event);
                break;
            }
            if (target.classList.contains("b3-button--cancel")) {
                dialog.destroy();
                event.preventDefault();
                event.stopPropagation();
                break;
            }
            if (target.classList.contains("b3-list-item")) {
                处理列表项点击(target, searchListElement, searchTreeElement, options, event);
                break;
            }
            target = target.parentElement as HTMLElement;
        }
        /// #if !MOBILE
        inputElement.focus();
        /// #endif
    };
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
    const isSpecifyPath = options.title === window.siyuan.languages?.specifyPath;
    const isMeta = isOnlyMeta(event);

    if (isSpecifyPath && isMeta) {
        // 多选模式：至少需选中一个
        const shouldToggle = !(currentItemElements.length === 1 && currentItemElements[0] === target);
        if (shouldToggle) {
            target.classList.toggle("b3-list-item--focus");
        }
    } else {
        // 单选模式
        currentItemElements[0].classList.remove("b3-list-item--focus");
        target.classList.add("b3-list-item--focus");
    }

    if (target.getAttribute("data-path") === "/") {
        getLeaf(target, options.flashcard);
    }
    event.preventDefault();
    event.stopPropagation();
}
