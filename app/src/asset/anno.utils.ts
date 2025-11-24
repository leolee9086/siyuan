import { fetchPost } from "../util/fetch";
import { hasClosestByAttribute, hasClosestByClassName } from "../protyle/util/hasClosest";
import { writeText } from "../protyle/util/compatibility";
import { getAllModels } from "../layout/getAll";
import { Constants } from "../constants";
import type { IPdfInstance, RectElementType } from "./anno.types";



/**
 * 生成关系HTML
 * @param ids 关联ID列表
 * @returns 关系HTML字符串
 */
export const getRelationHTML = (ids: string[]): string => {
    if (!ids) {
        return `<li class="b3-list--empty">${window.siyuan?.languages?.emptyContent || ""}</li>`;
    }
    let html = "";
    ids.forEach((id: string) => {
        html += `<li data-id="${id}" class="popover__block b3-list-item b3-list-item--narrow b3-list-item--hide-action">
    <span class="b3-list-item__text">${id}</span>
    <span data-type="clear" class="b3-tooltips b3-tooltips__w b3-list-item__action" aria-label="${window.siyuan?.languages?.delete || ""}">
        <svg><use xlink:href="#iconTrashcan"></use></svg>
    </span>
</li>`;
    });
    return html;
};

/**
 * 获取文本节点
 * @param element 元素
 * @param isFirst 是否为第一个
 * @returns 文本节点
 */
export const getTextNode = (element: HTMLElement, isFirst: boolean): Element | null => {
    const spans = element.querySelectorAll('span[role="presentation"]');
    let index = isFirst ? 0 : spans.length - 1;
    while (index >= 0 && index < spans.length) {
        const span = spans[index] ;
        if (span && span.textContent) {
            return span;
        } else {
            if (isFirst) {
                index++;
            } else {
                index--;
            }
        }
    }
    return null;
};

/**
 * 获取PDF实例
 * @param element 元素
 * @returns PDF实例
 */
export const getPdfInstance = (element: HTMLElement): any => {
    let pdfInstance;
    getAllModels().asset.find(item => {
        if (item.pdfObject && element && item.element && typeof item.element.contains !== "undefined" && item.element.contains(element)) {
            pdfInstance = item.pdfObject;
            return true;
        }
    });
    return pdfInstance;
};

/**
 * 获取高亮
 * @param element 元素
 */
export const getHighlight = (element: HTMLElement): void => {
    const pdfInstance: any = getPdfInstance(element);
    if (!pdfInstance) {
        return;
    }
    
    if (!element.parentElement) {
        return;
    }
    
    const pageNumber = element.parentElement.getAttribute("data-page-number");
    if (!pageNumber) {
        return;
    }
    
    const pageIndex = parseInt(pageNumber) - 1;
    const config = getConfig(pdfInstance);
    Object.keys(config).find(key => {
        const item = config[key];
        const page = item.pages.find((page: { index: number }) => {
            if (page.index === pageIndex) {
                return true;
            }
        });

        if (page) {
            showHighlight({
                index: pageIndex,
                coords: page.positions,
                id: key,
                color: item.color,
                content: item.content,
                type: item.type,
                mode: item.mode || "",
                ids: item.ids || []
            }, pdfInstance, pdfInstance.annoId === key);
        }
    });
};

/**
 * 高亮PDF矩形
 * @param element 元素
 * @param id ID
 */
export const hlPDFRect = (element: HTMLElement, id: string): void => {
    element.querySelectorAll(`.pdf__rect[data-node-id="${id}"]`).forEach(item => {
        if (item && item.firstElementChild) {
            const scrollElement = hasClosestByAttribute(item, "id", "viewerContainer");
            if (scrollElement) {
                const currentRect = item.firstElementChild.getBoundingClientRect();
                const scrollRect = scrollElement.getBoundingClientRect();
                if (currentRect.top < scrollRect.top) {
                    scrollElement.scrollTop = scrollElement.scrollTop - (scrollRect.top - currentRect.top) -
                        (scrollRect.height - currentRect.height) / 2;
                } else if (currentRect.bottom > scrollRect.bottom) {
                    scrollElement.scrollTop = scrollElement.scrollTop + (currentRect.bottom - scrollRect.bottom) +
                        (scrollRect.height - currentRect.height) / 2;
                }
            }
            item.classList.add("pdf__rect--hl");
            setTimeout(() => {
                item.classList.remove("pdf__rect--hl");
            }, 1500);
        }
    });
};

/**
 * 复制注释
 * @param idPath ID路径
 * @param fileName 文件名
 * @param pdf PDF实例
 * @param rectElement 矩形元素
 */
export const copyAnno = (idPath: string, fileName: string, pdf: any, rectElement: RectElementType): void => {
    if (!rectElement) {
        return;
    }
    
    const mode = rectElement.getAttribute("data-mode") || "";
    const content = rectElement.getAttribute("data-content") || "";
    setTimeout(() => {
        if (mode === "rect" ||
            (mode === "" && rectElement.childElementCount === 1 && content.startsWith(fileName)) // 兼容历史，以前没有 mode
        ) {
            getRectImgData(pdf, rectElement).then((imageDataURL: string) => {
                fetch(imageDataURL).then((response) => {
                    return response.blob();
                }).then((blob) => {
                    const formData = new FormData();
                    const imageName = content + ".png";
                    formData.append("file[]", blob, imageName);
                    formData.append("skipIfDuplicated", "true");
                    fetchPost(Constants.UPLOAD_ADDRESS, formData, (response) => {
                        writeText(`<<${idPath} "${content}">>
![](${response.data.succMap[imageName]})`);
                    });
                });
            });
        } else {
            writeText(`<<${idPath} "${content}">>`);
        }
    }, Constants.TIMEOUT_DBLCLICK);
};

