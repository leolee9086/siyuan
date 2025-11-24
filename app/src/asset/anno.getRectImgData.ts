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
    return captureCanvasCtx.getImageData(
        scale * parseFloat(rectStyle.left),
        scale * parseFloat(rectStyle.top),
        scale * parseFloat(rectStyle.width),
        scale * parseFloat(rectStyle.height));
}

function convertImageDataToDataUrl(imageData: ImageData): string {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const ctx = tempCanvas.getContext("2d");
    ctx && ctx.putImageData(imageData, 0, 0);
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
