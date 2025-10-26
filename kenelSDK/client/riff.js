// Generated API client for group riff
export class RiffApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').RiffAddRiffCardsParams} RiffAddRiffCardsParams
 * @typedef {import('./index.d.ts').RiffAddRiffCardsResponse} RiffAddRiffCardsResponse
 * 将指定的块添加为闪卡到指定的闪卡包中。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RiffAddRiffCardsParams} params - Request parameters.
 * @returns {Promise<RiffAddRiffCardsResponse>}
 */
  addRiffCards(params) {
    return this.fetcher('POST', '/api/riff/addRiffCards', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffBatchSetRiffCardsDueTimeParams} RiffBatchSetRiffCardsDueTimeParams
 * @typedef {import('./index.d.ts').RiffBatchSetRiffCardsDueTimeResponse} RiffBatchSetRiffCardsDueTimeResponse
 * 批量设置闪卡的到期时间。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RiffBatchSetRiffCardsDueTimeParams} params - Request parameters.
 * @returns {Promise<RiffBatchSetRiffCardsDueTimeResponse>}
 */
  batchSetRiffCardsDueTime(params) {
    return this.fetcher('POST', '/api/riff/batchSetRiffCardsDueTime', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffCreateRiffDeckParams} RiffCreateRiffDeckParams
 * @typedef {import('./index.d.ts').RiffCreateRiffDeckResponse} RiffCreateRiffDeckResponse
 * 创建一个新的闪卡包。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RiffCreateRiffDeckParams} params - Request parameters.
 * @returns {Promise<RiffCreateRiffDeckResponse>}
 */
  createRiffDeck(params) {
    return this.fetcher('POST', '/api/riff/createRiffDeck', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffGetNotebookRiffCardsParams} RiffGetNotebookRiffCardsParams
 * @typedef {import('./index.d.ts').RiffGetNotebookRiffCardsResponse} RiffGetNotebookRiffCardsResponse
 * 获取指定笔记本下的所有闪卡块 ID，支持分页。
 * (Requires authentication, Requires admin role)
 * @param {RiffGetNotebookRiffCardsParams} params - Request parameters.
 * @returns {Promise<RiffGetNotebookRiffCardsResponse>}
 */
  getNotebookRiffCards(params) {
    return this.fetcher('POST', '/api/riff/getNotebookRiffCards', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffGetNotebookRiffDueCardsParams} RiffGetNotebookRiffDueCardsParams
 * @typedef {import('./index.d.ts').RiffGetNotebookRiffDueCardsResponse} RiffGetNotebookRiffDueCardsResponse
 * 获取指定笔记本下所有到期应复习的闪卡。
 * (Requires authentication, Requires admin role)
 * @param {RiffGetNotebookRiffDueCardsParams} params - Request parameters.
 * @returns {Promise<RiffGetNotebookRiffDueCardsResponse>}
 */
  getNotebookRiffDueCards(params) {
    return this.fetcher('POST', '/api/riff/getNotebookRiffDueCards', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffGetRiffCardsParams} RiffGetRiffCardsParams
 * @typedef {import('./index.d.ts').RiffGetRiffCardsResponse} RiffGetRiffCardsResponse
 * 获取指定闪卡包中的所有闪卡块 ID，支持分页。
 * (Requires authentication, Requires admin role)
 * @param {RiffGetRiffCardsParams} params - Request parameters.
 * @returns {Promise<RiffGetRiffCardsResponse>}
 */
  getRiffCards(params) {
    return this.fetcher('POST', '/api/riff/getRiffCards', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffGetRiffCardsByBlockIDsParams} RiffGetRiffCardsByBlockIDsParams
 * @typedef {import('./index.d.ts').RiffGetRiffCardsByBlockIDsResponse} RiffGetRiffCardsByBlockIDsResponse
 * 根据一组块 ID 批量获取它们对应的闪卡信息。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RiffGetRiffCardsByBlockIDsParams} params - Request parameters.
 * @returns {Promise<RiffGetRiffCardsByBlockIDsResponse>}
 */
  getRiffCardsByBlockIDs(params) {
    return this.fetcher('POST', '/api/riff/getRiffCardsByBlockIDs', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffGetRiffDecksResponse} RiffGetRiffDecksResponse
 * 获取当前工作空间中所有的闪卡包列表。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<RiffGetRiffDecksResponse>}
 */
  getRiffDecks() {
    return this.fetcher('POST', '/api/riff/getRiffDecks', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffGetRiffDueCardsParams} RiffGetRiffDueCardsParams
 * @typedef {import('./index.d.ts').RiffGetRiffDueCardsResponse} RiffGetRiffDueCardsResponse
 * 获取指定闪卡包中所有到期应复习的闪卡。
 * (Requires authentication, Requires admin role)
 * @param {RiffGetRiffDueCardsParams} params - Request parameters.
 * @returns {Promise<RiffGetRiffDueCardsResponse>}
 */
  getRiffDueCards(params) {
    return this.fetcher('POST', '/api/riff/getRiffDueCards', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffGetTreeRiffCardsParams} RiffGetTreeRiffCardsParams
 * @typedef {import('./index.d.ts').RiffGetTreeRiffCardsResponse} RiffGetTreeRiffCardsResponse
 * 获取指定文档树（根块）下的所有闪卡块 ID，支持分页。
 * (Requires authentication, Requires admin role)
 * @param {RiffGetTreeRiffCardsParams} params - Request parameters.
 * @returns {Promise<RiffGetTreeRiffCardsResponse>}
 */
  getTreeRiffCards(params) {
    return this.fetcher('POST', '/api/riff/getTreeRiffCards', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffGetTreeRiffDueCardsParams} RiffGetTreeRiffDueCardsParams
 * @typedef {import('./index.d.ts').RiffGetTreeRiffDueCardsResponse} RiffGetTreeRiffDueCardsResponse
 * 获取指定文档树（根块）下所有到期应复习的闪卡。
 * (Requires authentication, Requires admin role)
 * @param {RiffGetTreeRiffDueCardsParams} params - Request parameters.
 * @returns {Promise<RiffGetTreeRiffDueCardsResponse>}
 */
  getTreeRiffDueCards(params) {
    return this.fetcher('POST', '/api/riff/getTreeRiffDueCards', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffRemoveRiffCardsParams} RiffRemoveRiffCardsParams
 * @typedef {import('./index.d.ts').RiffRemoveRiffCardsResponse} RiffRemoveRiffCardsResponse
 * 从指定的闪卡包中移除指定的闪卡。如果 deckID 为空字符串，则从所有闪卡包中移除。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RiffRemoveRiffCardsParams} params - Request parameters.
 * @returns {Promise<RiffRemoveRiffCardsResponse>}
 */
  removeRiffCards(params) {
    return this.fetcher('POST', '/api/riff/removeRiffCards', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffRemoveRiffDeckParams} RiffRemoveRiffDeckParams
 * @typedef {import('./index.d.ts').RiffRemoveRiffDeckResponse} RiffRemoveRiffDeckResponse
 * 移除指定的闪卡包及其包含的所有闪卡。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RiffRemoveRiffDeckParams} params - Request parameters.
 * @returns {Promise<RiffRemoveRiffDeckResponse>}
 */
  removeRiffDeck(params) {
    return this.fetcher('POST', '/api/riff/removeRiffDeck', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffRenameRiffDeckParams} RiffRenameRiffDeckParams
 * @typedef {import('./index.d.ts').RiffRenameRiffDeckResponse} RiffRenameRiffDeckResponse
 * 重命名指定的闪卡包。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RiffRenameRiffDeckParams} params - Request parameters.
 * @returns {Promise<RiffRenameRiffDeckResponse>}
 */
  renameRiffDeck(params) {
    return this.fetcher('POST', '/api/riff/renameRiffDeck', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffResetRiffCardsParams} RiffResetRiffCardsParams
 * @typedef {import('./index.d.ts').RiffResetRiffCardsResponse} RiffResetRiffCardsResponse
 * 重置指定范围内的闪卡的学习进度。可以按笔记本、文档树或闪卡包进行重置，也可以指定具体的块 ID 列表。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RiffResetRiffCardsParams} params - Request parameters.
 * @returns {Promise<RiffResetRiffCardsResponse>}
 */
  resetRiffCards(params) {
    return this.fetcher('POST', '/api/riff/resetRiffCards', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffReviewRiffCardParams} RiffReviewRiffCardParams
 * @typedef {import('./index.d.ts').RiffReviewRiffCardResponse} RiffReviewRiffCardResponse
 * 对指定的闪卡进行一次复习，并根据评分更新其下次到期时间等学习状态。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RiffReviewRiffCardParams} params - Request parameters.
 * @returns {Promise<RiffReviewRiffCardResponse>}
 */
  reviewRiffCard(params) {
    return this.fetcher('POST', '/api/riff/reviewRiffCard', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RiffSkipReviewRiffCardParams} RiffSkipReviewRiffCardParams
 * @typedef {import('./index.d.ts').RiffSkipReviewRiffCardResponse} RiffSkipReviewRiffCardResponse
 * 跳过当前闪卡的复习，通常是将其推迟到当前学习队列的末尾或稍后。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RiffSkipReviewRiffCardParams} params - Request parameters.
 * @returns {Promise<RiffSkipReviewRiffCardResponse>}
 */
  skipReviewRiffCard(params) {
    return this.fetcher('POST', '/api/riff/skipReviewRiffCard', params, true);
  }

}
