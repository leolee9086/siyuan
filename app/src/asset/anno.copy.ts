import { fetchPost } from "../ai/imports";
import { Constants } from "../constants";
import { writeText } from "../protyle/util/compatibility";
import { rectElement } from "./anno";
import { getRectImgData } from "./anno.getRectImgData";

export const copyAnno = (idPath: string, fileName: string, pdf: any) => {
    if (!rectElement) {
        return;
    }
    const mode = rectElement.getAttribute("data-mode");
    const content = rectElement.getAttribute("data-content");
    setTimeout(async () => {
        if (!rectElement || !content) {
            return;
        }
        if (mode === "rect" ||
            (mode === "" && rectElement.childElementCount === 1 && content.startsWith(fileName)) // 兼容历史，以前没有 mode
        ) {
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
            fetchPost(Constants.UPLOAD_ADDRESS, formData, (response) => {
                writeText(`<<${idPath} "${content}">>
![](${response.data.succMap[imageName]})`);
            });

        } else {
            writeText(`<<${idPath} "${content}">>`);
        }
    }, Constants.TIMEOUT_DBLCLICK);
};
