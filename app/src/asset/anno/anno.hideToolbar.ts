/** 用途：隐藏矩形缩放手柄。使用范围：PDF 工具栏隐藏时清理选中态。解耦评估：纯 DOM 操作，通过元素作用域局部化，无需解耦。 */
import { hideRectResizeHandles } from "../rectAnnotationResize";

/** 隐藏 PDF 工具栏 */
export const hideToolbar = async (element: HTMLElement) => {
    const toolbarElement = element.querySelector(".pdf__util");
    toolbarElement?.classList.add("fn__none");
    hideRectResizeHandles(element);
};
