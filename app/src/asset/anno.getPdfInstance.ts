/// #if !MOBILE
import { getAllModels } from "../layout/getAll";
/// #endif
/**
 * 
 * @param element 
 * @returns 
 */
export const getPdfInstance = (element: HTMLElement) => {
    const asset = getAllModels().asset.find(item => {
        return item.pdfObject && element && item.element && typeof item.element.contains !== "undefined" && item.element.contains(element);
    });
    return asset?.pdfObject;
};
