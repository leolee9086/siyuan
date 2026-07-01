import { hlPDFRect } from "./anno.hlPDFRect";
import { getOrCreateElement, isHTMLElement } from "./anno.guard";
import type { IAnnoCoords, IPdfInstance, IPdfViewport } from "./anno.types";

/**
 * 获取PDF页面的相关元素
 * @param pdf - PDF实例
 * @param pageIndex - 页面索引
 * @returns 页面元素信息
 */
const getPageElements = (pdf: IPdfInstance, pageIndex: number) => {
    const page = pdf.pdfViewer.getPageView(pageIndex);
    if (!page) {
        throw new Error(`Page view not found for index ${pageIndex}`);
    }
    const textLayerElement = page.textLayer.div;
    return { page, textLayerElement };
};

/**
 * 获取或创建矩形容器元素
 * @param textLayerElement - 文本层元素
 * @returns 矩形容器元素
 */
const getOrCreateRectsElement = (textLayerElement: HTMLElement) => {
    const rectsElement = getOrCreateElement(
        textLayerElement,
        ".pdf__rects",
        "<div class='pdf__rects'></div>"
    );
    if (!rectsElement) {
        throw new Error("Failed to get or create rects element");
    }
    return rectsElement;
};

/**
 * 生成矩形样式字符串
 * @param selected - 注释坐标信息
 * @returns CSS 样式字符串
 */
const generateRectStyle = (selected: IAnnoCoords) => {
    if (selected.type === "border") {
        return `border: 2px solid ${selected.color};`;
    }
    return `border: 2px solid ${selected.color};background-color: ${selected.color};`;
};

/**
 * 生成单个矩形的 HTML
 * @param selected - 注释坐标信息
 * @param viewport - PDF 视口对象
 * @param rect - 矩形坐标数组
 * @returns HTML 字符串
 */
const generateRectHtml = (selected: IAnnoCoords, viewport: IPdfViewport, rect: number[]) => {
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

/**
 * 生成高亮 HTML 内容
 * @param selected - 注释坐标信息
 * @param viewport - PDF 视口对象
 * @returns 完整的高亮 HTML 字符串
 */
const generateHighlightHtml = (selected: IAnnoCoords, viewport: IPdfViewport) => {
    let html = `<div class="pdf__rect popover__block" data-node-id="${selected.id}" data-relations="${selected.ids || ""}" data-mode="${selected.mode}">`;

    for (const rect of selected.coords) {
        const rectArray = Array.isArray(rect) ? rect : [rect];
        const rectHtml = generateRectHtml(selected, viewport, rectArray);
        if (rectHtml) {
            html += rectHtml;
        }
    }

    return html + "</div>";
};

/**
 * 插入高亮元素到容器
 * @param rectsElement - 矩形容器元素
 * @param selected - 注释坐标信息
 * @param html - 高亮 HTML 字符串
 * @returns 插入的元素
 */
const insertHighlightElement = (rectsElement: HTMLElement, selected: IAnnoCoords, html: string) => {
    rectsElement.insertAdjacentHTML("beforeend", html);
    const lastChild = rectsElement.lastElementChild;
    if (!isHTMLElement(lastChild)) {
        throw new Error("Failed to insert highlight element");
    }
    lastChild.setAttribute("data-content", selected.content);
    return lastChild;
};

/**
 * 显示PDF高亮标注
 * 
 * @param selected - 注释坐标信息，包含位置、颜色、内容等
 * @param pdf - PDF实例对象
 * @param hl - 是否同时高亮显示注释（可选）
 * @returns 创建的高亮元素
 */
export const showHighlight = (selected: IAnnoCoords, pdf: IPdfInstance, hl?: boolean) => {
    const pageIndex = selected.index;
    const { page, textLayerElement } = getPageElements(pdf, pageIndex);
    if (!textLayerElement.lastElementChild) {
        throw new Error("Text layer not rendered yet");
    }

    // rotation: 处理旋转问题 https://github.com/siyuan-note/siyuan/issues/9831
    const viewport = page.viewport.clone({ rotation: 0 });
    const rectsElement = getOrCreateRectsElement(textLayerElement);
    const html = generateHighlightHtml(selected, viewport);
    const lastChild = insertHighlightElement(rectsElement, selected, html);

    if (hl) {
        hlPDFRect(rectsElement, selected.id);
    }

    return lastChild;
};
