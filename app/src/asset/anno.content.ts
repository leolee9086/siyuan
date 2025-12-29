import type { IPdfInstance } from "./anno.types";
import type { IPageInfo } from "./anno.page.types";
import type { IAnnoCoords } from "./anno.types";

/**
 * 生成矩形注释的内容
 * @param pdf PDF实例
 * @param pageInfo 页面信息
 * @param id 注释ID
 * @returns 注释内容
 */
export const generateRectContent = (pdf: IPdfInstance, pageInfo: IPageInfo, id: string): string => {
    return `${pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, "")}-P${pageInfo.index + 1}-${id}`;
};

/**
 * 创建注释坐标对象
 * @param pageInfo 页面信息
 * @param coords 坐标数组
 * @param id 注释ID
 * @param color 颜色
 * @param content 内容
 * @param type 类型
 * @param mode 模式
 * @returns 注释坐标对象
 */
export const createAnnoCoords = (
    pageInfo: IPageInfo,
    coords: number[],
    id: string,
    color: string,
    content: string,
    type: string,
    mode: string
): IAnnoCoords => {
    return {
        index: pageInfo.index,
        coords: [coords],
        id,
        color,
        content,
        type,
        mode,
    };
};