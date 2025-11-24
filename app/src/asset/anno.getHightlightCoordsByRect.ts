import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { setConfig } from "./anno.config";
import { generateRectContent, createAnnoCoords } from "./anno.content";
import { getPageViewInfo } from "./anno.page";

const getStartPageInfo = (rect: DOMRect) => {
    const element = document.elementFromPoint(rect.left, rect.top - 1);
    if (!element) {
        return null;
    }
    const startPageElement = hasClosestByClassName(element, "page");
    if (!startPageElement) {
        return null;
    }
    const pageNumber = startPageElement.getAttribute("data-page-number");
    if (!pageNumber) {
        return null;
    }
    const startIndex = parseInt(pageNumber) - 1;
    return { startPageElement, startIndex };
};

const calculatePdfCoordinates = (rect: DOMRect, pageRect: DOMRect, viewport: any) => {
    return viewport.convertToPdfPoint(
        rect.left - pageRect.x,
        rect.top - pageRect.y).concat(viewport.convertToPdfPoint(rect.right - pageRect.x,
            rect.bottom - pageRect.y));
};

const processEndPage = (pdf: any, rect: DOMRect, startIndex: number, id: string, color: string, content: string, type: string, pages: any[], result: any[]) => {
    let endElement = document.elementFromPoint(rect.right, rect.bottom + 1);
    if (!endElement) {
        endElement = document.body;
    }
    const endPageElement = hasClosestByClassName(endElement, "page") as HTMLElement;
    if (endPageElement) {
        const pageNumber = endPageElement.getAttribute("data-page-number");
        if (!pageNumber) {
            return result;
        }
        const endIndex = parseInt(pageNumber) - 1;
        if (endIndex !== startIndex) {
            const endPage = pdf.pdfViewer.getPageView(endIndex);
            const endPageRect = endPage.canvas.getClientRects()[0];
            const endViewport = endPage.viewport;

            const endSelected = calculatePdfCoordinates(rect, endPageRect, endViewport);
            pages.push({
                index: endPage.id - 1,
                positions: [endSelected],
            });
            const endPageInfo = getPageViewInfo(pdf, endIndex);
            result.push(createAnnoCoords(endPageInfo, [endSelected], id, color, content, type, "rect"));
        }
    }
    return result;
};

const createAnnotationResult = (pageInfo: any, startSelected: number[], id: string, color: string, content: string, type: string) => {
    return [createAnnoCoords(pageInfo, startSelected, id, color, content, type, "rect")];
};

export const getHightlightCoordsByRect = (pdf: any, color: string, rectResizeElement: HTMLElement, type: string) => {
    const rect = rectResizeElement.getBoundingClientRect();

    const startPageInfo = getStartPageInfo(rect);
    if (!startPageInfo) {
        return;
    }
    const { startPageElement, startIndex } = startPageInfo;

    const startPage = pdf.pdfViewer.getPageView(startIndex);
    const startPageRect = startPage.canvas.getClientRects()[0];
    const startViewport = startPage.viewport;

    const startSelected = calculatePdfCoordinates(rect, startPageRect, startViewport);

    const pages: {
        index: number;
        positions: number[];
    }[] = [
            {
                index: startPage.id - 1,
                positions: [startSelected],
            }
        ];

    const id = Lute.NewNodeID();
    const pageInfo = getPageViewInfo(pdf, startIndex);
    const content = generateRectContent(pdf, pageInfo, id);
    const result = createAnnotationResult(pageInfo, startSelected, id, color, content, type);

    processEndPage(pdf, rect, startIndex, id, color, content, type, pages, result);

    setConfig(pdf, id, {
        pages,
        content,
        color,
        type,
        mode: "rect",
    });
    return result;
};
