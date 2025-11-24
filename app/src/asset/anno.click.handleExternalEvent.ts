import { Constants, setStorageVal } from "../ai/imports";
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig";
import { setRectElement } from "./anno";
import { AnnoConstants } from "./anno.constants";
import { copyAnno } from "./anno.copy";
import { getHightlightCoordsByRange } from "./anno.getHightlightCoordsByRange";
import { hideToolbar } from "./anno.hideToolbar";
import { showHighlight } from "./anno.showHighlight";
import { IAnnoCoords, IPdfInstance } from "./anno.types";

const handleExternalEvent = (event: Event, element: HTMLElement, pdf: IPdfInstance) => {
    getSiyuanStorage()[Constants.LOCAL_PDFTHEME].annoColor = (event as CustomEvent).detail === "0" ?
        (getSiyuanStorage()[Constants.LOCAL_PDFTHEME].annoColor || "var(--b3-pdf-background1)")
        : `var(--b3-pdf-background${(event as CustomEvent).detail})`;
    setStorageVal(Constants.LOCAL_PDFTHEME, getSiyuanStorage()[Constants.LOCAL_PDFTHEME]);
    const coords = getHightlightCoordsByRange(pdf, getSiyuanStorage()[Constants.LOCAL_PDFTHEME].annoColor);
    if (coords) {
        coords.forEach((item: IAnnoCoords, index: number) => {
            const newElement = showHighlight(item, pdf);
            if (index === 0) {
                setRectElement(newElement);
                copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${newElement.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID)}`,
                    pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
            }
        });
    }
    hideToolbar(element);
};
const isExternalEventGuard = (
    ctx: { event: Event, element: HTMLElement, pdf: IPdfInstance }
) => {
    return typeof (ctx.event as CustomEvent).detail === "string"
}
const externalEventProcessor =async (ctx: { event: Event, element: HTMLElement, pdf: IPdfInstance }, controller: AbortController) => {
    handleExternalEvent(ctx.event, ctx.element, ctx.pdf);
    controller.abort("Handled external event");
}
export const externalEventClickHandler = {
    guard: isExternalEventGuard,
    handler: externalEventProcessor,
}