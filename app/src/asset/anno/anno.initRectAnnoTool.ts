/** 用途：隐藏 PDF 工具栏。使用范围：矩形标注初始化。解耦评估：同目录模块。 */
import { hideToolbar } from "./anno.hideToolbar";
/** 用途：获取窗口选区。使用范围：矩形标注激活时清除选区。解耦评估：通过 ./imports 转发。 */
import { getWindowSelection } from "./imports";
/** 用途：PDF 实例类型。使用范围：矩形标注工具参数类型。解耦评估：纯类型，无耦合。 */
import type { IPdfInstance } from "./anno.types";

/** 取消激活矩形标注模式 */
const deactivateRectAnnotation = (rectAnnoElement: HTMLElement, mainContainer: HTMLElement) => {
    rectAnnoElement.classList.remove("toggled");
    mainContainer.classList.remove("rect-to-annotation");
};

/**
 * 矩形标注上下文类型
 * @用途 封装激活/点击流程所需的 PDF 实例与容器元素
 * @使用场景 在 activateRectAnnotation 与 handleRectAnnoClick 间传递，避免超过 3 参限制
 * @关联类型 IPdfInstance
 */
type RectAnnoCtx = { pdf: IPdfInstance; rectAnnoElement: HTMLElement; mainContainer: HTMLElement; element: HTMLElement };

/** 激活矩形标注模式 */
const activateRectAnnotation = (ctx: RectAnnoCtx) => {
    const { pdf, rectAnnoElement, mainContainer, element } = ctx;
    pdf.pdfCursorTools.switchTool(0);
    rectAnnoElement.classList.add("toggled");
    mainContainer.classList.add("rect-to-annotation");
    const selection = getWindowSelection();
    // 生效场景：存在选区时折叠选区，避免矩形标注与文本选区冲突
    if (selection && selection.rangeCount > 0) {
        selection.getRangeAt(0).collapse(true);
    }
    hideToolbar(element);
};

/** 初始化矩形标注工具 */
export const initRectAnnoTool = async (element: HTMLElement, pdf: IPdfInstance) => {
    const pdfConfig = pdf.appConfig;
    const rectAnnoElement = pdfConfig.toolbar.rectAnno;
    rectAnnoElement.addEventListener("click", () => {
        handleRectAnnoClick({ pdf, rectAnnoElement, mainContainer: pdfConfig.mainContainer, element });
    });
};

/** 处理矩形标注按钮点击 */
function handleRectAnnoClick(ctx: RectAnnoCtx) {
    const { rectAnnoElement, mainContainer } = ctx;
    // 生效场景：已处于矩形标注模式时再次点击则退出该模式
    if (rectAnnoElement.classList.contains("toggled")) {
        deactivateRectAnnotation(rectAnnoElement, mainContainer);
        return;
    }
    activateRectAnnotation(ctx);
}
