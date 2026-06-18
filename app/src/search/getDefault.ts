/** 用途：安全读取思源配置。使用范围：search 模块获取默认搜索配置。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanConfig } from "./imports";

/**
 * 获取默认搜索类型配置
 * @作用 返回各文档类型的默认搜索启用状态
 * @调用时机 搜索面板初始化时
 * @同步豁免: 生命周期 — 搜索配置在初始化时同步读取
 */
export const getDefaultType = () => {
    return {
        audioBlock: getSiyuanConfig().search.audioBlock,
        videoBlock: getSiyuanConfig().search.videoBlock,
        iframeBlock: getSiyuanConfig().search.iframeBlock,
        widgetBlock: getSiyuanConfig().search.widgetBlock,
        document: getSiyuanConfig().search.document,
        heading: getSiyuanConfig().search.heading,
        list: getSiyuanConfig().search.list,
        listItem: getSiyuanConfig().search.listItem,
        codeBlock: getSiyuanConfig().search.codeBlock,
        htmlBlock: getSiyuanConfig().search.htmlBlock,
        mathBlock: getSiyuanConfig().search.mathBlock,
        table: getSiyuanConfig().search.table,
        blockquote: getSiyuanConfig().search.blockquote,
        callout: getSiyuanConfig().search.callout,
        superBlock: getSiyuanConfig().search.superBlock,
        paragraph: getSiyuanConfig().search.paragraph,
        embedBlock: getSiyuanConfig().search.embedBlock,
        databaseBlock: getSiyuanConfig().search.databaseBlock,
    };
};

/**
 * 获取默认搜索子类型配置
 * @作用 返回标题和列表子类型的默认启用状态
 * @调用时机 搜索面板初始化时
 * @同步豁免: 生命周期 — 搜索配置在初始化时同步读取
 */
export const getDefaultSubType = () => {
    return {
        h1: false, h2: false, h3: false, h4: false, h5: false, h6: false,
        o: false, u: false, t: false,
    };
};
