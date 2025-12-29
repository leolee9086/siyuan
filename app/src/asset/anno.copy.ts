import { fetchPost } from "../ai/imports";
import { Constants } from "../constants";
import { writeText } from "../protyle/util/compatibility";
import { rectElement } from "./anno";
import { getRectImgData } from "./anno.getRectImgData";
import type { IPdfInstance, 复制注释参数 } from "./anno.types";

/**
 * 处理复制注释的核心异步逻辑
 * 根据注释模式决定复制文本还是图片
 */
const 执行复制注释 = async (参数: 复制注释参数) => {
    const { idPath, fileName, pdf, mode, content } = 参数;

    if (!rectElement || !content) {
        return;
    }

    const isRect = mode === "rect" ||
        (mode === "" && rectElement.childElementCount === 1 && content.startsWith(fileName)); // 兼容历史，以前没有 mode

    if (!isRect) {
        writeText(`<<${idPath} "${content}">>`);
        return;
    }

    const imageDataURL = await getRectImgData(pdf);
    if (!imageDataURL) {
        return;
    }
    const response = await fetch(imageDataURL);
    const blob = await response.blob();
    const formData = new FormData();
    const imageName = content + ".png";
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
export const copyAnno = (idPath: string, fileName: string, pdf: IPdfInstance) => {
    if (!rectElement) {
        return;
    }
    const mode = rectElement.getAttribute("data-mode");
    const content = rectElement.getAttribute("data-content");

    setTimeout(() => {
        执行复制注释({ idPath, fileName, pdf, mode, content });
    }, Constants.TIMEOUT_DBLCLICK);
};
