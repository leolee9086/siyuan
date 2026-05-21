/**
 * showRender 模块 - 导出图片功能
 */
import { fetchPost } from "../../../util/network/fetch";
import { saveExportFile } from "../../util/compatibility";
import { hideMessage, showMessage } from "../../../dialog/message";
import { addScript } from "../../util/addScript";
import { Constants } from "../../../constants";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getHtmlToImage } from "../../../util/siyuanEnvironments/getHtmlToImage.environment";

/** 上传并打开导出的图片 */
function 上传导出文件(blob: Blob, mimeType: string, msgId: string): void {
    const formData = new FormData();
    formData.append("file", blob);
    formData.append("type", mimeType);
    fetchPost("/api/export/exportAsFile", formData, (response) => {
        saveExportFile(response.data.file);
        hideMessage(msgId);
    });
}

/** 导出 PlantUML 为 SVG */
function 导出PlantUML(renderElement: Element, msgId: string): void {
    const objectElement = renderElement.querySelector("object");
    if (!objectElement) {
        hideMessage(msgId);
        return;
    }

    const dataUrl = objectElement.getAttribute("data") ?? "";
    fetch(dataUrl)
        .then((response) => response.blob())
        .then((blob) => {
            上传导出文件(blob, "image/svg+xml", msgId);
        })
        .catch(() => {
            hideMessage(msgId);
        });
}

/** 导出为 PNG 图片 */
function 导出为PNG(renderElement: Element, msgId: string): void {
    // @内联回调
    setTimeout(() => {
        // @内联回调
        addScript("/stage/protyle/js/html-to-image.min.js?v=1.11.13", "protyleHtml2image").then(() => {
            if (!(renderElement instanceof HTMLElement)) {
                hideMessage(msgId);
                return;
            }
            renderElement.style.display = "inline-block";

            const htmlToImage = getHtmlToImage();
            if (!htmlToImage) {
                hideMessage(msgId);
                return;
            }

            htmlToImage.toBlob(renderElement).then((blob: Blob) => {
                renderElement.style.display = "";
                上传导出文件(blob, "image/png", msgId);
            });
        });
    }, Constants.TIMEOUT_LOAD);
}

/**
 * 导出渲染元素为图片
 */
export function 导出为图片(renderElement: Element): void {
    const result = showMessage(siyuanI18n.exporting, 0);
    const msgId = typeof result === "string" ? result : "";

    const 是PlantUML = renderElement.getAttribute("data-subtype") === "plantuml";
    if (是PlantUML) {
        导出PlantUML(renderElement, msgId);
        return;
    }

    导出为PNG(renderElement, msgId);
}
