import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { rectElement } from "./anno";
import { getCaptureCanvas } from "./anno.getCaptureCanvas";

function getPageInfo(element: HTMLElement): { pageNumber: number } | null {
    const pageElement = hasClosestByClassName(element, "page");
    if (!pageElement) {
        return null;
    }
    const pageNumberString = pageElement.getAttribute("data-page-number");
    if (!pageNumberString) {
        return null;
    }
    return { pageNumber: parseInt(pageNumberString) };
}

async function extractRectImageData(pdfObj: any, pageNumber: number, rectElement: HTMLElement): Promise<ImageData | null> {
    const captureCanvas = await getCaptureCanvas(pdfObj, pageNumber);
    const captureCanvasCtx = captureCanvas.getContext("2d");
    if (!captureCanvasCtx) {
        return null;
    }
    const rectStyle = (rectElement.firstElementChild as HTMLElement).style;
    const scale = 1.5;

    // 确保所有参数都是整数，避免 "Value is not of type 'long'" 错误
    const x = Math.round(scale * parseFloat(rectStyle.left || "0"));
    const y = Math.round(scale * parseFloat(rectStyle.top || "0"));
    const width = Math.round(scale * parseFloat(rectStyle.width || "0"));
    const height = Math.round(scale * parseFloat(rectStyle.height || "0"));

    // 确保宽度和高度至少为1像素
    const finalWidth = Math.max(1, width);
    const finalHeight = Math.max(1, height);

    // 确保坐标在画布范围内
    const canvasWidth = captureCanvas.width;
    const canvasHeight = captureCanvas.height;
    const clampedX = Math.max(0, Math.min(x, canvasWidth - 1));
    const clampedY = Math.max(0, Math.min(y, canvasHeight - 1));
    const clampedWidth = Math.min(finalWidth, canvasWidth - clampedX);
    const clampedHeight = Math.min(finalHeight, canvasHeight - clampedY);

    return captureCanvasCtx.getImageData(clampedX, clampedY, clampedWidth, clampedHeight);
}

function convertImageDataToDataUrl(imageData: ImageData): string {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const ctx = tempCanvas.getContext("2d");
    if (ctx) {
        ctx.putImageData(imageData, 0, 0);
    }
    return tempCanvas.toDataURL();
}

export async function getRectImgData(pdfObj: any) {
    if (!rectElement) {
        return;
    }
    const pageInfo = getPageInfo(rectElement);
    if (!pageInfo) {
        return;
    }
    const captureImageData = await extractRectImageData(pdfObj, pageInfo.pageNumber, rectElement);
    if (!captureImageData) {
        return;
    }

    return convertImageDataToDataUrl(captureImageData);
}
