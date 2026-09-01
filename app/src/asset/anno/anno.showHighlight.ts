/** 用途：触发定位后的标注视觉高亮。使用范围：恢复/新建标注后。解耦评估：同目录 display helper 是完整的高亮生命周期 owner。 */
import {hlPDFRect} from "./anno.hlPDFRect";
/** 用途：获取静态矩形容器。使用范围：PDF 页面首次渲染标注时。解耦评估：guard 集中 HTMLElement 收窄与静态容器创建。 */
import {getOrCreateElement} from "./anno.guard";
/** 用途：约束高亮坐标载荷。使用范围：安全 DOM 建构的输入边界。解耦评估：纯类型不产生运行时依赖。 */
import type {IAnnoCoords} from "./anno.types";
/** 用途：约束 PDF 实例。使用范围：页面和 viewport 访问。解耦评估：纯类型不产生运行时依赖。 */
import type {IPdfInstance} from "./anno.types";
/** 用途：约束 PDF viewport。使用范围：安全矩形尺寸计算。解耦评估：纯类型不产生运行时依赖。 */
import type {IPdfViewport} from "./anno.types";

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
 * 将标注色写入矩形子元素的 CSSOM 样式。
 */
const applyRectStyle = (rectElement: HTMLElement, selected: IAnnoCoords) => {
    rectElement.style.border = `2px solid ${selected.color}`;
    // 边框模式只保留轮廓，其余模式填充用户选择的标注颜色。
    if (selected.type !== "border") {
        rectElement.style.backgroundColor = selected.color;
    }
};

/**
 * 将一个 PDF 坐标矩形转为安全的子元素并插入标注容器。
 */
const appendHighlightRect = (options: {
    rectsElement: HTMLElement,
    selected: IAnnoCoords,
    viewport: IPdfViewport,
    rect: number[],
}) => {
    const bounds = options.viewport.convertToViewportRectangle(options.rect);
    const width = Math.abs(bounds[0] - bounds[2]);
    if (width <= 0) {
        return;
    }
    const rectChild = document.createElement("div");
    applyRectStyle(rectChild, options.selected);
    rectChild.style.left = `${Math.min(bounds[0], bounds[2])}px`;
    rectChild.style.top = `${Math.min(bounds[1], bounds[3])}px`;
    rectChild.style.width = `${width}px`;
    rectChild.style.height = `${Math.abs(bounds[1] - bounds[3])}px`;
    options.rectsElement.append(rectChild);
};

/**
 * 使用 DOM API 创建标注根元素，不将 .sya 字段拼接进 HTML 字符串。
 */
const createHighlightElement = (selected: IAnnoCoords, viewport: IPdfViewport) => {
    const rectElement = document.createElement("div");
    rectElement.className = "pdf__rect popover__block";
    rectElement.setAttribute("data-node-id", selected.id);
    rectElement.setAttribute("data-relations", selected.ids ? selected.ids.join(",") : "");
    rectElement.setAttribute("data-mode", selected.mode);
    rectElement.setAttribute("data-content", selected.content);
    for (const rect of selected.coords) {
        const rectArray = Array.isArray(rect) ? rect : [rect];
        appendHighlightRect({
            rectsElement: rectElement,
            selected,
            viewport,
            rect: rectArray,
        });
    }
    return rectElement;
};

/** @同步豁免: UI构建 */
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
    const rectElement = createHighlightElement(selected, viewport);
    rectsElement.append(rectElement);

    if (hl) {
        hlPDFRect(rectsElement, selected.id);
    }

    return rectElement;
};
