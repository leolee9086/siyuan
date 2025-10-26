// Generated API client for group storage
export class StorageApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').StorageGetCriteriaResponse} StorageGetCriteriaResponse
 * 获取所有用户已保存的搜索标准（过滤条件）列表。
 * (Requires authentication)
 * @returns {Promise<StorageGetCriteriaResponse>}
 */
  getCriteria() {
    return this.fetcher('POST', '/api/storage/getCriteria', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').StorageGetLocalStorageResponse} StorageGetLocalStorageResponse
 * 获取浏览器 LocalStorage 中的所有键值对。
 * (Requires authentication)
 * @returns {Promise<StorageGetLocalStorageResponse>}
 */
  getLocalStorage() {
    return this.fetcher('POST', '/api/storage/getLocalStorage', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').StorageGetRecentDocsResponse} StorageGetRecentDocsResponse
 * 获取用户最近打开过的文档列表。这些文档按最近打开时间排序。
 * (Requires authentication)
 * @returns {Promise<StorageGetRecentDocsResponse>}
 */
  getRecentDocs() {
    return this.fetcher('POST', '/api/storage/getRecentDocs', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').StorageRemoveCriterionParams} StorageRemoveCriterionParams
 * @typedef {import('./index.d.ts').StorageRemoveCriterionResponse} StorageRemoveCriterionResponse
 * 根据名称移除一个已保存的搜索标准（过滤条件）。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {StorageRemoveCriterionParams} params - Request parameters.
 * @returns {Promise<StorageRemoveCriterionResponse>}
 */
  removeCriterion(params) {
    return this.fetcher('POST', '/api/storage/removeCriterion', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').StorageRemoveLocalStorageValsParams} StorageRemoveLocalStorageValsParams
 * @typedef {import('./index.d.ts').StorageRemoveLocalStorageValsResponse} StorageRemoveLocalStorageValsResponse
 * 根据提供的键名列表，批量移除浏览器 LocalStorage 中的项目。同时会广播事件通知其他客户端同步移除。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {StorageRemoveLocalStorageValsParams} params - Request parameters.
 * @returns {Promise<StorageRemoveLocalStorageValsResponse>}
 */
  removeLocalStorageVals(params) {
    return this.fetcher('POST', '/api/storage/removeLocalStorageVals', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').StorageSetCriterionParams} StorageSetCriterionParams
 * @typedef {import('./index.d.ts').StorageSetCriterionResponse} StorageSetCriterionResponse
 * @typedef {import('./index.d.ts').StorageSetCriterionParamsCriterion} StorageSetCriterionParamsCriterion
 * 保存或更新一个搜索标准（过滤条件）。搜索标准可用于后续的文档或内容搜索。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {StorageSetCriterionParams} params - Request parameters.
 * @returns {Promise<StorageSetCriterionResponse>}
 */
  setCriterion(params) {
    return this.fetcher('POST', '/api/storage/setCriterion', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').StorageSetLocalStorageParams} StorageSetLocalStorageParams
 * @typedef {import('./index.d.ts').StorageSetLocalStorageResponse} StorageSetLocalStorageResponse
 * 使用一个完整的对象来覆盖整个浏览器 LocalStorage 的内容。通常用于导入或恢复 LocalStorage 数据。同时会广播事件通知其他客户端同步设置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {StorageSetLocalStorageParams} params - Request parameters.
 * @returns {Promise<StorageSetLocalStorageResponse>}
 */
  setLocalStorage(params) {
    return this.fetcher('POST', '/api/storage/setLocalStorage', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').StorageSetLocalStorageValParams} StorageSetLocalStorageValParams
 * @typedef {import('./index.d.ts').StorageSetLocalStorageValResponse} StorageSetLocalStorageValResponse
 * 设置浏览器 LocalStorage 中的单个键值对。同时会广播事件通知其他客户端同步设置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {StorageSetLocalStorageValParams} params - Request parameters.
 * @returns {Promise<StorageSetLocalStorageValResponse>}
 */
  setLocalStorageVal(params) {
    return this.fetcher('POST', '/api/storage/setLocalStorageVal', params, true);
  }

}
