import type { RectElementType } from "./anno.types";
import { getConfig } from "./anno.config";
import { initRectAnnoTool } from "./anno.initRectAnnoTool";
import { initResizeHandler } from "./anno.resize";
import { initClickHandler } from "./anno.click";

/**
 * 全局变量，存储当前选中的矩形注释元素
 * 用于跟踪和管理当前正在操作的注释元素
 */
export let rectElement: RectElementType;

/**
 * 清空当前选中的矩形注释元素
 * 在注释操作完成或取消时调用，重置全局状态
 */
export const clearRectElement = () => {
    rectElement = null;
}

/**
 * 设置当前选中的矩形注释元素
 * 在创建或选中注释时调用，更新全局状态
 * @param element 要设置的矩形注释元素
 */
export const setRectElement = (element: RectElementType) => {
    rectElement = element;
}

/**
 * 初始化PDF注释功能
 * 负责设置PDF文档的注释系统，包括工具初始化和事件处理
 * @param element PDF查看器的DOM容器元素
 * @param pdf PDF实例对象，包含PDF文档和查看器的相关信息
 * @returns 返回传入的PDF实例，便于链式调用
 */
export const initAnno = (element: HTMLElement, pdf: any) => {
    getConfig(pdf);
    initRectAnnoTool(element, pdf);
    initResizeHandler(pdf);
    initClickHandler(element, pdf);
    return pdf;
};

/**
 * 获取指定元素中的第一个或最后一个有效文本节点
 * 用于在PDF文本层中定位文本内容的边界，支持注释定位功能
 * @param element 要搜索的父元素，通常是PDF页面的文本层
 * @param isFirst 是否获取第一个文本节点，false表示获取最后一个
 * @returns 返回找到的包含文本内容的span元素，如果没有找到则返回undefined
 */
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


