import { getAllModels } from "../layout/getAll";


export const getPdfInstance = (element: HTMLElement) => {
    let pdfInstance;
    getAllModels().asset.find(item => {
        if (item.pdfObject && element && item.element && typeof item.element.contains !== "undefined" && item.element.contains(element)) {
            pdfInstance = item.pdfObject;
            return true;
        }
    });
    return pdfInstance;
};
