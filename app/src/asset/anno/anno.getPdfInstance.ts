/** 用途：获取所有模型实例。使用范围：PDF 实例查找。解耦评估：通过 ./imports 转发。 */
import { getAllModels } from "./imports";

/** 获取 PDF 实例 */
export const getPdfInstance = async (element: HTMLElement) => {
    const asset = getAllModels().asset.find(item => {
        return item.pdfObject && element && item.element && typeof item.element.contains !== "undefined" && item.element.contains(element);
    });
    return asset?.pdfObject;
};
