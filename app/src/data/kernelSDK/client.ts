/**
 * 共享的 kernelSDK 客户端实例
 *
 * 这个文件创建并导出一个配置好的 kernelSDK 客户端实例，
 * 供 app/src/util/ 目录下的文件使用。
 */

import { createClient } from "@leolee9086/siyuan-kernel-sdk";
import type { KernelClientType } from "./client.types";
import {
    allApiDefs,
    // 重新导出所有 API 定义
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
    blockApiDefs,
    blockInsertApiDefs,
    blockUpdateApiDefs,
    blockDeleteAndMoveApiDefs,
    blockQueryApiDefs,
    blockRefApiDefs,
    blockHeadingApiDefs,
    blockMiscApiDefs,
} from "./apiDefs";

/**
 * 获取基础 URL
 * 使用默认的本地地址，避免直接访问 window 对象
 */
function getBaseUrl(): string {
    // 使用思源笔记的默认端口
    return "http://127.0.0.1:6806";
}

/**
 * 共享的 kernelSDK 客户端实例
 *
 * 这个客户端实例包含了所有可用的 API 方法，
 * 并且已经配置了正确的 baseUrl。
 *
 * 注意：通过显式指定泛型参数 TResult=KernelClientType，
 * 确保返回类型包含所有必选方法（非可选）。
 */
export const kernelClient = createClient<
    typeof allApiDefs,
    KernelClientType
>(allApiDefs, {
    baseUrl: getBaseUrl(),
    // 可以根据需要添加其他配置
    // apiToken: '', // 如果需要认证，可以在这里设置
});

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
