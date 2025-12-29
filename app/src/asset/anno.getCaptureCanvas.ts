import type { IPdfInstance } from "./anno.types";
import { getPdfToCssUnits } from "../util/siyuanEnvironments/pdfjsLib.environment";

export const getCaptureCanvas = async (pdfObj: IPdfInstance, pageNumber: number) => {
    const pdfPage = await pdfObj.pdfDocument.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: 1.5 * pdfObj.pdfViewer.currentScale * getPdfToCssUnits() });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) {
        return canvas;
    }

    await pdfPage.render({
        canvasContext,
        viewport: viewport
    }).promise;

    return canvas;
};
