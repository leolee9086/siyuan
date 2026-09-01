/** 用途：定位 PDF viewer 滚动容器。使用范围：标注高亮后的可视区修正。解耦评估：通过 ./imports 转发，避免本 owner 直接跨域依赖 Protyle DOM helper。 */
import {hasClosestByAttribute} from "./imports";
/** 用途：按字面属性值查找标注。使用范围：高亮时避免将 .sya ID 插入 CSS selector。解耦评估：同目录 guard 统一注释 DOM 查找。 */
import {getRectElementsByNodeId} from "./anno.guard";


/** @同步豁免: UI构建 */
/**
 * 作用：视觉高亮并滚动指定 PDF 标注矩形至可见区域。
 * 意图：从引用或外部导航进入 PDF 时，使用户定位到对应的持久化标注。
 * 调用时机：showHighlight 按 annoId 请求闪烁反馈，以及标注导航完成后。
 * 问题/改进：1500ms 延迟是用户可见的高亮反馈时长，超时后只移除视觉 class。
 */
export const hlPDFRect = (element: HTMLElement, id: string) => {
    const rectElements = getRectElementsByNodeId(element, id);
    for (const item of rectElements) {
        if (!item || !item.firstElementChild) {
            continue;
        }
        item.classList.add("pdf__rect--hl");
        // 1500ms 与 PDF 标注动画的用户可见反馈时长匹配，不能用生命周期事件替代。
        setTimeout(() => {
            item.classList.remove("pdf__rect--hl");
        }, 1500);

        const scrollElement = hasClosestByAttribute(item, "id", "viewerContainer");
        if (!scrollElement) {
            continue;
        }
        const currentRect = item.firstElementChild.getBoundingClientRect();
        const scrollRect = scrollElement.getBoundingClientRect();
        // 标注完全位于可视区上方时，向上调整滚动位置使其居中。
        if (currentRect.top < scrollRect.top) {
            scrollElement.scrollTop = scrollElement.scrollTop - (scrollRect.top - currentRect.top) -
                (scrollRect.height - currentRect.height) / 2;
            continue;
        }
        // 标注完全位于可视区下方时，向下调整滚动位置使其居中。
        if (currentRect.bottom > scrollRect.bottom) {
            scrollElement.scrollTop = scrollElement.scrollTop + (currentRect.bottom - scrollRect.bottom) +
                (scrollRect.height - currentRect.height) / 2;
        }
    }
};
