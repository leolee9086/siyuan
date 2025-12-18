import { hasClosestByClassName, hasClosestByTag } from "../protyle/util/hasClosest";

export const scrollToCurrent = (contentElement: HTMLElement, currentRange: Range, contentRect: DOMRect) => {
    contentElement.scrollTop = contentElement.scrollTop + currentRange.getBoundingClientRect().top - contentRect.top - contentRect.height / 2;
    const tableElement = hasClosestByClassName(currentRange.startContainer, "table");
    
    if (!tableElement) {
        return;
    }
    
    const cellElement = hasClosestByTag(currentRange.startContainer, "TD") || hasClosestByTag(currentRange.startContainer, "TH");
    
    if (!cellElement) {
        return;
    }
    
    const tableFirstChild = tableElement.firstElementChild;
    if (tableFirstChild) {
        tableFirstChild.scrollLeft = cellElement.offsetLeft;
    }
    
    const isPinthead = tableElement.getAttribute("custom-pinthead") === "true";
    if (isPinthead) {
        contentElement.scrollTop = contentElement.scrollTop + tableElement.getBoundingClientRect().top - contentRect.top;
        
        const tableElementInner = tableElement.querySelector("table");
        if (tableElementInner) {
            tableElementInner.scrollTop = cellElement.offsetTop;
        }
    }
};
