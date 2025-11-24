import { fetchPost } from "../util/fetch";
import type { IPdfInstance } from "./anno.types";

/**
 * 设置配置
 * @param pdf PDF实例
 * @param id ID
 * @param data 数据
 */
export const setConfig = (pdf: IPdfInstance, id: string, data: any): void => {
    const config = getConfig(pdf);
    config[id] = data;
    fetchPost("/api/asset/setFileAnnotation", {
        path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
        data: JSON.stringify(config),
    });
};

/**
 * 获取配置
 * @param pdf PDF实例
 * @returns 配置对象
 */
export const getConfig = (pdf: IPdfInstance): Record<string, any> => {
    if (pdf.appConfig.config) {
        return pdf.appConfig.config;
    }
    const urlPath = pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya";
    fetchPost("/api/asset/getFileAnnotation", {
        path: urlPath,
    }, (response) => {
        let config = {};
        if (response.code !== 1) {
            config = JSON.parse(response.data.data);
        }
        pdf.appConfig.config = config;
    });
    return pdf.appConfig.config || {};
};