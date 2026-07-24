import { Constants } from "../../constants";
import { getHightlightCoordsByRect } from "./anno.getHightlightCoordsByRect";
import { showHighlight } from "./anno.showHighlight";
import { copyAnno } from "./anno.copy";
import { setRectElement } from "./state/selection";
import { getSafeSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { IAnnoCoords, IPdfInstance, IPdfConfig } from "./anno.types";

/** 计算选区矩形的样式 */
const 计算矩形样式 = (
    moveEvent: MouseEvent,
    起点X: number,
    起点Y: number,
    边界: { left: number; right: number; top: number; bottom: number }
) => {
    let newTop = 0;
    let newLeft = 0;
    let newWidth = 0;
    let newHeight = 0;

    if (moveEvent.clientX < 起点X) {
        newLeft = Math.max(moveEvent.clientX, 边界.left);
        newWidth = 起点X - newLeft;
        newTop = moveEvent.clientY > 起点Y ? 起点Y : Math.max(moveEvent.clientY, 边界.top);
        newHeight = moveEvent.clientY > 起点Y
            ? Math.min(moveEvent.clientY, 边界.bottom) - 起点Y
            : 起点Y - newTop;
        const bgColor = moveEvent.altKey ? "var(--b3-pdf-background1)" : "";
        return `top:${newTop}px;height:${newHeight}px;left:${newLeft}px;width:${newWidth}px;background-color:${bgColor}`;
    }

    newLeft = 起点X;
    newWidth = Math.min(moveEvent.clientX, 边界.right) - 起点X;

    if (moveEvent.clientY > 起点Y) {
        newTop = 起点Y;
        newHeight = Math.min(moveEvent.clientY, 边界.bottom) - 起点Y;
        const bgColor = moveEvent.altKey ? "var(--b3-pdf-background1)" : "";
        return `top:${newTop}px;height:${newHeight}px;left:${newLeft}px;width:${newWidth}px;background-color:${bgColor}`;
    }

    newTop = Math.max(moveEvent.clientY, 边界.top);
    newHeight = 起点Y - newTop;

    const bgColor = moveEvent.altKey ? "var(--b3-pdf-background1)" : "";
    return `top:${newTop}px;height:${newHeight}px;left:${newLeft}px;width:${newWidth}px;background-color:${bgColor}`;
};

/** 处理单个高亮标注 */
const 处理高亮项 = (item: IAnnoCoords, index: number, pdf: IPdfInstance) => {
    const newElement = showHighlight(item, pdf);
    if (index !== 0) {
        return;
    }
    setRectElement(newElement);
    const filePath = pdf.appConfig.file.replace(location.origin, "");
    copyAnno(
        `${filePath.substr(1)}/${newElement.getAttribute("data-node-id")}`,
        filePath.substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""),
        pdf
    );
};

/** 完成标注：清理事件、创建高亮 */
const 完成标注 = (
    pdf: IPdfInstance,
    pdfConfig: IPdfConfig,
    rectAnnoElement: Element,
    rectResizeElement: HTMLElement
) => {
    document.onmousemove = null;
    document.onmouseup = null;
    document.ondragstart = null;
    document.onselectstart = null;
    document.onselect = null;
    rectAnnoElement.classList.remove("toggled");
    pdfConfig.mainContainer.classList.remove("rect-to-annotation");

    const pdfTheme = getSafeSiyuanStorage()?.[Constants.LOCAL_PDFTHEME];
    const annoColor = pdfTheme?.annoColor || "var(--b3-pdf-background1)";
    const annoType = rectResizeElement.style.backgroundColor ? "text" : "border";
    const coords = getHightlightCoordsByRect(pdf, annoColor, rectResizeElement, annoType);
    rectResizeElement.classList.add("fn__none");

    if (!coords) {
        setRectElement(null);
        return;
    }

    for (let i = 0; i < coords.length; i++) {
        const coordItem = coords[i];
        if (!coordItem) {
            continue;
        }
        处理高亮项(coordItem, i, pdf);
    }
};

/** 获取画布边界和起点坐标 */
const 获取绘制边界 = (pdf: IPdfInstance, pdfConfig: IPdfConfig, event: MouseEvent) => {
    let canvasRect = pdf.pdfViewer._getVisiblePages().first.view.canvas.getBoundingClientRect();
    if (event.clientX > canvasRect.right) {
        canvasRect = pdf.pdfViewer._getVisiblePages().last.view.canvas.getBoundingClientRect();
    }
    const containerRect = pdfConfig.mainContainer.getBoundingClientRect();

    const 边界 = {
        left: canvasRect.left,
        right: canvasRect.right,
        top: containerRect.top,
        bottom: containerRect.bottom
    };

    let 起点X = event.clientX;
    if (event.clientX > 边界.right) {
        起点X = 边界.right;
    }
    if (event.clientX < 边界.left) {
        起点X = 边界.left;
    }

    return { 边界, 起点X, 起点Y: event.clientY };
};

/** 处理鼠标按下事件 */
const 处理鼠标按下事件 = (
    event: MouseEvent,
    pdf: IPdfInstance,
    pdfConfig: IPdfConfig,
    rectAnnoElement: Element,
    rectResizeElement: HTMLElement
) => {
    if (event.button === 2 || !rectAnnoElement.classList.contains("toggled")) {
        return; // 右键点击时不处理
    }

    const { 边界, 起点X, 起点Y } = 获取绘制边界(pdf, pdfConfig, event);

    document.onmousemove = (moveEvent) => {
        rectResizeElement.classList.remove("fn__none");
        rectResizeElement.setAttribute("style", 计算矩形样式(moveEvent, 起点X, 起点Y, 边界));
    };

    document.onmouseup = () => 完成标注(pdf, pdfConfig, rectAnnoElement, rectResizeElement);
};

export const initResizeHandler = (pdf: IPdfInstance) => {
    const pdfConfig = pdf.appConfig;
    const rectAnnoElement = pdfConfig.toolbar.rectAnno;
    const rectResizeElement = pdfConfig.mainContainer.lastElementChild;

    if (!(rectResizeElement instanceof HTMLElement)) {
        return;
    }

    pdfConfig.mainContainer.addEventListener("mousedown", (event: MouseEvent) =>
        处理鼠标按下事件(event, pdf, pdfConfig, rectAnnoElement, rectResizeElement)
    );
};
