import type { RectElementType } from "./anno.types";
import { getConfig } from "./anno.config";
import { initRectAnnoTool } from "./anno.initRectAnnoTool";
import { initResizeHandler } from "./anno.resize";
import { initClickHandler } from "./anno.click";

export let rectElement: RectElementType;
export const clearRectElement = () => {
    rectElement = null;
}
export const setRectElement = (element: RectElementType) => {
    rectElement = element;
}
export const initAnno = (element: HTMLElement, pdf: any) => {
    getConfig(pdf);
    initRectAnnoTool(element, pdf);
    initResizeHandler(pdf);
    initClickHandler(element, pdf);
    return pdf;
};

export const getTextNode = (element: HTMLElement, isFirst: boolean) => {
    const spans = element.querySelectorAll('span[role="presentation"]');
    let index = isFirst ? 0 : spans.length - 1;
    while (spans[index]) {
        if (spans[index]?.textContent) {
            break;
        } else {
            if (isFirst) {
                index++;
            } else {
                index--;
            }
        }
    }
    return spans[index];
};


