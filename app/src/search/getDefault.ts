import { getSiyuanConfig } from "../util/siyuanEnvironments/config.getConfig";
export const getDefaultType = () => {
    return {
        audioBlock: getSiyuanConfig().search.audioBlock,
        videoBlock: getSiyuanConfig().search.videoBlock,
        iframeBlock: getSiyuanConfig() .search.iframeBlock,
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
        superBlock: getSiyuanConfig().search.superBlock,
        paragraph: getSiyuanConfig().search.paragraph,
        embedBlock: getSiyuanConfig().search.embedBlock,
        databaseBlock: getSiyuanConfig().search.databaseBlock,
    };
};
