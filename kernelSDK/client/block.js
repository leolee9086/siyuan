// Generated API client for group block
export class BlockApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').BlockAppendBlockParams} BlockAppendBlockParams
 * @typedef {import('./index.d.ts').BlockAppendBlockResponse} BlockAppendBlockResponse
 * 在指定父块的末尾插入新的子块。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockAppendBlockParams} params - Request parameters.
 * @returns {Promise<BlockAppendBlockResponse>}
 */
  appendBlock(params) {
    return this.fetcher('POST', '/api/block/appendBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockAppendDailyNoteBlockParams} BlockAppendDailyNoteBlockParams
 * @typedef {import('./index.d.ts').BlockAppendDailyNoteBlockResponse} BlockAppendDailyNoteBlockResponse
 * 向指定笔记本的当日日记文档末尾追加新的内容块。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockAppendDailyNoteBlockParams} params - Request parameters.
 * @returns {Promise<BlockAppendDailyNoteBlockResponse>}
 */
  appendDailyNoteBlock(params) {
    return this.fetcher('POST', '/api/block/appendDailyNoteBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockBatchUpdateBlockParams} BlockBatchUpdateBlockParams
 * @typedef {import('./index.d.ts').BlockBatchUpdateBlockResponse} BlockBatchUpdateBlockResponse
 * 批量更新多个块的内容。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockBatchUpdateBlockParams} params - Request parameters.
 * @returns {Promise<BlockBatchUpdateBlockResponse>}
 */
  batchUpdateBlock(params) {
    return this.fetcher('POST', '/api/block/batchUpdateBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockCheckBlockExistParams} BlockCheckBlockExistParams
 * @typedef {import('./index.d.ts').BlockCheckBlockExistResponse} BlockCheckBlockExistResponse
 * 检查指定的块ID是否存在。
 * (Requires authentication)
 * @param {BlockCheckBlockExistParams} params - Request parameters.
 * @returns {Promise<BlockCheckBlockExistResponse>}
 */
  checkBlockExist(params) {
    return this.fetcher('POST', '/api/block/checkBlockExist', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockCheckBlockFoldParams} BlockCheckBlockFoldParams
 * @typedef {import('./index.d.ts').BlockCheckBlockFoldResponse} BlockCheckBlockFoldResponse
 * 检查指定的块ID是否已折叠，并返回其是否为根块。
 * (Requires authentication)
 * @param {BlockCheckBlockFoldParams} params - Request parameters.
 * @returns {Promise<BlockCheckBlockFoldResponse>}
 */
  checkBlockFold(params) {
    return this.fetcher('POST', '/api/block/checkBlockFold', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockCheckBlockRefParams} BlockCheckBlockRefParams
 * @typedef {import('./index.d.ts').BlockCheckBlockRefResponse} BlockCheckBlockRefResponse
 * 检查一批块ID的引用状态（例如，是否被其他块引用，是否定义了其他块等）。
 * (Requires authentication)
 * @param {BlockCheckBlockRefParams} params - Request parameters.
 * @returns {Promise<BlockCheckBlockRefResponse>}
 */
  checkBlockRef(params) {
    return this.fetcher('POST', '/api/block/checkBlockRef', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockDeleteBlockParams} BlockDeleteBlockParams
 * @typedef {import('./index.d.ts').BlockDeleteBlockResponse} BlockDeleteBlockResponse
 * 删除指定的块ID。此操作通过事务完成。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockDeleteBlockParams} params - Request parameters.
 * @returns {Promise<BlockDeleteBlockResponse>}
 */
  deleteBlock(params) {
    return this.fetcher('POST', '/api/block/deleteBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockFoldBlockParams} BlockFoldBlockParams
 * @typedef {import('./index.d.ts').BlockFoldBlockResponse} BlockFoldBlockResponse
 * 折叠指定的块ID。对于标题块，执行 foldHeading 操作；对于其他类型的块，设置其 fold 属性。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockFoldBlockParams} params - Request parameters.
 * @returns {Promise<BlockFoldBlockResponse>}
 */
  foldBlock(params) {
    return this.fetcher('POST', '/api/block/foldBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetBlockBreadcrumbParams} BlockGetBlockBreadcrumbParams
 * @typedef {import('./index.d.ts').BlockGetBlockBreadcrumbResponse} BlockGetBlockBreadcrumbResponse
 * 获取指定块ID到其根块（通常是文档块）的面包屑路径，可以排除特定类型的块。
 * (Requires authentication)
 * @param {BlockGetBlockBreadcrumbParams} params - Request parameters.
 * @returns {Promise<BlockGetBlockBreadcrumbResponse>}
 */
  getBlockBreadcrumb(params) {
    return this.fetcher('POST', '/api/block/getBlockBreadcrumb', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetBlockDOMParams} BlockGetBlockDOMParams
 * @typedef {import('./index.d.ts').BlockGetBlockDOMResponse} BlockGetBlockDOMResponse
 * 获取指定块ID的DOM表示（HTML字符串）。
 * (Requires authentication)
 * @param {BlockGetBlockDOMParams} params - Request parameters.
 * @returns {Promise<BlockGetBlockDOMResponse>}
 */
  getBlockDOM(params) {
    return this.fetcher('POST', '/api/block/getBlockDOM', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetBlockDefIDsByRefTextParams} BlockGetBlockDefIDsByRefTextParams
 * @typedef {import('./index.d.ts').BlockGetBlockDefIDsByRefTextResponse} BlockGetBlockDefIDsByRefTextResponse
 * 根据引用文本（锚文本）搜索并返回其可能指向的块定义ID列表。
 * (Requires authentication)
 * @param {BlockGetBlockDefIDsByRefTextParams} params - Request parameters.
 * @returns {Promise<BlockGetBlockDefIDsByRefTextResponse>}
 */
  getBlockDefIDsByRefText(params) {
    return this.fetcher('POST', '/api/block/getBlockDefIDsByRefText', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetBlockIndexParams} BlockGetBlockIndexParams
 * @typedef {import('./index.d.ts').BlockGetBlockIndexResponse} BlockGetBlockIndexResponse
 * 获取指定块ID在其父级块的子块列表中的位置索引（从0开始）。
 * (Requires authentication)
 * @param {BlockGetBlockIndexParams} params - Request parameters.
 * @returns {Promise<BlockGetBlockIndexResponse>}
 */
  getBlockIndex(params) {
    return this.fetcher('POST', '/api/block/getBlockIndex', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetBlockInfoParams} BlockGetBlockInfoParams
 * @typedef {import('./index.d.ts').BlockGetBlockInfoResponse} BlockGetBlockInfoResponse
 * 获取指定块ID的详细信息，包括其所在的笔记本ID(box)、路径(path)、根块ID(rootID)、根块标题(rootTitle)、根块图标(rootIcon)以及其在根块下的直接子块ID(rootChildID)。
 * (Requires authentication)
 * @param {BlockGetBlockInfoParams} params - Request parameters.
 * @returns {Promise<BlockGetBlockInfoResponse>}
 */
  getBlockInfo(params) {
    return this.fetcher('POST', '/api/block/getBlockInfo', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetBlockKramdownParams} BlockGetBlockKramdownParams
 * @typedef {import('./index.d.ts').BlockGetBlockKramdownResponse} BlockGetBlockKramdownResponse
 * 获取指定块ID的Kramdown源码表示。可选模式：'md'（Markdown标记符模式，默认）或 'textmark'（文本标记模式，使用span标签）。
 * (Requires authentication)
 * @param {BlockGetBlockKramdownParams} params - Request parameters.
 * @returns {Promise<BlockGetBlockKramdownResponse>}
 */
  getBlockKramdown(params) {
    return this.fetcher('POST', '/api/block/getBlockKramdown', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetBlockSiblingIDParams} BlockGetBlockSiblingIDParams
 * @typedef {import('./index.d.ts').BlockGetBlockSiblingIDResponse} BlockGetBlockSiblingIDResponse
 * 获取指定块ID的父块ID、上一个同级块ID和下一个同级块ID。
 * (Requires authentication)
 * @param {BlockGetBlockSiblingIDParams} params - Request parameters.
 * @returns {Promise<BlockGetBlockSiblingIDResponse>}
 */
  getBlockSiblingID(params) {
    return this.fetcher('POST', '/api/block/getBlockSiblingID', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetBlockTreeInfosParams} BlockGetBlockTreeInfosParams
 * @typedef {import('./index.d.ts').BlockGetBlockTreeInfosResponse} BlockGetBlockTreeInfosResponse
 * 批量获取指定块ID列表对应的块树（BlockTree）信息。
 * (Requires authentication)
 * @param {BlockGetBlockTreeInfosParams} params - Request parameters.
 * @returns {Promise<BlockGetBlockTreeInfosResponse>}
 */
  getBlockTreeInfos(params) {
    return this.fetcher('POST', '/api/block/getBlockTreeInfos', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetBlocksIndexesParams} BlockGetBlocksIndexesParams
 * @typedef {import('./index.d.ts').BlockGetBlocksIndexesResponse} BlockGetBlocksIndexesResponse
 * 批量获取指定块ID列表各自在其父级块的子块列表中的位置索引。
 * (Requires authentication)
 * @param {BlockGetBlocksIndexesParams} params - Request parameters.
 * @returns {Promise<BlockGetBlocksIndexesResponse>}
 */
  getBlocksIndexes(params) {
    return this.fetcher('POST', '/api/block/getBlocksIndexes', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetBlocksWordCountParams} BlockGetBlocksWordCountParams
 * @typedef {import('./index.d.ts').BlockGetBlocksWordCountResponse} BlockGetBlocksWordCountResponse
 * 获取指定块ID列表的总字数、字符数和链接数统计信息。
 * (Requires authentication)
 * @param {BlockGetBlocksWordCountParams} params - Request parameters.
 * @returns {Promise<BlockGetBlocksWordCountResponse>}
 */
  getBlocksWordCount(params) {
    return this.fetcher('POST', '/api/block/getBlocksWordCount', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetChildBlocksParams} BlockGetChildBlocksParams
 * @typedef {import('./index.d.ts').BlockGetChildBlocksResponse} BlockGetChildBlocksResponse
 * 获取指定块ID的所有直接子块的基本信息列表（仅包含ID和类型）。
 * (Requires authentication)
 * @param {BlockGetChildBlocksParams} params - Request parameters.
 * @returns {Promise<BlockGetChildBlocksResponse>}
 */
  getChildBlocks(params) {
    return this.fetcher('POST', '/api/block/getChildBlocks', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetContentWordCountParams} BlockGetContentWordCountParams
 * @typedef {import('./index.d.ts').BlockGetContentWordCountResponse} BlockGetContentWordCountResponse
 * 获取给定内容字符串的字数、字符数和链接数统计信息。
 * (Requires authentication)
 * @param {BlockGetContentWordCountParams} params - Request parameters.
 * @returns {Promise<BlockGetContentWordCountResponse>}
 */
  getContentWordCount(params) {
    return this.fetcher('POST', '/api/block/getContentWordCount', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetDOMTextParams} BlockGetDOMTextParams
 * @typedef {import('./index.d.ts').BlockGetDOMTextResponse} BlockGetDOMTextResponse
 * 提取给定DOM字符串中的纯文本内容。
 * (Requires authentication)
 * @param {BlockGetDOMTextParams} params - Request parameters.
 * @returns {Promise<BlockGetDOMTextResponse>}
 */
  getDOMText(params) {
    return this.fetcher('POST', '/api/block/getDOMText', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetDocInfoParams} BlockGetDocInfoParams
 * @typedef {import('./index.d.ts').BlockGetDocInfoResponse} BlockGetDocInfoResponse
 * 获取指定文档块ID的信息，包括其内容（DOM）、标题、图标、面包屑路径和是否为模板。
 * (Requires authentication)
 * @param {BlockGetDocInfoParams} params - Request parameters.
 * @returns {Promise<BlockGetDocInfoResponse>}
 */
  getDocInfo(params) {
    return this.fetcher('POST', '/api/block/getDocInfo', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetDocsInfoParams} BlockGetDocsInfoParams
 * @typedef {import('./index.d.ts').BlockGetDocsInfoResponse} BlockGetDocsInfoResponse
 * 批量获取多个指定文档块ID的信息。
 * (Requires authentication)
 * @param {BlockGetDocsInfoParams} params - Request parameters.
 * @returns {Promise<BlockGetDocsInfoResponse>}
 */
  getDocsInfo(params) {
    return this.fetcher('POST', '/api/block/getDocsInfo', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetHeadingChildrenDOMParams} BlockGetHeadingChildrenDOMParams
 * @typedef {import('./index.d.ts').BlockGetHeadingChildrenDOMResponse} BlockGetHeadingChildrenDOMResponse
 * 获取指定标题块ID下的所有子孙块的DOM内容。
 * (Requires authentication)
 * @param {BlockGetHeadingChildrenDOMParams} params - Request parameters.
 * @returns {Promise<BlockGetHeadingChildrenDOMResponse>}
 */
  getHeadingChildrenDOM(params) {
    return this.fetcher('POST', '/api/block/getHeadingChildrenDOM', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetHeadingChildrenIDsParams} BlockGetHeadingChildrenIDsParams
 * @typedef {import('./index.d.ts').BlockGetHeadingChildrenIDsResponse} BlockGetHeadingChildrenIDsResponse
 * 获取指定标题块ID下的所有子孙块的ID列表。
 * (Requires authentication)
 * @param {BlockGetHeadingChildrenIDsParams} params - Request parameters.
 * @returns {Promise<BlockGetHeadingChildrenIDsResponse>}
 */
  getHeadingChildrenIDs(params) {
    return this.fetcher('POST', '/api/block/getHeadingChildrenIDs', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetHeadingDeleteTransactionParams} BlockGetHeadingDeleteTransactionParams
 * @typedef {import('./index.d.ts').BlockGetHeadingDeleteTransactionResponse} BlockGetHeadingDeleteTransactionResponse
 * 获取删除指定标题块（及其所有子孙块）所需的事务操作列表。此接口仅返回事务，不实际执行删除。
 * (Requires authentication)
 * @param {BlockGetHeadingDeleteTransactionParams} params - Request parameters.
 * @returns {Promise<BlockGetHeadingDeleteTransactionResponse>}
 */
  getHeadingDeleteTransaction(params) {
    return this.fetcher('POST', '/api/block/getHeadingDeleteTransaction', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetHeadingLevelTransactionParams} BlockGetHeadingLevelTransactionParams
 * @typedef {import('./index.d.ts').BlockGetHeadingLevelTransactionResponse} BlockGetHeadingLevelTransactionResponse
 * 获取调整指定标题块级别所需的事务操作列表。此接口仅返回事务，不实际执行调整。
 * (Requires authentication)
 * @param {BlockGetHeadingLevelTransactionParams} params - Request parameters.
 * @returns {Promise<BlockGetHeadingLevelTransactionResponse>}
 */
  getHeadingLevelTransaction(params) {
    return this.fetcher('POST', '/api/block/getHeadingLevelTransaction', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetRecentUpdatedBlocksResponse} BlockGetRecentUpdatedBlocksResponse
 * 获取最近更新的块列表，按更新时间倒序排列。
 * (Requires authentication)
 * @returns {Promise<BlockGetRecentUpdatedBlocksResponse>}
 */
  getRecentUpdatedBlocks() {
    return this.fetcher('POST', '/api/block/getRecentUpdatedBlocks', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetRefIDsParams} BlockGetRefIDsParams
 * @typedef {import('./index.d.ts').BlockGetRefIDsResponse} BlockGetRefIDsResponse
 * 获取指定块ID所引用的所有定义块的ID列表。
 * (Requires authentication)
 * @param {BlockGetRefIDsParams} params - Request parameters.
 * @returns {Promise<BlockGetRefIDsResponse>}
 */
  getRefIDs(params) {
    return this.fetcher('POST', '/api/block/getRefIDs', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetRefIDsByFileAnnotationIDParams} BlockGetRefIDsByFileAnnotationIDParams
 * @typedef {import('./index.d.ts').BlockGetRefIDsByFileAnnotationIDResponse} BlockGetRefIDsByFileAnnotationIDResponse
 * 根据文件注解块的ID，查找与该注解相关的引用块ID和定义块ID。
 * (Requires authentication)
 * @param {BlockGetRefIDsByFileAnnotationIDParams} params - Request parameters.
 * @returns {Promise<BlockGetRefIDsByFileAnnotationIDResponse>}
 */
  getRefIDsByFileAnnotationID(params) {
    return this.fetcher('POST', '/api/block/getRefIDsByFileAnnotationID', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetRefTextParams} BlockGetRefTextParams
 * @typedef {import('./index.d.ts').BlockGetRefTextResponse} BlockGetRefTextResponse
 * 获取指定引用块ID的锚文本内容。
 * (Requires authentication)
 * @param {BlockGetRefTextParams} params - Request parameters.
 * @returns {Promise<BlockGetRefTextResponse>}
 */
  getRefText(params) {
    return this.fetcher('POST', '/api/block/getRefText', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetTailChildBlocksParams} BlockGetTailChildBlocksParams
 * @typedef {import('./index.d.ts').BlockGetTailChildBlocksResponse} BlockGetTailChildBlocksResponse
 * 获取指定块ID的尾部（最后）指定数量的直接子块的基本信息。
 * (Requires authentication)
 * @param {BlockGetTailChildBlocksParams} params - Request parameters.
 * @returns {Promise<BlockGetTailChildBlocksResponse>}
 */
  getTailChildBlocks(params) {
    return this.fetcher('POST', '/api/block/getTailChildBlocks', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetTreeStatParams} BlockGetTreeStatParams
 * @typedef {import('./index.d.ts').BlockGetTreeStatResponse} BlockGetTreeStatResponse
 * 获取指定块ID（通常是文档块）的树结构统计信息，如各种类型子块的数量等。
 * (Requires authentication)
 * @param {BlockGetTreeStatParams} params - Request parameters.
 * @returns {Promise<BlockGetTreeStatResponse>}
 */
  getTreeStat(params) {
    return this.fetcher('POST', '/api/block/getTreeStat', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockGetUnfoldedParentIDParams} BlockGetUnfoldedParentIDParams
 * @typedef {import('./index.d.ts').BlockGetUnfoldedParentIDResponse} BlockGetUnfoldedParentIDResponse
 * 向上查找指定块ID的父块链，返回最近的一个已展开（未折叠）的父块ID。
 * (Requires authentication)
 * @param {BlockGetUnfoldedParentIDParams} params - Request parameters.
 * @returns {Promise<BlockGetUnfoldedParentIDResponse>}
 */
  getUnfoldedParentID(params) {
    return this.fetcher('POST', '/api/block/getUnfoldedParentID', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockInsertBlockParams} BlockInsertBlockParams
 * @typedef {import('./index.d.ts').BlockInsertBlockResponse} BlockInsertBlockResponse
 * 在指定的锚点块（anchorID）之前或之后插入新的内容块。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockInsertBlockParams} params - Request parameters.
 * @returns {Promise<BlockInsertBlockResponse>}
 */
  insertBlock(params) {
    return this.fetcher('POST', '/api/block/insertBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockPrependBlockParams} BlockPrependBlockParams
 * @typedef {import('./index.d.ts').BlockPrependBlockResponse} BlockPrependBlockResponse
 * 在指定父块的开头插入新的子块。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockPrependBlockParams} params - Request parameters.
 * @returns {Promise<BlockPrependBlockResponse>}
 */
  prependBlock(params) {
    return this.fetcher('POST', '/api/block/prependBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockSetBlockReminderParams} BlockSetBlockReminderParams
 * @typedef {import('./index.d.ts').BlockSetBlockReminderResponse} BlockSetBlockReminderResponse
 * 为指定的块ID设置一个提醒时间。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockSetBlockReminderParams} params - Request parameters.
 * @returns {Promise<BlockSetBlockReminderResponse>}
 */
  setBlockReminder(params) {
    return this.fetcher('POST', '/api/block/setBlockReminder', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockSwapBlockRefParams} BlockSwapBlockRefParams
 * @typedef {import('./index.d.ts').BlockSwapBlockRefResponse} BlockSwapBlockRefResponse
 * 交换指定的引用块和其指向的定义块的角色。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockSwapBlockRefParams} params - Request parameters.
 * @returns {Promise<BlockSwapBlockRefResponse>}
 */
  swapBlockRef(params) {
    return this.fetcher('POST', '/api/block/swapBlockRef', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockTransferBlockRefParams} BlockTransferBlockRefParams
 * @typedef {import('./index.d.ts').BlockTransferBlockRefResponse} BlockTransferBlockRefResponse
 * 将原块（fromID）的所有引用关系（或指定的引用关系 refIDs）转移到目标块（toID）。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockTransferBlockRefParams} params - Request parameters.
 * @returns {Promise<BlockTransferBlockRefResponse>}
 */
  transferBlockRef(params) {
    return this.fetcher('POST', '/api/block/transferBlockRef', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockUnfoldBlockParams} BlockUnfoldBlockParams
 * @typedef {import('./index.d.ts').BlockUnfoldBlockResponse} BlockUnfoldBlockResponse
 * 展开指定的块ID。对于标题块，执行 unfoldHeading 操作；对于其他类型的块，设置其 fold 属性为 false。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockUnfoldBlockParams} params - Request parameters.
 * @returns {Promise<BlockUnfoldBlockResponse>}
 */
  unfoldBlock(params) {
    return this.fetcher('POST', '/api/block/unfoldBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockUpdateBlockParams} BlockUpdateBlockParams
 * @typedef {import('./index.d.ts').BlockUpdateBlockResponse} BlockUpdateBlockResponse
 * 更新指定块ID的内容。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockUpdateBlockParams} params - Request parameters.
 * @returns {Promise<BlockUpdateBlockResponse>}
 */
  updateBlock(params) {
    return this.fetcher('POST', '/api/block/updateBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockPrependDailyNoteBlockParams} BlockPrependDailyNoteBlockParams
 * @typedef {import('./index.d.ts').BlockPrependDailyNoteBlockResponse} BlockPrependDailyNoteBlockResponse
 * 在指定笔记本的当日日记文档开头追加新的内容块。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockPrependDailyNoteBlockParams} params - Request parameters.
 * @returns {Promise<BlockPrependDailyNoteBlockResponse>}
 */
  prependDailyNoteBlock(params) {
    return this.fetcher('POST', '/api/block/prependDailyNoteBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockMoveBlockParams} BlockMoveBlockParams
 * @typedef {import('./index.d.ts').BlockMoveBlockResponse} BlockMoveBlockResponse
 * 将指定的块移动到新的父块下或同级块的特定位置。移动后会触发相关文档编辑器的重载。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockMoveBlockParams} params - Request parameters.
 * @returns {Promise<BlockMoveBlockResponse>}
 */
  moveBlock(params) {
    return this.fetcher('POST', '/api/block/moveBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BlockMoveOutlineHeadingParams} BlockMoveOutlineHeadingParams
 * @typedef {import('./index.d.ts').BlockMoveOutlineHeadingResponse} BlockMoveOutlineHeadingResponse
 * 移动大纲中的标题块到新的父级或同级位置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BlockMoveOutlineHeadingParams} params - Request parameters.
 * @returns {Promise<BlockMoveOutlineHeadingResponse>}
 */
  moveOutlineHeading(params) {
    return this.fetcher('POST', '/api/block/moveOutlineHeading', params, true);
  }

}
