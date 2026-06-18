/** 用途：国际化文本。使用范围：htmlRender 设置无障碍标签。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "./imports";

/**
 * 为 HTML 块节点的工具栏按钮设置无障碍标签（aria-label）。
 *
 * 作用：遍历指定范围内的所有 NodeHTMLBlock 类型节点，为其工具栏中的
 *       「编辑」和「更多」按钮设置 aria-label 属性。
 *
 * 意图：HTML 块的工具栏按钮在初始渲染时不携带无障碍标签，需要在渲染阶段
 *       补充设置，以支持屏幕阅读器等辅助技术的正确识别。
 *
 * 调用时机：在 protyle 编辑器渲染或更新 HTML 块内容后调用。
 *           传入单个 NodeHTMLBlock 元素或包含多个 HTML 块的父容器均可。
 *
 * @param element - 目标 DOM 元素
 */
/** @同步豁免: 需要绝对同步的DOM访问 — 纯同步DOM属性操作，无异步工作可执行 */
export const htmlRender = (element: Element) => {
    // 当元素自身即为 NodeHTMLBlock 时直接作为目标，否则在子树中查找所有 HTML 块
    const htmlElements: Element[] = element.getAttribute("data-type") === "NodeHTMLBlock"
        ? (element.getAttribute("data-render") === "true" ? [] : [element])
        : Array.from(element.querySelectorAll('[data-type="NodeHTMLBlock"]:not([data-render="true"])'));

    // 无匹配的 HTML 块节点时直接返回，避免无意义遍历
    if (htmlElements.length === 0) {
        return;
    }

    for (const e of htmlElements) {
        e.setAttribute("data-render", "true");
        // 跳过内部结构不完整的节点，防止空引用
        const firstChild = e.firstElementChild;
        if (!firstChild) {
            continue;
        }
        firstChild.firstElementChild?.setAttribute("aria-label", siyuanI18n.edit);
        firstChild.lastElementChild?.setAttribute("aria-label", siyuanI18n.more);
    }
};
