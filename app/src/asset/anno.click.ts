import { Constants } from "../constants";
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setStorageVal } from "../protyle/util/compatibility";
import { getHightlightCoordsByRange } from "./anno.getHightlightCoordsByRange";
import { showHighlight } from "./anno.showHighlight";
import { copyAnno } from "./anno.copy";
import { hideToolbar } from "./anno.hideToolbar";
import { getConfig } from "./anno.config";
import { fetchPost } from "../util/fetch";
import { showToolbar } from "./anno.showToolbar";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { rectElement, setRectElement } from "./anno";
import { AnnoConstants } from "./anno.constants";
import type { IPdfInstance } from "./anno.types";
import { createToolbarActionContext, toolbarActionRegistry } from "./anno.click.handleToolbarAction";
import { externalEventClickHandler } from "./anno/click.handleExternalEvent";
import { getLocationOrigin, getWindowSelection } from "../util/siyuanEnvironments/windowStandard.environment";

const updateExistingAnnotation = (color: string, element: HTMLElement, pdf: IPdfInstance) => {
    const config = getConfig(pdf);
    const id = rectElement?.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID);
    if (id) {
        const annoItem = config[id];
        annoItem.color = color;
        const rectItems = element.querySelectorAll(`.${AnnoConstants.CSS.PDF_RECT}[${AnnoConstants.ATTR.DATA_NODE_ID}="${id}"]`);
        for (const rectItem of rectItems) {
            for (const item of Array.from(rectItem.children)) {
                if (item instanceof HTMLElement) {
                    item.style.border = "2px solid " + color;
                    item.style.backgroundColor = annoItem.type === "text" ? color : "transparent";
                }
            }
        }
        fetchPost("/api/asset/setFileAnnotation", {
            path: pdf.appConfig.file.replace(getLocationOrigin(), "").substr(1) + ".sya",
            data: JSON.stringify(config),
        });
    }
};

const createNewAnnotation = (color: string, pdf: IPdfInstance) => {
    const coords = getHightlightCoordsByRange(pdf, color);
    if (coords) {
        for (const [index, item] of coords.entries()) {
            const newElement = showHighlight(item, pdf);
            if (index === 0) {
                setRectElement(newElement);
                copyAnno(`${pdf.appConfig.file.replace(getLocationOrigin(), "").substr(1)}/${newElement.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID)}`,
                    pdf.appConfig.file.replace(getLocationOrigin(), "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
            }
        }
    }
};

const handleColorClick = (target: HTMLElement, element: HTMLElement, pdf: IPdfInstance) => {
    const color = target.style.backgroundColor;
    const pdfTheme = getSiyuanStorage()[Constants.LOCAL_PDFTHEME];
    pdfTheme.annoColor = color;
    setStorageVal(Constants.LOCAL_PDFTHEME, pdfTheme);

    if (rectElement) {
        updateExistingAnnotation(color, element, pdf);
        hideToolbar(element);
        return;
    }
    createNewAnnotation(color, pdf);
    hideToolbar(element);
};




const processSelection = (element: HTMLElement) => {
    const selection = getWindowSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (range && range.toString() !== "" &&
        hasClosestByClassName(range.commonAncestorContainer, AnnoConstants.CSS.PDF_VIEWER)) {
        showToolbar(element, range);
        return;
    }
    hideToolbar(element);
};

const handleSelection = (element: HTMLElement) => {
    setTimeout(() => processSelection(element));
};

const executeToolbarAction = (type: string, pdf: IPdfInstance, element: HTMLElement) => {
    const handler = toolbarActionRegistry[type];
    if (handler) {
        const context = createToolbarActionContext(pdf, element);
        handler(context);
    }
};

export const handlePdfClick = async (event: MouseEvent | CustomEvent, element: HTMLElement, pdf: IPdfInstance) => {
    // 处理自定义事件（例如来自快捷键或其他组件的事件）
    const controller = new AbortController();
    const signal = controller.signal;
    signal.addEventListener("abort", (reason) => {
        console.log("Abort signal received:", reason);
    });
    //处理自定义事件
    const ctx = { event, element, pdf };

    if (externalEventClickHandler.guard(ctx)) {
        await externalEventClickHandler.handler(ctx, controller);
    }
    if (signal.aborted) {
        return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    // 1. 处理颜色方块点击
    const colorSquare = target.closest(`.${AnnoConstants.CSS.COLOR_SQUARE}`);
    if (colorSquare instanceof HTMLElement) {
        handleColorClick(colorSquare, element, pdf);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 2. 处理PDF矩形点击（显示工具栏）
    const pdfRect = target.closest(`.${AnnoConstants.CSS.PDF_RECT}`);
    if (pdfRect instanceof HTMLElement) {
        showToolbar(element, undefined, pdfRect);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 3. 处理工具栏操作
    const actionBtn = target.closest(`[${AnnoConstants.ATTR.DATA_TYPE}]`);
    const type = actionBtn?.getAttribute(AnnoConstants.ATTR.DATA_TYPE);
    if (type) {
        // 确保我们在工具栏或相关容器内（如果需要），
        // 但原始代码只检查了属性。
        // 我们还应该检查它不是pdf__outer本身，但closest处理了这一点。
        executeToolbarAction(type, pdf, element);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 4. 处理选择（默认行为检查）
    // 仅在我们没有匹配到特定交互元素时
    // 但是等等，原始代码有一个在`pdf__outer`处中断的`while`循环。
    // 如果我们在`pdf__outer`内部点击了上面未处理的其他内容，我们会继续执行。
    // 原始代码在循环中还检查了`!target.classList.contains("pdf__outer")`。
    // 这里`closest`在找不到时自然停止。

    // 然而, 我们需要确保我们不处理PDF区域*外部*的点击（如果这是意图的话），
    // 但监听器附加到`element`（这可能是容器）。

    handleSelection(element);
};
