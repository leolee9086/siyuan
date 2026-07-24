/**
 * 用途：Range聚焦功能，在处理跨页选区时设置浏览器焦点
 * 使用范围：getEndSelected函数中聚焦克隆的Range以正确获取结束页选区
 * 解耦评估：依赖DOM Selection API，无法解耦，必须直接调用
 */
import { focusByRange } from "./imports";

/**
 * 用途：查找最近的具有指定className的祖先元素，定位Range所在的PDF页面
 * 使用范围：getRangePageInfo中查找startContainer和endContainer所在的.page元素
 * 解耦评估：纯DOM遍历工具，理论上可参数化但无实际收益
 */
import { hasClosestByClassName } from "./imports";

/**
 * 用途：获取当前窗口的Selection对象，获取用户选中的文本范围
 * 使用范围：getHightlightCoordsByRange入口处获取用户在PDF中的选区
 * 解耦评估：浏览器环境抽象层，必须通过环境工具统一访问，无法解耦
 */
import { getWindowSelection } from "./imports";

/**
 * 用途：获取文本节点，用于设置Range的起止位置
 * 使用范围：getEndSelected和getHightlightCoordsByRange中获取页面的首尾文本节点
 * 解耦评估：anno模块内部工具函数，直接导入符合模块内聚原则
 */
import { getTextNode } from "./text/getTextNode";

/**
 * 用途：设置PDF注释配置，保存注释数据到PDF实例
 * 使用范围：createAnnotationResults中保存创建的注释配置
 * 解耦评估：anno模块的配置管理函数，直接导入符合职责分离
 */
import { setConfig } from "./config";

/**
 * 用途：创建注释坐标对象，将PDF坐标转换为注释数据结构
 * 使用范围：createAnnotationResults中为每个页面创建注释坐标
 * 解耦评估：anno模块核心功能，直接导入符合模块内聚
 */
import { createAnnoCoords } from "./anno.content";

/**
 * 用途：合并Range的多个DOMRect为连续矩形区域
 * 使用范围：processPageSelection中合并选区矩形以优化坐标计算
 * 解耦评估：纯几何计算工具，理论上可参数化但作为通用工具直接导入更清晰
 */
import { mergeRects } from "./imports";

/**
 * 用途：处理Range内容，提取选中的文本
 * 使用范围：getHightlightCoordsByRange中获取用户选中的文本作为注释内容
 * 解耦评估：纯DOM Range处理工具，理论上可参数化但直接导入更符合工具函数使用模式
 */
import { processRangeContents } from "./imports";

/**
 * 用途：获取PDF页面视图信息，包含页面尺寸和视口数据
 * 使用范围：createAnnotationResults中获取页面信息以创建注释坐标
 * 解耦评估：anno模块内部工具，直接导入符合模块内聚
 */
import { getPageViewInfo } from "./anno.page";

/**
 * 用途：注释结果参数类型，定义创建注释时的参数结构
 * 使用范围：createAnnotationResults函数的参数类型声明
 * 解耦评估：类型定义，编译时依赖，无需解耦
 */
import type { AnnotationResultParams } from "./anno.types";

/**
 * 用途：PDF实例接口类型，定义PDF.js实例的结构
 * 使用范围：多个函数的pdf参数类型声明
 * 解耦评估：类型定义，编译时依赖，无需解耦
 */
import type { IPdfInstance } from "./anno.types";

/**
 * 用途：矩形边界接口类型，定义矩形的left/top/right/bottom属性
 * 使用范围：convertRectToPdfCoords函数的矩形参数类型
 * 解耦评估：类型定义，编译时依赖，无需解耦
 */
import type { IRectBounds } from "./anno.types";

/**
 * 获取 Range 所在的页面信息
 */
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

/**
 * 处理单个矩形，转换为 PDF 坐标
 */
const convertRectToPdfCoords = (
    r: IRectBounds,
    pageRect: DOMRect,
    viewport: { convertToPdfPoint: (x: number, y: number) => number[] }
) => {
    const topLeft = viewport.convertToPdfPoint(r.left - pageRect.x, r.top - pageRect.y);
    const bottomRight = viewport.convertToPdfPoint(r.right - pageRect.x, r.bottom - pageRect.y);
    return topLeft.concat(bottomRight);
};

/**
 * 处理页面选区，返回选中的坐标
 */
