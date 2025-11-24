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
import type { IAnnoCoords } from "./anno.types";

export const initClickHandler = (element: HTMLElement, pdf: any) => {
    element.addEventListener("click", (event) => {
        let processed = false;
        let target = event.target as HTMLElement | null;
        if (typeof event.detail === "string") {
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
                        copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${newElement.getAttribute("data-node-id")}`,
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
                    const id = rectElement.getAttribute("data-node-id");
                    if (id) {
                        const annoItem = config[id];
                        annoItem.color = color;
                        element.querySelectorAll(`.pdf__rect[data-node-id="${id}"]`).forEach(rectItem => {
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
                } else {
                    const coords = getHightlightCoordsByRange(pdf, color);
                    if (coords) {
                        coords.forEach((item: IAnnoCoords, index: number) => {
                            const newElement = showHighlight(item, pdf);
                            if (index === 0) {
                                setRectElement(newElement);
                                copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${newElement.getAttribute("data-node-id")}`,
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
                showToolbar(element, undefined as any, target);
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                break;
            } else if (type === "remove") {
                const urlPath = pdf.appConfig.file.replace(location.origin, "").substr(1);
                const config = getConfig(pdf);
                const id = rectElement?.getAttribute("data-node-id");
                if (id) {
                    delete config[id];
                    element.querySelectorAll(`[data-node-id="${id}"]`).forEach(item => {
                        item.remove();
                    });
                    fetchPost("/api/asset/setFileAnnotation", {
                        path: urlPath + ".sya",
                        data: JSON.stringify(config),
                    });
                }
                hideToolbar(element);
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                break;
            } else if (type === "copy") {
                hideToolbar(element);
                const id = rectElement?.getAttribute("data-node-id");
                if (id) {
                    copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${id}`,
                        pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
                }
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
                const refId = rectElement?.getAttribute("data-node-id");
                if (refId) {
                    const annoItem = config[refId];
                    if (annoItem.type === "border") {
                        annoItem.type = "text";
                    } else {
                        annoItem.type = "border";
                    }
                    element.querySelectorAll(`.pdf__rect[data-node-id="${refId}"]`).forEach(rectItem => {
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
            if (selection && selection.rangeCount > 0) {
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
};
