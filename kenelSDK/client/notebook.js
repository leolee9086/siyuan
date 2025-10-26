// Generated API client for group notebook
export class NotebookApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').NotebookChangeSortNotebookParams} NotebookChangeSortNotebookParams
 * @typedef {import('./index.d.ts').NotebookChangeSortNotebookResponse} NotebookChangeSortNotebookResponse
 * 批量更改笔记本的显示顺序。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {NotebookChangeSortNotebookParams} params - Request parameters.
 * @returns {Promise<NotebookChangeSortNotebookResponse>}
 */
  changeSortNotebook(params) {
    return this.fetcher('POST', '/api/notebook/changeSortNotebook', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').NotebookCloseNotebookParams} NotebookCloseNotebookParams
 * @typedef {import('./index.d.ts').NotebookCloseNotebookResponse} NotebookCloseNotebookResponse
 * 关闭一个指定的笔记本。关闭后，笔记本内容将不再可访问，直到再次打开。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {NotebookCloseNotebookParams} params - Request parameters.
 * @returns {Promise<NotebookCloseNotebookResponse>}
 */
  closeNotebook(params) {
    return this.fetcher('POST', '/api/notebook/closeNotebook', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').NotebookCreateNotebookParams} NotebookCreateNotebookParams
 * @typedef {import('./index.d.ts').NotebookCreateNotebookResponse} NotebookCreateNotebookResponse
 * 创建一个新的笔记本。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {NotebookCreateNotebookParams} params - Request parameters.
 * @returns {Promise<NotebookCreateNotebookResponse>}
 */
  createNotebook(params) {
    return this.fetcher('POST', '/api/notebook/createNotebook', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').NotebookGetNotebookConfParams} NotebookGetNotebookConfParams
 * @typedef {import('./index.d.ts').NotebookGetNotebookConfResponse} NotebookGetNotebookConfResponse
 * 获取指定笔记本的配置信息。
 * (Requires authentication)
 * @param {NotebookGetNotebookConfParams} params - Request parameters.
 * @returns {Promise<NotebookGetNotebookConfResponse>}
 */
  getNotebookConf(params) {
    return this.fetcher('POST', '/api/notebook/getNotebookConf', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').NotebookGetNotebookInfoParams} NotebookGetNotebookInfoParams
 * @typedef {import('./index.d.ts').NotebookGetNotebookInfoResponse} NotebookGetNotebookInfoResponse
 * 获取指定笔记本的详细信息，包括其配置和统计数据。
 * (Requires authentication, Unavailable in read-only mode)
 * @param {NotebookGetNotebookInfoParams} params - Request parameters.
 * @returns {Promise<NotebookGetNotebookInfoResponse>}
 */
  getNotebookInfo(params) {
    return this.fetcher('POST', '/api/notebook/getNotebookInfo', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').NotebookLsNotebooksResponse} NotebookLsNotebooksResponse
 * 获取当前工作空间中所有笔记本的列表，包含已打开和未打开的笔记本。
 * (Requires authentication)
 * @returns {Promise<NotebookLsNotebooksResponse>}
 */
  lsNotebooks() {
    return this.fetcher('POST', '/api/notebook/lsNotebooks', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').NotebookOpenNotebookParams} NotebookOpenNotebookParams
 * @typedef {import('./index.d.ts').NotebookOpenNotebookResponse} NotebookOpenNotebookResponse
 * 打开一个指定的笔记本。如果笔记本已经是打开状态，此操作可能仅刷新其状态。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {NotebookOpenNotebookParams} params - Request parameters.
 * @returns {Promise<NotebookOpenNotebookResponse>}
 */
  openNotebook(params) {
    return this.fetcher('POST', '/api/notebook/openNotebook', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').NotebookRemoveNotebookParams} NotebookRemoveNotebookParams
 * @typedef {import('./index.d.ts').NotebookRemoveNotebookResponse} NotebookRemoveNotebookResponse
 * 删除一个指定的笔记本。此操作会从工作空间移除笔记本及其所有内容。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {NotebookRemoveNotebookParams} params - Request parameters.
 * @returns {Promise<NotebookRemoveNotebookResponse>}
 */
  removeNotebook(params) {
    return this.fetcher('POST', '/api/notebook/removeNotebook', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').NotebookRenameNotebookParams} NotebookRenameNotebookParams
 * @typedef {import('./index.d.ts').NotebookRenameNotebookResponse} NotebookRenameNotebookResponse
 * 重命名一个指定的笔记本。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {NotebookRenameNotebookParams} params - Request parameters.
 * @returns {Promise<NotebookRenameNotebookResponse>}
 */
  renameNotebook(params) {
    return this.fetcher('POST', '/api/notebook/renameNotebook', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').NotebookSetNotebookConfParams} NotebookSetNotebookConfParams
 * @typedef {import('./index.d.ts').NotebookSetNotebookConfResponse} NotebookSetNotebookConfResponse
 * @typedef {import('./index.d.ts').NotebookSetNotebookConfParamsConf} NotebookSetNotebookConfParamsConf
 * 更新指定笔记本的配置信息。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {NotebookSetNotebookConfParams} params - Request parameters.
 * @returns {Promise<NotebookSetNotebookConfResponse>}
 */
  setNotebookConf(params) {
    return this.fetcher('POST', '/api/notebook/setNotebookConf', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').NotebookSetNotebookIconParams} NotebookSetNotebookIconParams
 * @typedef {import('./index.d.ts').NotebookSetNotebookIconResponse} NotebookSetNotebookIconResponse
 * 设置指定笔记本的显示图标。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {NotebookSetNotebookIconParams} params - Request parameters.
 * @returns {Promise<NotebookSetNotebookIconResponse>}
 */
  setNotebookIcon(params) {
    return this.fetcher('POST', '/api/notebook/setNotebookIcon', params, true);
  }

}
