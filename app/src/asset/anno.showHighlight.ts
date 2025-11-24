import { hlPDFRect } from "./anno.hlPDFRect";
import type { IAnnoCoords, IPdfInstance } from "./anno.types";

const getPageElements = (pdf: IPdfInstance, pageIndex: number) => {
    const page = pdf.pdfViewer.getPageView(pageIndex);
    const textLayerElement = page.textLayer.div;
    return { page, textLayerElement };
};

const getOrCreateRectsElement = (textLayerElement: HTMLElement): HTMLElement => {
    let rectsElement = textLayerElement.querySelector(".pdf__rects") as HTMLElement;
    if (!rectsElement) {
        textLayerElement.insertAdjacentHTML("beforeend", "<div class='pdf__rects'></div>");
        rectsElement = textLayerElement.querySelector(".pdf__rects") as HTMLElement;
    }
    return rectsElement;
};

const generateRectStyle = (selected: IAnnoCoords): string => {
    let style = `border: 2px solid ${selected.color};background-color: ${selected.color};`;
    if (selected.type === "border") {
        style = `border: 2px solid ${selected.color};`;
    }
    return style;
};

const generateRectHtml = (selected: IAnnoCoords, viewport: any, rect: number[]): string => {
    const bounds = viewport.convertToViewportRectangle(rect);
    const width = Math.abs(bounds[0] - bounds[2]);
    if (width <= 0) {
        return "";
    }
    const style = generateRectStyle(selected);
    return /*html*/`<div style="${style}
left:${Math.min(bounds[0], bounds[2])}px;
top:${Math.min(bounds[1], bounds[3])}px;
width:${width}px;
height: ${Math.abs(bounds[1] - bounds[3])}px"></div>`;
};

const generateHighlightHtml = (selected: IAnnoCoords, viewport: any): string => {
    let html = `<div class="pdf__rect popover__block" data-node-id="${selected.id}" data-relations="${selected.ids || ""}" data-mode="${selected.mode}">`;
    selected.coords.forEach((rect) => {
        const rectHtml = generateRectHtml(selected, viewport, Array.isArray(rect) ? rect : [rect]);
        if (rectHtml) {
            html += rectHtml;
        }
    });
    return html + "</div>";
};

const insertHighlightElement = (rectsElement: HTMLElement, selected: IAnnoCoords, html: string): Element | null => {
    rectsElement.insertAdjacentHTML("beforeend", html);
    const lastChild = rectsElement.lastElementChild;
    if (lastChild) {
        lastChild.setAttribute("data-content", selected.content);
    }
    return lastChild;
};

export const showHighlight = (selected: IAnnoCoords, pdf: IPdfInstance, hl?: boolean) => {
    const pageIndex = selected.index;
    const { page, textLayerElement } = getPageElements(pdf, pageIndex);
    if (!textLayerElement.lastElementChild) {
        return;
    }

    const viewport = page.viewport.clone({ rotation: 0 }); // rotation https://github.com/siyuan-note/siyuan/issues/9831
    const rectsElement = getOrCreateRectsElement(textLayerElement);
    if (!rectsElement) {
        return;
    }
    const html = generateHighlightHtml(selected, viewport);
    const lastChild = insertHighlightElement(rectsElement, selected, html);
    if (hl) {
        hlPDFRect(rectsElement, selected.id);
    }
    return lastChild;
};
