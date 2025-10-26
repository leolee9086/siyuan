// Generated API client for group attr
export class AttrApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').AttrBatchGetBlockAttrsParams} AttrBatchGetBlockAttrsParams
 * @typedef {import('./index.d.ts').AttrBatchGetBlockAttrsResponse} AttrBatchGetBlockAttrsResponse
 * 根据提供的块 ID 列表，批量获取这些块的所有自定义属性。
 * (Requires authentication)
 * @param {AttrBatchGetBlockAttrsParams} params - Request parameters.
 * @returns {Promise<AttrBatchGetBlockAttrsResponse>}
 */
  batchGetBlockAttrs(params) {
    return this.fetcher('POST', '/api/attr/batchGetBlockAttrs', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AttrBatchSetBlockAttrsParams} AttrBatchSetBlockAttrsParams
 * @typedef {import('./index.d.ts').AttrBatchSetBlockAttrsResponse} AttrBatchSetBlockAttrsResponse
 * 根据提供的块 ID 和对应的属性集，批量为这些块设置自定义属性。如果属性值为 null，则表示删除该属性。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AttrBatchSetBlockAttrsParams} params - Request parameters.
 * @returns {Promise<AttrBatchSetBlockAttrsResponse>}
 */
  batchSetBlockAttrs(params) {
    return this.fetcher('POST', '/api/attr/batchSetBlockAttrs', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AttrGetBlockAttrsParams} AttrGetBlockAttrsParams
 * @typedef {import('./index.d.ts').AttrGetBlockAttrsResponse} AttrGetBlockAttrsResponse
 * 获取指定块 ID 的所有自定义属性。
 * (Requires authentication)
 * @param {AttrGetBlockAttrsParams} params - Request parameters.
 * @returns {Promise<AttrGetBlockAttrsResponse>}
 */
  getBlockAttrs(params) {
    return this.fetcher('POST', '/api/attr/getBlockAttrs', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AttrGetBookmarkLabelsResponse} AttrGetBookmarkLabelsResponse
 * 获取当前工作空间中所有书签使用过的标签列表。
 * (Requires authentication)
 * @returns {Promise<AttrGetBookmarkLabelsResponse>}
 */
  getBookmarkLabels() {
    return this.fetcher('POST', '/api/attr/getBookmarkLabels', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').AttrResetBlockAttrsParams} AttrResetBlockAttrsParams
 * @typedef {import('./index.d.ts').AttrResetBlockAttrsResponse} AttrResetBlockAttrsResponse
 * 重置指定块的若干属性。此操作通常用于删除属性，但需要提供属性的当前期望值进行匹配后才会执行。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AttrResetBlockAttrsParams} params - Request parameters.
 * @returns {Promise<AttrResetBlockAttrsResponse>}
 */
  resetBlockAttrs(params) {
    return this.fetcher('POST', '/api/attr/resetBlockAttrs', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AttrSetBlockAttrsParams} AttrSetBlockAttrsParams
 * @typedef {import('./index.d.ts').AttrSetBlockAttrsResponse} AttrSetBlockAttrsResponse
 * 为指定的单个块设置自定义属性。如果属性值为 null，则表示删除该属性。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AttrSetBlockAttrsParams} params - Request parameters.
 * @returns {Promise<AttrSetBlockAttrsResponse>}
 */
  setBlockAttrs(params) {
    return this.fetcher('POST', '/api/attr/setBlockAttrs', params, true);
  }

}
