import { hasClosestByClassName } from "../protyle/util/hasClosest";
import type { IPdfInstance, IAnnoCoords } from "./anno.types";
import type { IPageInfo } from "./anno.page";
import { getPageInfoFromPoint, getPageViewInfo } from "./anno.page";
import { calculateRectCoords } from "./anno.coords";
import { generateRectContent, createAnnoCoords } from "./anno.content";
import { setConfig } from "./anno.config";

/**
 * 矩形页面信息接口
 */
export interface IRectPageInfo {
    /** 矩形边界 */
    rect: DOMRect;
    /** 起始页面信息 */
    startPageInfo: IPageInfo;
}

/**
 * 结束页面数据接口
 */
export interface IEndPageData {
    /** 结束页面信息 */
    endPageInfo: IPageInfo | null;
    /** 结束页面注释坐标对象 */
    endAnnoCoords: IAnnoCoords | null;
}

/**
 * 注释结果数据接口
 */
export interface IAnnotationResults {
    /** 页面数组 */
    pages: Array<{ index: number; positions: number[][] }>;
    /** 结果数组 */
    result: IAnnoCoords[];
}

/**
 * 从矩形元素提取页面信息
 * @param rectResizeElement 矩形调整元素
 * @returns 矩形页面信息或null
 */
export const extractRectPageInfo = (rectResizeElement: HTMLElement): IRectPageInfo | null => {
    const rect = rectResizeElement.getBoundingClientRect();
    
    // 获取起始页面信息
    const startPageInfo = getPageInfoFromPoint(rect.left, rect.top - 1);
    if (!startPageInfo) {
        return null;
    }
    
    return {
        rect,
        startPageInfo
    };
};

/**
 * 处理起始页面的注释信息
 * @param pdf PDF实例
 * @param startPageInfo 起始页面信息
 * @param rect 矩形边界
 * @param type 类型
 * @param color 颜色
 * @returns 起始页面注释数据
 */
export const processStartPageAnnotation = (
    pdf: IPdfInstance,
    startPageInfo: IPageInfo,
    rect: DOMRect,
    type: string,
    color: string
): {
    startPageViewInfo: IPageInfo;
    startSelected: number[];
    id: string;
    content: string;
    startAnnoCoords: IAnnoCoords;
} => {
    // 获取完整的起始页面视图信息
    const startPageViewInfo = getPageViewInfo(pdf, startPageInfo.index);
    
    // 计算起始页面的坐标
    const startSelected = calculateRectCoords(startPageViewInfo, rect);
    
    // 生成注释ID和内容
    const id = Lute.NewNodeID();
    const content = generateRectContent(pdf, startPageViewInfo, id);
    
    // 创建起始页面的注释坐标对象
    const startAnnoCoords = createAnnoCoords(
        startPageViewInfo,
        startSelected,
        id,
        color,
        content,
        type,
        "rect"
    );
    
    return {
        startPageViewInfo,
        startSelected,
        id,
        content,
        startAnnoCoords
    };
};

/**
 * 检查并处理结束页面
 * @param pdf PDF实例
 * @param rect 矩形边界
 * @param startPageInfo 起始页面信息
 * @param id 注释ID
 * @param content 注释内容
 * @param type 类型
 * @param color 颜色
 * @returns 结束页面数据
 */
export const checkAndProcessEndPage = (
    pdf: IPdfInstance,
    rect: DOMRect,
    startPageInfo: IPageInfo,
    id: string,
    content: string,
    type: string,
    color: string
): IEndPageData => {
    // 检查是否有结束页面
    const endPageElement = document.elementFromPoint(rect.right, rect.bottom + 1);
    if (endPageElement) {
        const foundElement = hasClosestByClassName(endPageElement, "page");
        if (foundElement) {
            const endIndex = parseInt(
                foundElement.getAttribute("data-page-number") || "0") - 1;
            
            // 如果结束页面与起始页面不同
            if (endIndex !== startPageInfo.index) {
                const endPageViewInfo = getPageViewInfo(pdf, endIndex);
                const endSelected = calculateRectCoords(endPageViewInfo, rect);
                
                // 创建结束页面的注释坐标对象
                const endAnnoCoords = createAnnoCoords(
                    endPageViewInfo,
                    endSelected,
                    id,
                    color,
                    content,
                    type,
                    "rect"
                );
                
                return {
                    endPageInfo: endPageViewInfo,
                    endAnnoCoords
                };
            }
        }
    }
    
    return {
        endPageInfo: null,
        endAnnoCoords: null
    };
};

