/** 用途：隐藏 PDF 工具栏。使用范围：矩形标注初始化。解耦评估：同目录模块。 */
import { hideToolbar } from "./anno.hideToolbar";
/** 用途：获取窗口选区。使用范围：矩形标注激活时清除选区。解耦评估：通过 ./imports 转发。 */
import { getWindowSelection } from "./imports";

/** 取消激活矩形标注模式 */
const deactivateRectAnnotation = (rectAnnoElement: HTMLElement, mainContainer: HTMLElement) => {
    rectAnnoElement.classList.remove("toggled");
    mainContainer.classList.remove("rect-to-annotation");
};

/** 激活矩形标注模式 */
const activateRectAnnotation = (pdf: Record<string, unknown>, rectAnnoElement: HTMLElement, mainContainer: HTMLElement, element: HTMLElement) => {
    pdf.pdfCursorTools.switchTool(0);
    rectAnnoElement.classList.add("toggled");
    mainContainer.classList.add("rect-to-annotation");
    const selection = getWindowSelection();
    // 清除当前选区以避免干扰矩形标注操作
    if (selection && selection.rangeCount > 0) {
        selection.getRangeAt(0).collapse(true);
    }
    hideToolbar(element);
};

/** 初始化矩形标注工具 */
export const initRectAnnoTool = async (element: HTMLElement, pdf: Record<string, unknown>) => {
    const pdfConfig = pdf.appConfig;
    const rectAnnoElement = pdfConfig.toolbar.rectAnno;
    rectAnnoElement.addEventListener("click", () => {
        handleRectAnnoClick(pdf, rectAnnoElement, pdfConfig.mainContainer, element);
    });
};

/** 处理矩形标注按钮点击 */
function handleRectAnnoClick(pdf: Record<string, unknown>, rectAnnoElement: HTMLElement, mainContainer: HTMLElement, element: HTMLElement) {
    // 已激活时取消激活，未激活时激活
    if (rectAnnoElement.classList.contains("toggled")) {
        deactivateRectAnnotation(rectAnnoElement, mainContainer);
        return;
    }
    activateRectAnnotation(pdf, rectAnnoElement, mainContainer, element);
}
