import { hasClosestByClassName, hasClosestByTag } from "../protyle/util/hasClosest";

export const scrollToCurrent = (contentElement: HTMLElement, currentRange: Range, contentRect: DOMRect) => {
    contentElement.scrollTop = contentElement.scrollTop + currentRange.getBoundingClientRect().top - contentRect.top - contentRect.height / 2;
    const tableElement = hasClosestByClassName(currentRange.startContainer, "table");
    if (tableElement) {
        const cellElement = hasClosestByTag(currentRange.startContainer, "TD") || hasClosestByTag(currentRange.startContainer, "TH");
        if (cellElement) {
            tableElement.firstElementChild.scrollLeft = cellElement.offsetLeft;
            if (tableElement.getAttribute("custom-pinthead") === "true") {
                contentElement.scrollTop = contentElement.scrollTop + tableElement.getBoundingClientRect().top - contentRect.top;
                tableElement.querySelector("table").scrollTop = cellElement.offsetTop;
            }
        }
    }
};
