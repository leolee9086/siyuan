import { fetchPost } from "../util/fetch";
import { setPosition } from "../util/setPosition";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { setStorageVal } from "../protyle/util/compatibility";
import { Constants } from "../constants";
import type { IPdfAnno, IRectBounds, IPagePosition, RectElementType } from "./anno.types";
import { getConfig } from "./anno.config";
import { get } from "http";
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig";
import { copyAnno } from "./anno.copy";
import { initRectAnnoTool } from "./anno.initRectAnnoTool";
import { hideToolbar } from "./anno.hideToolbar";
import { showHighlight } from "./anno.showHighlight";
import { getHightlightCoordsByRect } from "./anno.getHightlightCoordsByRect";
import { getHightlightCoordsByRange } from "./anno.getHightlightCoordsByRange";
import { setRelation } from "./anno.setRelation";
export let rectElement: RectElementType;

export const initAnno = (element: HTMLElement, pdf: any) => {
    getConfig(pdf);
    const pdfConfig = pdf.appConfig;
    const rectAnnoElement = pdfConfig.toolbar.rectAnno;

    initRectAnnoTool(element, pdf);

    const rectResizeElement = pdfConfig.mainContainer.lastElementChild;
    pdfConfig.mainContainer.addEventListener("mousedown", (event: MouseEvent) => {
        if (event.button === 2 || !rectAnnoElement.classList.contains("toggled")) {
            // 右键
            return;
        }
        let canvasRect = pdf.pdfViewer._getVisiblePages().first.view.canvas.getBoundingClientRect();
        if (event.clientX > canvasRect.right) {
            canvasRect = pdf.pdfViewer._getVisiblePages().last.view.canvas.getBoundingClientRect();
        }
        const containerRet = pdfConfig.mainContainer.getBoundingClientRect();
        const mostLeft = canvasRect.left;
        const mostRight = canvasRect.right;
        const mostBottom = containerRet.bottom;
        let x = event.clientX;
        if (event.clientX > mostRight) {
            x = mostRight;
        } else if (event.clientX < mostLeft) {
            x = mostLeft;
        }
        const mostTop = containerRet.top;
        const y = event.clientY;
        const documentSelf = document;
        documentSelf.onmousemove = (moveEvent) => {
            rectResizeElement.classList.remove("fn__none");
            let newTop = 0;
            let newLeft = 0;
            let newWidth = 0;
            let newHeight = 0;
            if (moveEvent.clientX < x) {
                if (moveEvent.clientX < mostLeft) {
                    // 向左越界
                    newLeft = mostLeft;
                } else {
                    // 向左
                    newLeft = moveEvent.clientX;
                }
                newWidth = x - newLeft;
            } else {
                if (moveEvent.clientX > mostRight) {
                    // 向右越界
                    newLeft = x;
                    newWidth = mostRight - newLeft;
                } else {
                    // 向右
                    newLeft = x;
                    newWidth = moveEvent.clientX - x;
                }
            }

            if (moveEvent.clientY > y) {
                if (moveEvent.clientY > mostBottom) {
                    // 向下越界
                    newTop = y;
                    newHeight = mostBottom - y;
                } else {
                    // 向下
                    newTop = y;
                    newHeight = moveEvent.clientY - y;
                }
            } else {
                if (moveEvent.clientY < mostTop) {
                    // 向上越界
                    newTop = mostTop;
                } else {
                    // 向上
                    newTop = moveEvent.clientY;
                }
                newHeight = y - newTop;
            }
            rectResizeElement.setAttribute("style",
                `top:${newTop}px;height:${newHeight}px;left:${newLeft}px;width:${newWidth}px;background-color:${moveEvent.altKey ? "var(--b3-pdf-background1)" : ""}`);
        };
        documentSelf.onmouseup = () => {
            documentSelf.onmousemove = null;
            documentSelf.onmouseup = null;
            documentSelf.ondragstart = null;
            documentSelf.onselectstart = null;
            documentSelf.onselect = null;
            rectAnnoElement.classList.remove("toggled");
            pdfConfig.mainContainer.classList.remove("rect-to-annotation");

            const coords = getHightlightCoordsByRect(pdf, window.siyuan.storage[Constants.LOCAL_PDFTHEME].annoColor || "var(--b3-pdf-background1)", rectResizeElement,
                rectResizeElement.style.backgroundColor ? "text" : "border");
            rectResizeElement.classList.add("fn__none");
            if (coords) {
                coords.forEach((item, index) => {
                    const newElement = showHighlight(item, pdf);
                    if (index === 0) {
                        rectElement = newElement;
                        copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${rectElement.getAttribute("data-node-id")}`,
                            pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
                    }
                });
            } else {
                rectElement = null;
            }
        };
    });

    element.addEventListener("click", (event) => {
        let processed = false;
        let target = event.target as HTMLElement;
        if (typeof event.detail === "string") {
            getSiyuanStorage()[Constants.LOCAL_PDFTHEME].annoColor = event.detail === "0" ?
                (getSiyuanStorage()[Constants.LOCAL_PDFTHEME].annoColor || "var(--b3-pdf-background1)")
                : `var(--b3-pdf-background${event.detail})`;
            setStorageVal(Constants.LOCAL_PDFTHEME, getSiyuanStorage()[Constants.LOCAL_PDFTHEME]);
            const coords = getHightlightCoordsByRange(pdf, getSiyuanStorage()[Constants.LOCAL_PDFTHEME].annoColor);
            if (coords) {
                coords.forEach((item, index) => {
                    const newElement = showHighlight(item, pdf);
                    if (index === 0) {
                        rectElement = newElement;
                        copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${rectElement.getAttribute("data-node-id")}`,
                            pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
                    }
                });
            }
            hideToolbar(element);
            return;
        }
        while (target && !target.classList.contains("pdf__outer")) {
            const type = target.getAttribute("data-type");
            if (target.classList.contains("color__square")) {
                const color = target.style.backgroundColor;
                getSiyuanStorage()[Constants.LOCAL_PDFTHEME].annoColor = color;
                setStorageVal(Constants.LOCAL_PDFTHEME, getSiyuanStorage()[Constants.LOCAL_PDFTHEME]);
                if (rectElement) {
                    const config = getConfig(pdf);
                    const annoItem = config[rectElement.getAttribute("data-node-id")];
                    annoItem.color = color;
                    element.querySelectorAll(`.pdf__rect[data-node-id="${rectElement.getAttribute("data-node-id")}"]`).forEach(rectItem => {
                        Array.from(rectItem.children).forEach((item: HTMLElement) => {
                            item.style.border = "2px solid " + color;
                            if (annoItem.type === "text") {
                                item.style.backgroundColor = color;
                            } else {
                                item.style.backgroundColor = "transparent";
                            }
                        });
                    });
                    fetchPost("/api/asset/setFileAnnotation", {
                        path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
                        data: JSON.stringify(config),
                    });
                } else {
                    const coords = getHightlightCoordsByRange(pdf, color);
                    if (coords) {
                        coords.forEach((item, index) => {
                            const newElement = showHighlight(item, pdf);
                            if (index === 0) {
                                rectElement = newElement;
                                copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${rectElement.getAttribute("data-node-id")}`,
                                    pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
                            }
                        });
                    }
                }
                hideToolbar(element);
                processed = true;
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.classList.contains("pdf__rect")) {
                showToolbar(element, undefined, target);
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                break;
            } else if (type === "remove") {
                const urlPath = pdf.appConfig.file.replace(location.origin, "").substr(1);
                const config = getConfig(pdf);
                const id = rectElement.getAttribute("data-node-id");
                delete config[id];
                element.querySelectorAll(`[data-node-id="${id}"]`).forEach(item => {
                    item.remove();
                });
                fetchPost("/api/asset/setFileAnnotation", {
                    path: urlPath + ".sya",
                    data: JSON.stringify(config),
                });
                hideToolbar(element);
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                break;
            } else if (type === "copy") {
                hideToolbar(element);
                copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${rectElement.getAttribute("data-node-id")}`,
                    pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                break;
            } else if (type === "relate") {
                setRelation(pdf);
                hideToolbar(element);
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                break;
            } else if (type === "toggle") {
                const config = getConfig(pdf);
                const annoItem = config[rectElement.getAttribute("data-node-id")];
                if (annoItem.type === "border") {
                    annoItem.type = "text";
                } else {
                    annoItem.type = "border";
                }
                element.querySelectorAll(`.pdf__rect[data-node-id="${rectElement.getAttribute("data-node-id")}"]`).forEach(rectItem => {
                    Array.from(rectItem.children).forEach((item: HTMLElement) => {
                        if (annoItem.type === "text") {
                            item.style.backgroundColor = item.style.border.replace("2px solid ", "");
                        } else {
                            item.style.backgroundColor = "";
                        }
                    });
                });
                fetchPost("/api/asset/setFileAnnotation", {
                    path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
                    data: JSON.stringify(config),
                });
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                hideToolbar(element);
                break;
            }
            target = target.parentElement;
        }

        if (processed) {
            return;
        }

        setTimeout(() => {
            let isShow = false;
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (range.toString() !== "" &&
                    hasClosestByClassName(range.commonAncestorContainer, "pdfViewer")) {
                    showToolbar(element, range);
                    isShow = true;
                }
            }
            if (!isShow) {
                hideToolbar(element);
            }
        });
    });
    return pdf;
};

const showToolbar = (element: HTMLElement, range: Range, target?: HTMLElement) => {
    if (target) {
        // 阻止 popover
        target.setAttribute("prevent-popover", "true");
        setTimeout(() => {
            target.removeAttribute("prevent-popover");
        }, 620);
    }

    const utilElement = element.querySelector(".pdf__util") as HTMLElement;
    utilElement.classList.remove("fn__none");

    if (range) {
        utilElement.classList.add("pdf__util--hide");
        const rects = range.getClientRects();
        const rect = rects[rects.length - 1];
        setPosition(utilElement, rect.left, rect.bottom);
        rectElement = null;
        return;
    }
    rectElement = target;
    utilElement.classList.remove("pdf__util--hide");
    const targetRect = target.firstElementChild.getBoundingClientRect();
    setPosition(utilElement, targetRect.left, targetRect.top + targetRect.height + 4);
};

export const getTextNode = (element: HTMLElement, isFirst: boolean) => {
    const spans = element.querySelectorAll('span[role="presentation"]');
    let index = isFirst ? 0 : spans.length - 1;
    while (spans[index]) {
        if (spans[index].textContent) {
            break;
        } else {
            if (isFirst) {
                index++;
            } else {
                index--;
            }
        }
    }
    return spans[index];
};


