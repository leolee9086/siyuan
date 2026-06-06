/**
 * 所有 API 定义的聚合
 *
 * 这个文件将所有 API 定义合并为一个数组，
 * 供客户端创建和类型定义使用。
 */

/** 用途：kernel SDK 的 API 定义类型。使用范围：API 定义聚合。解耦评估：类型导入，不涉及运行时耦合。 */
import type { Api定义 } from "@leolee9086/siyuan-kernel-sdk";
/** 用途：所有 API 模块的运行时定义。使用范围：客户端创建和类型定义时使用。解耦评估：第三方库依赖，通过统一导入管理。 */
import {
    accountApiDefs,
    aiApiDefs,
    archiveApiDefs,
    attrApiDefs,
    avApiDefs,
    assetApiDefs,
    bazaarApiDefs,
    bookmarkApiDefs,
    broadcastApiDefs,
    clipboardApiDefs,
    cloudApiDefs,
    convertApiDefs,
    embeddingApiDefs,
    exportApiDefs,
    extensionApiDefs,
    fileApiDefs,
    filetreeApiDefs,
    formatApiDefs,
    graphApiDefs,
    historyApiDefs,
    iconApiDefs,
    importApiDefs,
    inboxApiDefs,
    luteApiDefs,
    miscApiDefs,
    networkApiDefs,
    notebookApiDefs,
    notificationApiDefs,
    outlineApiDefs,
    petalApiDefs,
    queryApiDefs,
    refApiDefs,
    repoApiDefs,
    riffApiDefs,
    searchApiDefs,
    settingApiDefs,
    snippetApiDefs,
    sqliteApiDefs,
    storageApiDefs,
    syncApiDefs,
    systemApiDefs,
    tagApiDefs,
    templateApiDefs,
    transactionsApiDefs,
    uiApiDefs,
    vectorApiDefs,
    // block 相关 API
    blockApiDefs,
    blockInsertApiDefs,
    blockUpdateApiDefs,
    blockDeleteAndMoveApiDefs,
    blockQueryApiDefs,
    blockRefApiDefs,
    blockHeadingApiDefs,
    blockMiscApiDefs,
} from "@leolee9086/siyuan-kernel-sdk";

/**
 * 合并所有 API 定义
 *
 * 注意：运行时使用 readonly Api定义[] 类型，类型推断通过 AllApiDefsType 联合类型实现
 */
export const allApiDefs: readonly Api定义[] = [
    ...accountApiDefs,
    ...aiApiDefs,
    ...archiveApiDefs,
    ...attrApiDefs,
    ...avApiDefs,
    ...assetApiDefs,
    ...bazaarApiDefs,
    ...bookmarkApiDefs,
    ...broadcastApiDefs,
    ...clipboardApiDefs,
    ...cloudApiDefs,
    ...convertApiDefs,
    ...embeddingApiDefs,
    ...exportApiDefs,
    ...extensionApiDefs,
    ...fileApiDefs,
    ...filetreeApiDefs,
    ...formatApiDefs,
    ...graphApiDefs,
    ...historyApiDefs,
    ...iconApiDefs,
    ...importApiDefs,
    ...inboxApiDefs,
    ...luteApiDefs,
    ...miscApiDefs,
    ...networkApiDefs,
    ...notebookApiDefs,
    ...notificationApiDefs,
    ...outlineApiDefs,
    ...petalApiDefs,
    ...queryApiDefs,
    ...refApiDefs,
    ...repoApiDefs,
    ...riffApiDefs,
    ...searchApiDefs,
    ...settingApiDefs,
    ...snippetApiDefs,
    ...sqliteApiDefs,
    ...storageApiDefs,
    ...syncApiDefs,
    ...systemApiDefs,
    ...tagApiDefs,
    ...templateApiDefs,
    ...transactionsApiDefs,
    ...uiApiDefs,
    ...vectorApiDefs,
    // block 相关 API
    ...blockApiDefs,
    ...blockInsertApiDefs,
    ...blockUpdateApiDefs,
    ...blockDeleteAndMoveApiDefs,
    ...blockQueryApiDefs,
    ...blockRefApiDefs,
    ...blockHeadingApiDefs,
    ...blockMiscApiDefs,
];

/**
 * 导出所有 API 定义，方便按需使用
 */
export {
    // 账户相关
    accountApiDefs,
    // AI 相关
    aiApiDefs,
    // 归档相关
    archiveApiDefs,
    // 属性相关
    attrApiDefs,
    // 属性视图相关
    avApiDefs,
    // 资源相关
    assetApiDefs,
    // 集市相关
    bazaarApiDefs,
    // 书签相关
    bookmarkApiDefs,
    // 广播相关
    broadcastApiDefs,
    // 剪贴板相关
    clipboardApiDefs,
    // 云端相关
    cloudApiDefs,
    // 转换相关
    convertApiDefs,
    // 嵌入相关
    embeddingApiDefs,
    // 导出相关
    exportApiDefs,
    // 扩展相关
    extensionApiDefs,
    // 文件相关
    fileApiDefs,
    // 文件树相关
    filetreeApiDefs,
    // 格式相关
    formatApiDefs,
    // 关系图相关
    graphApiDefs,
    // 历史相关
    historyApiDefs,
    // 图标相关
    iconApiDefs,
    // 导入相关
    importApiDefs,
    // 收集箱相关
    inboxApiDefs,
    // Lute 相关
    luteApiDefs,
    // 杂项相关
    miscApiDefs,
    // 网络相关
    networkApiDefs,
    // 笔记本相关
    notebookApiDefs,
    // 通知相关
    notificationApiDefs,
    // 大纲相关
    outlineApiDefs,
    // 花瓣相关
    petalApiDefs,
    // 查询相关
    queryApiDefs,
    // 引用相关
    refApiDefs,
    // 仓库相关
    repoApiDefs,
    // 卡片相关
    riffApiDefs,
    // 搜索相关
    searchApiDefs,
    // 设置相关
    settingApiDefs,
    // 代码片段相关
    snippetApiDefs,
    // SQLite 相关
    sqliteApiDefs,
    // 存储相关
    storageApiDefs,
    // 同步相关
    syncApiDefs,
    // 系统相关
    systemApiDefs,
    // 标签相关
    tagApiDefs,
    // 模板相关
    templateApiDefs,
    // 事务相关
    transactionsApiDefs,
    // UI 相关
    uiApiDefs,
    // 向量相关
    vectorApiDefs,
    // 块相关 API
    blockApiDefs,
    blockInsertApiDefs,
    blockUpdateApiDefs,
    blockDeleteAndMoveApiDefs,
    blockQueryApiDefs,
    blockRefApiDefs,
    blockHeadingApiDefs,
    blockMiscApiDefs,
};
