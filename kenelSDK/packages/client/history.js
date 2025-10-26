// Generated API client for group history
export class HistoryApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').HistoryClearWorkspaceHistoryResponse} HistoryClearWorkspaceHistoryResponse
 * 清空当前工作空间下的所有历史记录。这是一个耗时操作，执行前会有提示。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<HistoryClearWorkspaceHistoryResponse>}
 */
  clearWorkspaceHistory() {
    return this.fetcher('POST', '/api/history/clearWorkspaceHistory', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').HistoryGetDocHistoryContentParams} HistoryGetDocHistoryContentParams
 * @typedef {import('./index.d.ts').HistoryGetDocHistoryContentResponse} HistoryGetDocHistoryContentResponse
 * 获取指定文档历史版本的内容和相关信息。
 * (Requires authentication, Requires admin role)
 * @param {HistoryGetDocHistoryContentParams} params - Request parameters.
 * @returns {Promise<HistoryGetDocHistoryContentResponse>}
 */
  getDocHistoryContent(params) {
    return this.fetcher('POST', '/api/history/getDocHistoryContent', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').HistoryGetHistoryItemsParams} HistoryGetHistoryItemsParams
 * @typedef {import('./index.d.ts').HistoryGetHistoryItemsResponse} HistoryGetHistoryItemsResponse
 * 根据创建日期、关键词等条件获取历史记录中的具体条目列表。
 * (Requires authentication, Requires admin role)
 * @param {HistoryGetHistoryItemsParams} params - Request parameters.
 * @returns {Promise<HistoryGetHistoryItemsResponse>}
 */
  getHistoryItems(params) {
    return this.fetcher('POST', '/api/history/getHistoryItems', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').HistoryGetNotebookHistoryResponse} HistoryGetNotebookHistoryResponse
 * 获取所有笔记本的历史记录信息。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<HistoryGetNotebookHistoryResponse>}
 */
  getNotebookHistory() {
    return this.fetcher('POST', '/api/history/getNotebookHistory', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').HistoryReindexHistoryResponse} HistoryReindexHistoryResponse
 * 重建整个工作空间的历史记录索引。这是一个后台异步操作。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<HistoryReindexHistoryResponse>}
 */
  reindexHistory() {
    return this.fetcher('POST', '/api/history/reindexHistory', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').HistoryRollbackAssetsHistoryParams} HistoryRollbackAssetsHistoryParams
 * @typedef {import('./index.d.ts').HistoryRollbackAssetsHistoryResponse} HistoryRollbackAssetsHistoryResponse
 * 将资源文件回滚到指定的历史版本。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {HistoryRollbackAssetsHistoryParams} params - Request parameters.
 * @returns {Promise<HistoryRollbackAssetsHistoryResponse>}
 */
  rollbackAssetsHistory(params) {
    return this.fetcher('POST', '/api/history/rollbackAssetsHistory', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').HistoryRollbackDocHistoryParams} HistoryRollbackDocHistoryParams
 * @typedef {import('./index.d.ts').HistoryRollbackDocHistoryResponse} HistoryRollbackDocHistoryResponse
 * 将单个文档回滚到指定的历史版本。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {HistoryRollbackDocHistoryParams} params - Request parameters.
 * @returns {Promise<HistoryRollbackDocHistoryResponse>}
 */
  rollbackDocHistory(params) {
    return this.fetcher('POST', '/api/history/rollbackDocHistory', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').HistoryRollbackNotebookHistoryParams} HistoryRollbackNotebookHistoryParams
 * @typedef {import('./index.d.ts').HistoryRollbackNotebookHistoryResponse} HistoryRollbackNotebookHistoryResponse
 * 将整个笔记本回滚到指定的历史版本。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {HistoryRollbackNotebookHistoryParams} params - Request parameters.
 * @returns {Promise<HistoryRollbackNotebookHistoryResponse>}
 */
  rollbackNotebookHistory(params) {
    return this.fetcher('POST', '/api/history/rollbackNotebookHistory', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').HistorySearchHistoryParams} HistorySearchHistoryParams
 * @typedef {import('./index.d.ts').HistorySearchHistoryResponse} HistorySearchHistoryResponse
 * 根据关键词、笔记本、类型等分页搜索历史记录。
 * (Requires authentication, Requires admin role)
 * @param {HistorySearchHistoryParams} params - Request parameters.
 * @returns {Promise<HistorySearchHistoryResponse>}
 */
  searchHistory(params) {
    return this.fetcher('POST', '/api/history/searchHistory', params, true);
  }

}
