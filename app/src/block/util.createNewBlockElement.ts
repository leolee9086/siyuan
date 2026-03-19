import { genListItemElement } from "../protyle/wysiwyg/list";
import { genEmptyElement, genHeadingElement } from "./util";

export const createNewBlockElement = (blockElement: Element, position: InsertPosition): { newElement: HTMLElement; orderIndex: number; } => {
    let newElement = genEmptyElement(false, true);
    let orderIndex = 1;

    if (blockElement.getAttribute("data-type") === "NodeListItem") {
        newElement = genListItemElement(blockElement, 0, true) as HTMLDivElement;
        const marker = blockElement.parentElement?.firstElementChild?.getAttribute("data-marker");
        if (marker) {
            orderIndex = parseInt(marker);
        }
        return { newElement, orderIndex };
    }

    if (position === "beforebegin" && blockElement.previousElementSibling &&
        blockElement.previousElementSibling.getAttribute("data-type") === "NodeHeading" &&
        blockElement.previousElementSibling.getAttribute("fold") === "1") {
        newElement = genHeadingElement(blockElement.previousElementSibling, false, true) as HTMLDivElement;
        return { newElement, orderIndex };
    }

    if (position === "afterend" && blockElement &&
        blockElement.getAttribute("data-type") === "NodeHeading" &&
        blockElement.getAttribute("fold") === "1") {
        newElement = genHeadingElement(blockElement, false, true) as HTMLDivElement;
        return { newElement, orderIndex };
    }

    return { newElement, orderIndex };
};