const processPageSelection = (pdf: IPdfInstance, pageIndex: number, range: Range) => {
    const page = pdf.pdfViewer.getPageView(pageIndex);
    if (!page) {
        return [];
    }
    const canvasRects = page.canvas.getClientRects();
    if (canvasRects.length === 0) {
        return [];
    }
    const pageRect = canvasRects[0];
    if (!pageRect) {
        return [];
    }
    const viewport = page.viewport;

    const selected: number[] = [];
    const rects = mergeRects(range);
    for (const r of rects) {
        const coords = convertRectToPdfCoords(r, pageRect, viewport);
        selected.push(...coords);
    }

    return selected;
};

/**
 * 获取结束页的选区坐标
 */
const getEndSelected = (pdf: IPdfInstance, endIndex: number, cloneRange: Range) => {
    focusByRange(cloneRange);
    const endPage = pdf.pdfViewer.getPageView(endIndex);
    if (!endPage) {
        return [];
    }
    const endTextNode = getTextNode(endPage.textLayer.div, true);
    if (endTextNode) {
        cloneRange.setStart(endTextNode, 0);
    }

    return processPageSelection(pdf, endIndex, cloneRange);
};

/**
 * 根据 Range 获取高亮坐标
 * 
 * @同步豁免: 需要绝对同步的DOM访问 - 此函数必须同步执行以确保在用户选区消失前捕获Selection和Range对象，
 * 异步化会导致Selection状态丢失，无法获取正确的选区坐标
 */
export const getHightlightCoordsByRange = (pdf: IPdfInstance, color: string) => {
    const selection = getWindowSelection();
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
    if (!startPage) {
        return;
    }

    const cloneRange = range.cloneRange();
    const startTextNode = startIndex !== endIndex ? getTextNode(startPage.textLayer.div, false) : undefined;
    if (startTextNode) {
        range.setEndAfter(startTextNode);
    }

    const startSelected = processPageSelection(pdf, startIndex, range);

    let endSelected: number[] = [];
    /**
     * 意图：处理用户选区跨越多个 PDF 页面的情况。
     * `startIndex` 是选区起点所在的页码索引，`endIndex` 是选区终点所在的页码索引。
     * 
     * 生效场景：
     * - 当用户在 PDF 中拖选文本，且选区从第 N 页延伸到第 M 页（N < M）时，
     *   此判断为真，需要调用 `getEndSelected` 获取结束页上的选区坐标。
     * - 当选区仅在单页内时（startIndex === endIndex），跳过此步骤，
     *   因为所有坐标已经在 `startSelected` 中处理完毕。
     */
    if (startIndex !== endIndex) {
        endSelected = getEndSelected(pdf, endIndex, cloneRange);
    }

    return createAnnotationResults({ pdf, startIndex, endIndex, startSelected, endSelected, content, color });
};

/**
 * 创建注释结果
 */
const createAnnotationResults = (params: AnnotationResultParams) => {
    const { pdf, startIndex, endIndex, startSelected, endSelected, content, color } = params;
    const id = Lute.NewNodeID();
    const pages: {
        index: number;
        positions: number[][];
    }[] = [];
    const results = [];

    /**
     * 意图：检查起始页是否有有效的选区坐标。
     * `startSelected` 存储从 `processPageSelection` 返回的起始页坐标数据。
     * 
     * 生效场景：
     * - 当起始页成功获取到选区矩形坐标时，`startSelected.length > 0` 为真，
     *   需要将起始页的坐标数据添加到 `pages` 和 `results` 中。
     * - 当获取页面视图失败、canvas 不存在或没有有效选区矩形时，
     *   `startSelected` 为空数组，跳过起始页的处理。
     */
    if (startSelected.length > 0) {
        pages.push({
            index: startIndex,
            positions: [startSelected],
        });
        const pageInfo = getPageViewInfo(pdf, startIndex);
        results.push(createAnnoCoords(pageInfo, startSelected, id, color, content, "text", "text"));
    }
    /**
     * 意图：检查结束页是否有有效的选区坐标。
     * `endSelected` 仅在跨页选择时（startIndex !== endIndex）才会有数据。
     * 
     * 生效场景：
     * - 当用户选区跨越多个页面时，`endSelected` 包含结束页的坐标数据，
     *   此判断为真，需要将结束页的数据添加到 `pages` 和 `results` 中。
     * - 当选区仅在单页内，或获取结束页坐标失败时，
     *   `endSelected` 为空数组，跳过结束页的处理。
     */
    if (endSelected.length > 0) {
        pages.push({
            index: endIndex,
            positions: [endSelected],
        });
        const pageInfo = getPageViewInfo(pdf, endIndex);
        results.push(createAnnoCoords(pageInfo, endSelected, id, color, content, "text", "text"));
    }

    if (pages.length === 0) {
        return;
    }

    setConfig(pdf, id, {
        id,
        pages,
        content,
        color,
        type: "text",
        mode: "text",
    });

    return results;
};