/**
 * 构建矩形注释结果数据
 * @param startPageViewInfo 起始页面视图信息
 * @param startSelected 起始页面坐标
 * @param startAnnoCoords 起始页面注释坐标对象
 * @param endPageInfo 结束页面信息
 * @param endAnnoCoords 结束页面注释坐标对象
 * @returns 注释结果数据
 */
export const buildRectAnnotationResults = (
    startPageViewInfo: IPageInfo,
    startSelected: number[],
    startAnnoCoords: IAnnoCoords,
    endPageInfo: IPageInfo | null,
    endAnnoCoords: IAnnoCoords | null
): IAnnotationResults => {
    // 初始化页面数组和结果数组
    const pages: Array<{ index: number; positions: number[][] }> = [{
        index: startPageViewInfo.pageView.id - 1,
        positions: [startSelected],
    }];
    
    const result: IAnnoCoords[] = [startAnnoCoords];
    
    // 如果有结束页面，添加结束页面信息
    if (endPageInfo && endAnnoCoords && endAnnoCoords.coords[0]) {
        pages.push({
            index: endPageInfo.pageView.id - 1,
            positions: [endAnnoCoords.coords[0] as number[]],
        });
        
        result.push(endAnnoCoords);
    }
    
    return {
        pages,
        result
    };
};

/**
 * 保存矩形注释配置
 * @param pdf PDF实例
 * @param id 注释ID
 * @param pages 页面数组
 * @param content 注释内容
 * @param color 颜色
 * @param type 类型
 */
export const saveRectAnnotationConfig = (
    pdf: IPdfInstance,
    id: string,
    pages: Array<{ index: number; positions: number[][] }>,
    content: string,
    color: string,
    type: string
): void => {
    setConfig(pdf, id, {
        pages,
        content,
        color,
        type,
        mode: "rect",
    });
};

/**
 * 根据矩形获取高亮坐标
 * @param pdf PDF实例
 * @param color 颜色
 * @param rectResizeElement 矩形调整元素
 * @param type 类型
 * @returns 坐标信息数组
 */
export const getHightlightCoordsByRect = (
    pdf: IPdfInstance,
    color: string,
    rectResizeElement: HTMLElement,
    type: string
): IAnnoCoords[] | undefined => {
    // 1. 提取矩形页面信息
    const rectPageInfo = extractRectPageInfo(rectResizeElement);
    if (!rectPageInfo) {
        return;
    }
    
    // 2. 处理起始页面注释
    const startAnnotationData = processStartPageAnnotation(
        pdf,
        rectPageInfo.startPageInfo,
        rectPageInfo.rect,
        type,
        color
    );
    
    // 3. 检查并处理结束页面
    const endPageData = checkAndProcessEndPage(
        pdf,
        rectPageInfo.rect,
        rectPageInfo.startPageInfo,
        startAnnotationData.id,
        startAnnotationData.content,
        type,
        color
    );
    
    // 4. 构建注释结果
    const { pages, result } = buildRectAnnotationResults(
        startAnnotationData.startPageViewInfo,
        startAnnotationData.startSelected,
        startAnnotationData.startAnnoCoords,
        endPageData.endPageInfo,
        endPageData.endAnnoCoords
    );
    
    // 5. 保存配置
    saveRectAnnotationConfig(
        pdf,
        startAnnotationData.id,
        pages,
        startAnnotationData.content,
        color,
        type
    );
    
    return result;
};