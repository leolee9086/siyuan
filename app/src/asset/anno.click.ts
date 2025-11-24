import { Constants } from "../constants";
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig";
import { setStorageVal } from "../protyle/util/compatibility";
import { getHightlightCoordsByRange } from "./anno.getHightlightCoordsByRange";
import { showHighlight } from "./anno.showHighlight";
import { copyAnno } from "./anno.copy";
import { hideToolbar } from "./anno.hideToolbar";
import { getConfig } from "./anno.config";
import { fetchPost } from "../util/fetch";
import { showToolbar } from "./anno.showToolbar";
import { setRelation } from "./anno.setRelation";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { rectElement, setRectElement } from "./anno";
import { AnnoConstants } from "./anno.constants";
import type { IAnnoCoords, IPdfInstance } from "./anno.types";

const handleExternalEvent = (event: CustomEvent, element: HTMLElement, pdf: IPdfInstance) => {
    getSiyuanStorage()[Constants.LOCAL_PDFTHEME].annoColor = event.detail === "0" ?
        (getSiyuanStorage()[Constants.LOCAL_PDFTHEME].annoColor || "var(--b3-pdf-background1)")
        : `var(--b3-pdf-background${event.detail})`;
    setStorageVal(Constants.LOCAL_PDFTHEME, getSiyuanStorage()[Constants.LOCAL_PDFTHEME]);
    const coords = getHightlightCoordsByRange(pdf, getSiyuanStorage()[Constants.LOCAL_PDFTHEME].annoColor);
    if (coords) {
        coords.forEach((item: IAnnoCoords, index: number) => {
            const newElement = showHighlight(item, pdf);
            if (index === 0) {
                setRectElement(newElement);
                copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${newElement.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID)}`,
                    pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
            }
        });
    }
    hideToolbar(element);
};

const updateExistingAnnotation = (color: string, element: HTMLElement, pdf: IPdfInstance) => {
    const config = getConfig(pdf);
    const id = rectElement!.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID);
    if (id) {
        const annoItem = config[id];
        annoItem.color = color;
        element.querySelectorAll(`.${AnnoConstants.CSS.PDF_RECT}[${AnnoConstants.ATTR.DATA_NODE_ID}="${id}"]`).forEach(rectItem => {
            Array.from(rectItem.children).forEach((item) => {
                if (item instanceof HTMLElement) {
                    item.style.border = "2px solid " + color;
                    if (annoItem.type === "text") {
                        item.style.backgroundColor = color;
                    } else {
                        item.style.backgroundColor = "transparent";
                    }
                }
            });
        });
        fetchPost("/api/asset/setFileAnnotation", {
            path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
            data: JSON.stringify(config),
        });
    }
};

const createNewAnnotation = (color: string, pdf: IPdfInstance) => {
    const coords = getHightlightCoordsByRange(pdf, color);
    if (coords) {
        coords.forEach((item: IAnnoCoords, index: number) => {
            const newElement = showHighlight(item, pdf);
            if (index === 0) {
                setRectElement(newElement);
                copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${newElement.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID)}`,
                    pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
            }
        });
    }
};

const handleColorClick = (target: HTMLElement, element: HTMLElement, pdf: IPdfInstance) => {
    const color = target.style.backgroundColor;
    getSiyuanStorage()[Constants.LOCAL_PDFTHEME].annoColor = color;
    setStorageVal(Constants.LOCAL_PDFTHEME, getSiyuanStorage()[Constants.LOCAL_PDFTHEME]);

    if (rectElement) {
        updateExistingAnnotation(color, element, pdf);
    } else {
        createNewAnnotation(color, pdf);
    }
    hideToolbar(element);
};

