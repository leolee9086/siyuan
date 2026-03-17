/**
 * 用途：获取 PDF 实例的注释配置数据
 * 使用范围：在 getHighlight 函数中用于遍历所有已保存的注释配置，查找当前页面的注释
 * 解耦评估：可通过依赖注入解耦，但会增加外部调用复杂度。当前作为 PDF 注释模块内部实现，直接导入是合理的架构选择
 */
import { getConfig } from "./config";
/**
 * 用途：从 DOM 元素获取关联的 PDF 实例对象
 * 使用范围：在 getHighlight 函数开始时用于获取 PDF 实例，是后续所有操作的前提
 * 解耦评估：可通过参数传递解耦，但会改变函数签名。当前设计允许从任意文本层元素恢复 PDF 实例，符合 PDF.js 的调用模式
 */
import { getPdfInstance } from "./anno.getPdfInstance";
/**
 * 用途：将注释数据渲染为可视化的高亮矩形
 * 使用范围：在找到匹配的注释配置后，调用此函数将其渲染到对应页面
 * 解耦评估：可通过依赖注入解耦，但会增加调用复杂度。作为注释渲染的核心功能，直接导入保持了代码的简洁性
 */
import { showHighlight } from "./anno.showHighlight";
/**
 * 用途：PDF 实例的 TypeScript 类型定义
 * 使用范围：用于 getPdfInstance 返回值的类型标注，提供类型安全
 * 解耦评估：类型导入不涉及运行时依赖，无需解耦
 */
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
export const getHighlight = async (element: HTMLElement) => {
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
