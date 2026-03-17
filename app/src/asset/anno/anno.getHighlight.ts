import { getConfig } from "./config";
import { getPdfInstance } from "./anno.getPdfInstance";
import { showHighlight } from "./anno.showHighlight";
import type { IPdfInstance } from "./anno.types";


/**
 * 获取并显示 PDF 页面的高亮注释
 *
 * 作用：
 *   遍历当前 PDF 实例的所有已保存注释配置，找到属于当前页面的注释，
 *   然后调用 showHighlight 将其渲染到页面上。
 *
 * 意图：
 *   PDF 阅读器需要在文本层渲染完成后，将用户之前保存的高亮标注重新显示出来，
 *   以保证用户在翻页、缩放或刷新后仍能看到自己的注释。
 *
 * 调用时机：
 *   - 在 pdf/text_layer_builder.js 的 TextLayerBuilder.render() 方法中调用
 *   - 首次渲染文本层完成后调用，恢复该页的所有高亮
 *   - 文本层已存在时重新更新视图（如缩放）后也会调用
 *
 * @param element - PDF 文本层的 div 元素（.textLayer）
 */
export const getHighlight = (element: HTMLElement) => {
    const pdfInstance: IPdfInstance = getPdfInstance(element);
    if (!pdfInstance) {
        return;
    }
    const parentElement = element.parentElement;
    if (!parentElement) {
        return;
    }
    const pageNumberString = parentElement.getAttribute("data-page-number");
    if (!pageNumberString) {
        return;
    }
    const pageIndex = parseInt(pageNumberString) - 1;
    const config = getConfig(pdfInstance);
    for (const key of Object.keys(config)) {
        const item = config[key];
        if (!item) {
            continue;
        }
        const page = item.pages.find((page: { index: number; }) => page.index === pageIndex);

        if (page) {
            showHighlight({
                index: pageIndex,
                coords: page.positions,
                id: key,
                color: item.color,
                content: item.content,
                type: item.type,
                mode: item.mode || "",
                ids: item.ids
            }, pdfInstance, pdfInstance.annoId === key);
            break;
        }
    }
};
