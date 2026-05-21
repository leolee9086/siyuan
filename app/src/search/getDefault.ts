import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
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

export const getDefaultSubType = (): Config.IUILayoutTabSearchConfigSubTypes => {
    return {
        h1: false, h2: false, h3: false, h4: false, h5: false, h6: false,
        o: false, u: false, t: false,
    };
};
