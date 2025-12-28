/**
 * API 定义模块入口
 * 
 * 这个文件导出所有 API 定义
 */

// 导出通用类型
export {
    标准响应Schema,
    创建响应Schema,
    createResponseSchema,
    BlockId,
    NotebookId,
    DocumentId,
    空请求Schema,
    EmptyRequestSchema,
} from './types';

export type { 标准响应 } from './types';

// ========== 已迁移的 API 定义 ==========
export { accountApiDefs } from './account';
export { aiApiDefs } from './ai';
export { archiveApiDefs } from './archive';
export { attrApiDefs } from './attr';
export { bookmarkApiDefs } from './bookmark';
export { broadcastApiDefs } from './broadcast';
export { clipboardApiDefs } from './clipboard';
export { cloudApiDefs } from './cloud';
export { convertApiDefs } from './convert';
export { extensionApiDefs } from './extension';
export { formatApiDefs } from './format';
export { iconApiDefs } from './icon';
export { importApiDefs } from './import';
export { inboxApiDefs } from './inbox';
export { luteApiDefs } from './lute';
export { miscApiDefs } from './misc';
export { networkApiDefs } from './network';
export { notificationApiDefs } from './notification';
export { outlineApiDefs } from './outline';
export { petalApiDefs } from './petal';
export { queryApiDefs } from './query';
export { snippetApiDefs } from './snippet';
export { sqliteApiDefs } from './sqlite';
export { tagApiDefs } from './tag';
export { templateApiDefs } from './template';
export { uiApiDefs } from './ui';
export { transactionsApiDefs } from './transactions';
export { graphApiDefs } from './graph';
export { refApiDefs } from './ref';
export { fileApiDefs } from './file';
export { notebookApiDefs } from './notebook';
export { historyApiDefs } from './history';
export { storageApiDefs } from './storage';
export { syncApiDefs } from './sync';
export { searchApiDefs } from './search';
export { vectorApiDefs } from './vector';
export { embeddingApiDefs } from './embedding';
export { systemApiDefs } from './system';
export { riffApiDefs } from './riff';
export { repoApiDefs } from './repo';
export { assetApiDefs } from './asset';
export { bazaarApiDefs } from './bazaar';
export { settingApiDefs } from './setting';
export { exportApiDefs } from './export';
export { filetreeApiDefs } from './filetree';
// block 模块已拆分为多个子文件，从 block/ 目录导入
export { blockApiDefs } from './block/index';
// 也导出 block 子模块，方便按需导入
export {
    insertApiDefs as blockInsertApiDefs,
    updateApiDefs as blockUpdateApiDefs,
    deleteAndMoveApiDefs as blockDeleteAndMoveApiDefs,
    queryApiDefs as blockQueryApiDefs,
    refApiDefs as blockRefApiDefs,
    headingApiDefs as blockHeadingApiDefs,
    miscApiDefs as blockMiscApiDefs,
} from './block/index';
export { avApiDefs } from './av';

// ========== 统一 API 定义集合 ==========
// 用于核对脚本等需要遍历所有 API 的场景
import { accountApiDefs } from './account';
import { aiApiDefs } from './ai';
import { archiveApiDefs } from './archive';
import { attrApiDefs } from './attr';
import { bookmarkApiDefs } from './bookmark';
import { broadcastApiDefs } from './broadcast';
import { clipboardApiDefs } from './clipboard';
import { cloudApiDefs } from './cloud';
import { convertApiDefs } from './convert';
import { extensionApiDefs } from './extension';
import { formatApiDefs } from './format';
import { iconApiDefs } from './icon';
import { importApiDefs } from './import';
import { inboxApiDefs } from './inbox';
import { luteApiDefs } from './lute';
import { miscApiDefs } from './misc';
import { networkApiDefs } from './network';
import { notificationApiDefs } from './notification';
import { outlineApiDefs } from './outline';
import { petalApiDefs } from './petal';
import { queryApiDefs } from './query';
import { snippetApiDefs } from './snippet';
import { sqliteApiDefs } from './sqlite';
import { tagApiDefs } from './tag';
import { templateApiDefs } from './template';
import { uiApiDefs } from './ui';
import { transactionsApiDefs } from './transactions';
import { graphApiDefs } from './graph';
import { refApiDefs } from './ref';
import { fileApiDefs } from './file';
import { notebookApiDefs } from './notebook';
import { historyApiDefs } from './history';
import { storageApiDefs } from './storage';
import { syncApiDefs } from './sync';
import { searchApiDefs } from './search';
import { vectorApiDefs } from './vector';
import { embeddingApiDefs } from './embedding';
import { systemApiDefs } from './system';
import { riffApiDefs } from './riff';
import { repoApiDefs } from './repo';
import { assetApiDefs } from './asset';
import { bazaarApiDefs } from './bazaar';
import { settingApiDefs } from './setting';
import { exportApiDefs } from './export';
import { filetreeApiDefs } from './filetree';
import { blockApiDefs } from './block/index';
import { avApiDefs } from './av';

import type { Api定义 } from '../client/types';

/**
 * 所有 API 定义的统一集合
 * 键为文件名，值为该文件的 API 定义数组
 * 
 * 注意：新增 API 模块时，需要在这里添加对应条目
 */
export const allApiDefs: Record<string, readonly Api定义[]> = {
    'account': accountApiDefs,
    'ai': aiApiDefs,
    'archive': archiveApiDefs,
    'attr': attrApiDefs,
    'bookmark': bookmarkApiDefs,
    'broadcast': broadcastApiDefs,
    'clipboard': clipboardApiDefs,
    'cloud': cloudApiDefs,
    'convert': convertApiDefs,
    'extension': extensionApiDefs,
    'format': formatApiDefs,
    'icon': iconApiDefs,
    'import': importApiDefs,
    'inbox': inboxApiDefs,
    'lute': luteApiDefs,
    'misc': miscApiDefs,
    'network': networkApiDefs,
    'notification': notificationApiDefs,
    'outline': outlineApiDefs,
    'petal': petalApiDefs,
    'query': queryApiDefs,
    'snippet': snippetApiDefs,
    'sqlite': sqliteApiDefs,
    'tag': tagApiDefs,
    'template': templateApiDefs,
    'ui': uiApiDefs,
    'transactions': transactionsApiDefs,
    'graph': graphApiDefs,
    'ref': refApiDefs,
    'file': fileApiDefs,
    'notebook': notebookApiDefs,
    'history': historyApiDefs,
    'storage': storageApiDefs,
    'sync': syncApiDefs,
    'search': searchApiDefs,
    'vector': vectorApiDefs,
    'embedding': embeddingApiDefs,
    'system': systemApiDefs,
    'riff': riffApiDefs,
    'repo': repoApiDefs,
    'asset': assetApiDefs,
    'bazaar': bazaarApiDefs,
    'setting': settingApiDefs,
    'export': exportApiDefs,
    'filetree': filetreeApiDefs,
    'block': blockApiDefs,
    'av': avApiDefs,
};
