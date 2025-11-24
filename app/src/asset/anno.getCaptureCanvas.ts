
export const getCaptureCanvas = async (pdfObj: any, pageNumber: number) => {
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
