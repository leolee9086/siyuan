import {fetchPost} from "./imports";
import { Constants } from "../../constants";
import { writeText } from "../../protyle/util/compatibility";
import { rectElement } from "./state/selection";
import { getRectImgData } from "./anno.getRectImgData";
import { hasClosestByClassName } from "./imports";
import { getConfig } from "./config";
import { getRectImageName } from "../rectAnnotationResize";
import { PDF_RECT_CAPTURE_PROFILE } from "../pdfRectCapture";
import md5 from "blueimp-md5";
import type { IPdfInstance, 复制注释参数 } from "./anno.types";

/**
 * 处理复制注释的核心异步逻辑
 * 根据注释模式决定复制文本还是图片
 */
const 执行复制注释 = async (参数: 复制注释参数) => {
    const { idPath, fileName, pdf, mode, content } = 参数;

    const annotationElement = rectElement;
    if (!annotationElement || !content) {
        return;
    }

    const isRect = mode === "rect" ||
        (mode === "" && annotationElement.childElementCount === 1 && content.startsWith(fileName)); // 兼容历史，以前没有 mode

    if (!isRect) {
        writeText(`<<${idPath} "${content}">>`);
        return;
    }

    // 计算位置哈希用于图片名去重（对应上游 110df4e761）
    const pageElement = hasClosestByClassName(annotationElement, "page");
    const pageIndex = pageElement ? parseInt(pageElement.getAttribute("data-page-number") || "0") - 1 : -1;
    const cfg = getConfig(pdf);
    const annotationId = annotationElement.getAttribute("data-node-id") || "";
    const annotation = annotationId ? cfg[annotationId] : undefined;
    const positions = annotation?.pages.find(item => item.index === pageIndex)?.positions;
    const positionHash = positions ? md5(JSON.stringify(positions)).substring(0, 7) : "";

    const imageDataURL = await getRectImgData(pdf, annotationElement);
    if (!imageDataURL) {
        return;
    }
    const response = await fetch(imageDataURL);
    const blob = await response.blob();
    const formData = new FormData();
    // 使用本地扩展的 getRectImageName（含 captureProfile）保持本地行为，同时兼容上游位置哈希逻辑
    const imageName = getRectImageName(content, 0, positionHash, PDF_RECT_CAPTURE_PROFILE);
    formData.append("file[]", blob, imageName);
    formData.append("skipIfDuplicated", "true");
    fetchPost(Constants.UPLOAD_ADDRESS, formData, (uploadResponse) => {
        writeText(`<<${idPath} "${content}">>
![](${uploadResponse.data.succMap[imageName]})`);
    });
};

/**
 * 复制 PDF 注释
 * @param idPath - 注释 ID 路径
 * @param fileName - 文件名
 * @param pdf - PDF 实例
 */
export const copyAnno = async (idPath: string, fileName: string, pdf: IPdfInstance)=> {
    if (!rectElement) {
        return;
    }
    const mode = rectElement.getAttribute("data-mode");
    const content = rectElement.getAttribute("data-content");
    await new Promise<void>((resolve) => {
        // @setTimeout说明: 此延迟用于区分单击和双击事件，需要等待用户可能的第二次点击。延迟时间使用 Constants.TIMEOUT_DBLCLICK 常量（系统定义的双击判定时间阈值）
        setTimeout(async () => {
            await 执行复制注释({ idPath, fileName, pdf, mode, content });
            resolve();
        }, Constants.TIMEOUT_DBLCLICK);
    });
};
