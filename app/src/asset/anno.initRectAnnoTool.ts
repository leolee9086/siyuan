import { hideToolbar } from "./anno.hideToolbar";

const deactivateRectAnnotation = (rectAnnoElement: HTMLElement, mainContainer: HTMLElement) => {
    rectAnnoElement.classList.remove("toggled");
    mainContainer.classList.remove("rect-to-annotation");
};

const activateRectAnnotation = (pdf: any, rectAnnoElement: HTMLElement, mainContainer: HTMLElement, element: HTMLElement) => {
    pdf.pdfCursorTools.switchTool(0);
    rectAnnoElement.classList.add("toggled");
    mainContainer.classList.add("rect-to-annotation");
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        selection.getRangeAt(0).collapse(true);
    }
    hideToolbar(element);
};

export const initRectAnnoTool = (element: HTMLElement, pdf: any) => {
    const pdfConfig = pdf.appConfig;
    const rectAnnoElement = pdfConfig.toolbar.rectAnno;
    rectAnnoElement.addEventListener("click", () => {
        if (rectAnnoElement.classList.contains("toggled")) {
            deactivateRectAnnotation(rectAnnoElement, pdfConfig.mainContainer);
        } else {
            activateRectAnnotation(pdf, rectAnnoElement, pdfConfig.mainContainer, element);
        }
    });
};
