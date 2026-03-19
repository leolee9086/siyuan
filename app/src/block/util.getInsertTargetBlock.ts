import { getEditorRange } from "../protyle/util/selection";
import { getTopAloneElement } from "../protyle/wysiwyg/getBlock";
import { hideElements, hasClosestByClassName } from "./imports";
import { hasClosestBlock } from "./popover/imports";

export const getInsertTargetBlock = (protyle: IProtyle, id?: string, position?: InsertPosition): HTMLElement | null => {
    if (!protyle.wysiwyg?.element) {
        return null;
    }
    if (id) {
        return protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`) as HTMLElement;
    }
    const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    if (selectElements.length > 0) {
        const blockElement = position === "beforebegin" ? selectElements[0] : selectElements[selectElements.length - 1];
        hideElements(["select"], protyle);
        return blockElement as HTMLElement;
    }
    const range = getEditorRange(protyle.wysiwyg.element);
    const closest = hasClosestBlock(range.startContainer);
    if (!closest || !(closest instanceof HTMLElement)) {
        return null;
    }
    let blockElement = closest;
    blockElement = getTopAloneElement(blockElement);
    // https://github.com/siyuan-note/siyuan/issues/14720#issuecomment-2840665326
    if (blockElement.classList.contains("list")) {
        const liElement = hasClosestByClassName(range.startContainer, "li");
        if (liElement && liElement instanceof HTMLElement) {
            return liElement;
        }
    }
    if (blockElement.classList.contains("bq") || blockElement.classList.contains("callout")) {
        const innerBlock = hasClosestBlock(range.startContainer);
        if (innerBlock && innerBlock instanceof HTMLElement) {
            return innerBlock;
        }
    }
    return blockElement;
};
