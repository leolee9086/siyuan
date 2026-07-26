/** 用途：读取应用搜索配置。使用范围：构造新搜索会话的默认筛选条件；解耦评估：调用方必须在同一事件栈内得到配置对象，defaults 子域通过窄网关集中环境读取，参数逐层传递会扩散初始化职责。 */
import {getSiyuanConfig} from "./imports";

/** 从完整搜索配置投影布局搜索面板支持的块类型。 */
/** @同步豁免: UI构建 - 搜索面板和配置迁移在构造对象字面量时必须立即取得类型状态。 */
export const getDefaultType = () => {
    const search = getSiyuanConfig().search;
    return {
        audioBlock: search.audioBlock,
        videoBlock: search.videoBlock,
        iframeBlock: search.iframeBlock,
        widgetBlock: search.widgetBlock,
        document: search.document,
        heading: search.heading,
        list: search.list,
        listItem: search.listItem,
        codeBlock: search.codeBlock,
        htmlBlock: search.htmlBlock,
        mathBlock: search.mathBlock,
        table: search.table,
        blockquote: search.blockquote,
        callout: search.callout,
        superBlock: search.superBlock,
        paragraph: search.paragraph,
        embedBlock: search.embedBlock,
        databaseBlock: search.databaseBlock,
    };
};

/** 返回搜索面板默认不限制标题层级和列表类型的子类型状态。 */
/** @同步豁免: UI构建 - 调用方同步组装搜索配置，异步返回会改变既有配置协议。 */
export const getDefaultSubType = () => ({
    h1: false,
    h2: false,
    h3: false,
    h4: false,
    h5: false,
    h6: false,
    o: false,
    u: false,
    t: false,
});
