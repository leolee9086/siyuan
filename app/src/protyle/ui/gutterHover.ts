import {getGutterNodeElement} from "../gutter/gutter.node";
import {hasClosestByTag} from "../util/hasClosest";

const removeOtherHighlights = (
    protyle: IProtyle,
    currentItem: Element,
    rowItem: Element | null,
) => {
    for (const highlightedItem of protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--hl, .av__row--hl")) {
        if (currentItem !== highlightedItem) {
            highlightedItem.classList.remove("protyle-wysiwyg--hl");
        }
        if (rowItem && rowItem !== highlightedItem) {
            highlightedItem.classList.remove("av__row--hl");
        }
    }
};

/** 处理 Gutter 按钮悬停，并将高亮投影到按钮对应的真实块或数据库行。 */
export const highlightGutterButtonTarget = (protyle: IProtyle, target: HTMLElement, event: Event): boolean => {
    const buttonElement = hasClosestByTag(target, "BUTTON");
    if (!buttonElement || !buttonElement.parentElement?.classList.contains("protyle-gutters")) {
        return false;
    }

    const type = buttonElement.getAttribute("data-type");
    if (type === "fold" || type === "NodeAttributeViewRow") {
        for (const item of protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--hl, .av__row--hl")) {
            item.classList.remove("protyle-wysiwyg--hl", "av__row--hl");
        }
        return true;
    }

    const gutterNodeElement = getGutterNodeElement(protyle, buttonElement);
    if (gutterNodeElement) {
        const bodyQueryClass = buttonElement.dataset.groupId && buttonElement.dataset.groupId !== "undefined"
            ? `.av__body[data-group-id="${buttonElement.dataset.groupId}"] `
            : "";
        const rowItem = gutterNodeElement.querySelector(bodyQueryClass + `.av__row[data-id="${buttonElement.dataset.rowId}"]`);
        removeOtherHighlights(protyle, gutterNodeElement, rowItem);
        if (type === "NodeAttributeViewRowMenu" && rowItem) {
            rowItem.classList.add("av__row--hl");
        } else {
            gutterNodeElement.classList.add("protyle-wysiwyg--hl");
        }
    }

    event.preventDefault();
    return true;
};