/**
 * 获取捕获画布
 * @param pdfObj PDF对象
 * @param pageNumber 页码
 * @returns 画布
 */
export const getCaptureCanvas = async (pdfObj: any, pageNumber: number): Promise<HTMLCanvasElement> => {
    const pdfPage = await pdfObj.pdfDocument.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: 1.5 * pdfObj.pdfViewer.currentScale * window.pdfjsLib.PixelsPerInch.PDF_TO_CSS_UNITS });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await pdfPage.render({
        canvasContext: canvas.getContext("2d"),
        viewport: viewport
    }).promise;

    return canvas;
};

/**
 * 获取矩形图像数据
 * @param pdfObj PDF对象
 * @param rectElement 矩形元素
 * @returns 图像数据URL
 */
export const getRectImgData = async (pdfObj: any, rectElement: RectElementType): Promise<string> => {
    if (!rectElement) {
        return "";
    }
    
    const pageElement = hasClosestByClassName(rectElement, "page");
    if (!pageElement) {
        return "";
    }

    const pageNumber = pageElement.getAttribute("data-page-number");
    if (!pageNumber) {
        return "";
    }

    const captureCanvas = await getCaptureCanvas(pdfObj, parseInt(pageNumber));

    if (!rectElement.firstElementChild) {
        return "";
    }
    
    const rectStyle = (rectElement.firstElementChild as HTMLElement).style;
    const scale = 1.5;
    const context = captureCanvas.getContext("2d");
    if (!context) {
        return "";
    }
    
    const captureImageData = context.getImageData(
        scale * parseFloat(rectStyle.left || "0"),
        scale * parseFloat(rectStyle.top || "0"),
        scale * parseFloat(rectStyle.width || "0"),
        scale * parseFloat(rectStyle.height || "0"));

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = captureImageData.width;
    tempCanvas.height = captureImageData.height;
    const ctx = tempCanvas.getContext("2d");
    ctx && ctx.putImageData(captureImageData, 0, 0);
    return tempCanvas.toDataURL();
};

/**
 * 获取配置
 * @param pdf PDF实例
 * @returns 配置对象
 */
export const getConfig = (pdf: IPdfInstance): Record<string, any> => {
    if (pdf.appConfig.config) {
        return pdf.appConfig.config;
    }
    const urlPath = pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya";
    fetchPost("/api/asset/getFileAnnotation", {
        path: urlPath,
    }, (response) => {
        let config = {};
        if (response.code !== 1) {
            config = JSON.parse(response.data.data);
        }
        pdf.appConfig.config = config;
    });
    return pdf.appConfig.config || {};
};

/**
 * 显示高亮
 * @param selected 选中的坐标信息
 * @param pdf PDF实例
 * @param hl 是否高亮
 * @returns 矩形元素
 */
export const showHighlight = (selected: any, pdf: IPdfInstance, hl?: boolean): HTMLElement | null => {
    const pageIndex = selected.index;
    const page = pdf.pdfViewer.getPageView(pageIndex);
    const textLayerElement = page.textLayer.div;
    if (!textLayerElement.lastElementChild) {
        return null;
    }

    const viewport = page.viewport.clone({ rotation: 0 }); // rotation https://github.com/siyuan-note/siyuan/issues/9831
    let rectsElement = textLayerElement.querySelector(".pdf__rects");
    if (!rectsElement) {
        textLayerElement.insertAdjacentHTML("beforeend", "<div class='pdf__rects'></div>");
        rectsElement = textLayerElement.querySelector(".pdf__rects");
    }
    let html = `<div class="pdf__rect popover__block" data-node-id="${selected.id}" data-relations="${selected.ids || ""}" data-mode="${selected.mode}">`;
    selected.coords.forEach((rect: number[]) => {
        const bounds = viewport.convertToViewportRectangle(rect);
        const width = Math.abs(bounds[0] - bounds[2]);
        if (width <= 0) {
            return;
        }
        let style = `border: 2px solid ${selected.color};background-color: ${selected.color};`;
        if (selected.type === "border") {
            style = `border: 2px solid ${selected.color};`;
        }
        html += `<div style="${style}
left:${Math.min(bounds[0], bounds[2])}px;
top:${Math.min(bounds[1], bounds[3])}px;
width:${width}px;
height: ${Math.abs(bounds[1] - bounds[3])}px"></div>`;
    });
    rectsElement.insertAdjacentHTML("beforeend", html + "</div>");
    if (rectsElement.lastElementChild) {
        rectsElement.lastElementChild.setAttribute("data-content", selected.content);
        if (hl) {
            hlPDFRect(rectsElement, selected.id);
        }
        return rectsElement.lastElementChild;
    }
    return null;
};