const handleToolbarAction = (type: string, element: HTMLElement, pdf: IPdfInstance) => {
    const urlPath = pdf.appConfig.file.replace(location.origin, "").substr(1);
    const config = getConfig(pdf);
    const id = rectElement?.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID);

    switch (type) {
        case AnnoConstants.ACTION.REMOVE:
            if (id) {
                delete config[id];
                element.querySelectorAll(`[${AnnoConstants.ATTR.DATA_NODE_ID}="${id}"]`).forEach(item => {
                    item.remove();
                });
                fetchPost("/api/asset/setFileAnnotation", {
                    path: urlPath + ".sya",
                    data: JSON.stringify(config),
                });
            }
            hideToolbar(element);
            break;

        case AnnoConstants.ACTION.COPY:
            hideToolbar(element);
            if (id) {
                copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${id}`,
                    pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
            }
            break;

        case AnnoConstants.ACTION.RELATE:
            setRelation(pdf);
            hideToolbar(element);
            break;

        case AnnoConstants.ACTION.TOGGLE:
            if (id) {
                const annoItem = config[id];
                if (annoItem.type === "border") {
                    annoItem.type = "text";
                } else {
                    annoItem.type = "border";
                }
                element.querySelectorAll(`.${AnnoConstants.CSS.PDF_RECT}[${AnnoConstants.ATTR.DATA_NODE_ID}="${id}"]`).forEach(rectItem => {
                    Array.from(rectItem.children).forEach((item) => {
                        if (item instanceof HTMLElement) {
                            if (annoItem.type === "text") {
                                item.style.backgroundColor = item.style.border.replace("2px solid ", "");
                            } else {
                                item.style.backgroundColor = "";
                            }
                        }
                    });
                });
                fetchPost("/api/asset/setFileAnnotation", {
                    path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
                    data: JSON.stringify(config),
                });
            }
            hideToolbar(element);
            break;
    }
};

const handleSelection = (element: HTMLElement) => {
    setTimeout(() => {
        let isShow = false;
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (range.toString() !== "" &&
                hasClosestByClassName(range.commonAncestorContainer, AnnoConstants.CSS.PDF_VIEWER)) {
                showToolbar(element, range);
                isShow = true;
            }
        }
        if (!isShow) {
            hideToolbar(element);
        }
    });
};

export const initClickHandler = (element: HTMLElement, pdf: IPdfInstance) => {
    element.addEventListener("click", (event: MouseEvent | CustomEvent) => {
        // 处理自定义事件（例如来自快捷键或其他组件的事件）
        if (typeof (event as CustomEvent).detail === "string") {
            handleExternalEvent(event as CustomEvent, element, pdf);
            return;
        }

        const target = event.target as HTMLElement;
        if (!target) return;

        // 1. 处理颜色方块点击
        const colorSquare = target.closest(`.${AnnoConstants.CSS.COLOR_SQUARE}`) as HTMLElement;
        if (colorSquare) {
            handleColorClick(colorSquare, element, pdf);
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        // 2. 处理PDF矩形点击（显示工具栏）
        const pdfRect = target.closest(`.${AnnoConstants.CSS.PDF_RECT}`) as HTMLElement;
        if (pdfRect) {
            showToolbar(element, undefined as any, pdfRect);
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        // 3. 处理工具栏操作
        const actionBtn = target.closest(`[${AnnoConstants.ATTR.DATA_TYPE}]`) as HTMLElement;
        if (actionBtn) {
            // 确保我们在工具栏或相关容器内（如果需要），
            // 但原始代码只检查了属性。
            // 我们还应该检查它不是pdf__outer本身，但closest处理了这一点。
            const type = actionBtn.getAttribute(AnnoConstants.ATTR.DATA_TYPE);
            if (type) {
                handleToolbarAction(type, element, pdf);
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }

        // 4. 处理选择（默认行为检查）
        // 仅在我们没有匹配到特定交互元素时
        // 但是等等，原始代码有一个在`pdf__outer`处中断的`while`循环。
        // 如果我们在`pdf__outer`内部点击了上面未处理的其他内容，我们会继续执行。
        // 原始代码在循环中还检查了`!target.classList.contains("pdf__outer")`。
        // 这里`closest`在找不到时自然停止。

        // 然而，我们需要确保我们不处理PDF区域*外部*的点击（如果这是意图的话），
        // 但监听器附加到`element`（这可能是容器）。

        handleSelection(element);
    });
};
