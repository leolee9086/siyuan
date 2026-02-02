// Generated API client for group tag
export class TagApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').TagGetTagParams} TagGetTagParams
 * @typedef {import('./index.d.ts').TagGetTagResponse} TagGetTagResponse
 * 获取当前工作空间的所有标签列表。可以提供一个可选的排序参数来即时更新并应用全局标签排序设置。
 * (Requires authentication)
 * @param {TagGetTagParams} params - Request parameters.
 * @returns {Promise<TagGetTagResponse>}
 */
  getTag(params) {
    return this.fetcher('POST', '/api/tag/getTag', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').TagRemoveTagParams} TagRemoveTagParams
 * @typedef {import('./index.d.ts').TagRemoveTagResponse} TagRemoveTagResponse
 * 根据标签名称移除一个标签。这会从所有关联的块中移除该标签。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {TagRemoveTagParams} params - Request parameters.
 * @returns {Promise<TagRemoveTagResponse>}
 */
  removeTag(params) {
    return this.fetcher('POST', '/api/tag/removeTag', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').TagRenameTagParams} TagRenameTagParams
 * @typedef {import('./index.d.ts').TagRenameTagResponse} TagRenameTagResponse
 * 将一个旧标签名称重命名为一个新标签名称。所有关联块中的标签引用都会被更新。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {TagRenameTagParams} params - Request parameters.
 * @returns {Promise<TagRenameTagResponse>}
 */
  renameTag(params) {
    return this.fetcher('POST', '/api/tag/renameTag', params, true);
  }

}
