import { Constants, setStorageVal } from "../../ai/imports";
import { getSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setRectElement } from "../anno";
import { AnnoConstants } from "../anno.constants";
import { copyAnno } from "../anno.copy";
import { getHightlightCoordsByRange } from "../anno.getHightlightCoordsByRange";
import { hideToolbar } from "../anno.hideToolbar";
import { showHighlight } from "../anno.showHighlight";
import { IPdfInstance } from "../anno.types";
import { isExternalEventContext, ICustomEventContext } from "./click.guard";

const handleExternalEvent = (event: CustomEvent<string>, element: HTMLElement, pdf: IPdfInstance) => {
    const pdfTheme = getSiyuanStorage()[Constants.LOCAL_PDFTHEME];
    const eventDetail = event.detail;
    pdfTheme.annoColor = eventDetail === "0" ?
        (pdfTheme.annoColor || "var(--b3-pdf-background1)")
        : `var(--b3-pdf-background${eventDetail})`;
    setStorageVal(Constants.LOCAL_PDFTHEME, pdfTheme);
    const coords = getHightlightCoordsByRange(pdf, pdfTheme.annoColor);
    if (coords) {
        let isFirst = true;
        for (const item of coords) {
            const newElement = showHighlight(item, pdf);
            if (isFirst) {
                isFirst = false;
                setRectElement(newElement);
                copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${newElement.getAttribute(AnnoConstants.ATTR.DATA_NODE_ID)}`,
                    pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
            }
        }
    }
    hideToolbar(element);
};

const externalEventProcessor = async (ctx: ICustomEventContext, controller: AbortController) => {
    handleExternalEvent(ctx.event, ctx.element, ctx.pdf);
    controller.abort("Handled external event");
};

export const externalEventClickHandler = {
    guard: isExternalEventContext,
    handler: externalEventProcessor,
};
