import { focusByRange } from "../ai/imports";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { getTextNode } from "./anno";
import { setConfig } from "./anno.config";
import { createAnnoCoords } from "./anno.content";
import { mergeRects } from "./anno.mergeRects";
import { getPageViewInfo } from "./anno.page";

interface AnnotationResultParams {
    pdf: any;
    startIndex: number;
    endIndex: number;
    startSelected: number[];
    endSelected: number[];
    content: string;
    color: string;
}

const getRangePageInfo = (range: Range) => {
    const startPageElement = hasClosestByClassName(range.startContainer, "page");
    if (!startPageElement) {
        return;
    }
    const startIndex = parseInt(
        startPageElement.getAttribute("data-page-number") || "0") - 1;

    const endPageElement = hasClosestByClassName(range.endContainer, "page");
    if (!endPageElement) {
        return;
    }
    const endIndex = parseInt(endPageElement.getAttribute("data-page-number") || "0") - 1;
    
    return { startIndex, endIndex };
};

const processRangeContents = (range: Range) => {
    // https://github.com/siyuan-note/siyuan/issues/5213
    const rangeContents = range.cloneContents();
    Array.from(rangeContents.children).forEach(item => {
        if (item.tagName === "BR" && item.previousElementSibling && item.nextElementSibling) {
            const previousText = item.previousElementSibling.textContent;
            const nextText = item.nextElementSibling.textContent;
            if (/^[A-Za-z]$/.test(previousText.substring(previousText.length - 2, previousText.length - 1)) &&
                /^[A-Za-z]$/.test(nextText.substring(0, 1))) {
                if (previousText.endsWith("-")) {
                    item.previousElementSibling.textContent = previousText.substring(0, previousText.length - 1);
                } else {
                    // 中文情况不能添加 https://github.com/siyuan-note/siyuan/issues/8152
                    item.insertAdjacentText("afterend", " ");
                }
            }
        }
    });
    // eslint-disable-next-line no-control-regex
    return Lute.EscapeHTMLStr(rangeContents.textContent.replace(/[\x00]|\n/g, ""));
};

const processPageSelection = (pdf: any, pageIndex: number, range: Range) => {
    const page = pdf.pdfViewer.getPageView(pageIndex);
    const pageRect = page.canvas.getClientRects()[0];
    const viewport = page.viewport;
    
    const selected: number[] = [];
    mergeRects(range).forEach(function (r) {
        selected.push(
            viewport.convertToPdfPoint(r.left - pageRect.x,
                r.top - pageRect.y).concat(viewport.convertToPdfPoint(r.right - pageRect.x,
                    r.bottom - pageRect.y))
        );
    });
    
    return selected;
};

export const getHightlightCoordsByRange = (pdf: any, color: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return;
    }
    const range = selection.getRangeAt(0);
    const pageInfo = getRangePageInfo(range);
    if (!pageInfo) {
        return;
    }
    const { startIndex, endIndex } = pageInfo;
    const content = processRangeContents(range);
    const startPage = pdf.pdfViewer.getPageView(startIndex);
    
    const cloneRange = range.cloneRange();
    if (startIndex !== endIndex) {
        const startTextNode = getTextNode(startPage.textLayer.div, false);
        if (startTextNode) {
            range.setEndAfter(startTextNode);
        }
    }

    const startSelected = processPageSelection(pdf, startIndex, range);

    let endSelected: number[] = [];
    if (startIndex !== endIndex) {
        focusByRange(cloneRange);
        const endPage = pdf.pdfViewer.getPageView(endIndex);
        const endTextNode = getTextNode(endPage.textLayer.div, true);
        if (endTextNode) {
            cloneRange.setStart(endTextNode, 0);
        }
        endSelected = processPageSelection(pdf, endIndex, cloneRange);
    }

    return createAnnotationResults({ pdf, startIndex, endIndex, startSelected, endSelected, content, color });
};

const createAnnotationResults = (params: AnnotationResultParams) => {
    const { pdf, startIndex, endIndex, startSelected, endSelected, content, color } = params;
    const id = Lute.NewNodeID();
    const pages: {
        index: number;
        positions: number[];
    }[] = [];
    const results = [];
    
    if (startSelected.length > 0) {
        pages.push({
            index: startIndex,
            positions: startSelected,
        });
        const pageInfo = getPageViewInfo(pdf, startIndex);
        results.push(createAnnoCoords(pageInfo, startSelected, id, color, content, "text", "text"));
    }
    if (endSelected.length > 0) {
        pages.push({
            index: endIndex,
            positions: endSelected,
        });
        const pageInfo = getPageViewInfo(pdf, endIndex);
        results.push(createAnnoCoords(pageInfo, endSelected, id, color, content, "text", "text"));
    }
    
    if (pages.length === 0) {
        return;
    }
    
    setConfig(pdf, id, {
        pages,
        content,
        color,
        type: "text",
        mode: "text",
    });
    
    return results;
};
