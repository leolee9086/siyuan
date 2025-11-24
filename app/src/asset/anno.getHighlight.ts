import { getConfig } from "./anno.config";
import { getPdfInstance } from "./anno.getPdfInstance";
import { showHighlight } from "./anno.showHighlight";


export const getHighlight = (element: HTMLElement) => {
    const pdfInstance: any = getPdfInstance(element);
    if (!pdfInstance) {
        return;
    }
    const parentElement = element.parentElement;
    if (!parentElement) {
        return;
    }
    const pageNumberString = parentElement.getAttribute("data-page-number");
    if (!pageNumberString) {
        return;
    }
    const pageIndex = parseInt(pageNumberString) - 1;
    const config = getConfig(pdfInstance);
    Object.keys(config).find(key => {
        const item = config[key];
        const page = item.pages.find((page: { index: number; }) => {
            if (page.index === pageIndex) {
                return true;
            }
        });

        if (page) {
            showHighlight({
                index: pageIndex,
                coords: page.positions,
                id: key,
                color: item.color,
                content: item.content,
                type: item.type,
                mode: item.mode || "",
                ids: item.ids
            }, pdfInstance, pdfInstance.annoId === key);
        }
    });
};
