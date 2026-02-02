// Generated API client for group inbox
export class InboxApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').InboxGetShorthandParams} InboxGetShorthandParams
 * @typedef {import('./index.d.ts').InboxGetShorthandResponse} InboxGetShorthandResponse
 * 根据ID获取单个云端速记条目的详细内容。速记内容会从 Markdown 转换为 HTML。
 * (Requires authentication, Requires admin role)
 * @param {InboxGetShorthandParams} params - Request parameters.
 * @returns {Promise<InboxGetShorthandResponse>}
 */
  getShorthand(params) {
    return this.fetcher('POST', '/api/inbox/getShorthand', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').InboxGetShorthandsParams} InboxGetShorthandsParams
 * @typedef {import('./index.d.ts').InboxGetShorthandsResponse} InboxGetShorthandsResponse
 * 分页获取云端速记条目列表。速记内容会从 Markdown 转换为 HTML，描述会做简化处理。
 * (Requires authentication, Requires admin role)
 * @param {InboxGetShorthandsParams} params - Request parameters.
 * @returns {Promise<InboxGetShorthandsResponse>}
 */
  getShorthands(params) {
    return this.fetcher('POST', '/api/inbox/getShorthands', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').InboxRemoveShorthandsParams} InboxRemoveShorthandsParams
 * @typedef {import('./index.d.ts').InboxRemoveShorthandsResponse} InboxRemoveShorthandsResponse
 * 根据ID列表批量移除云端速记条目。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {InboxRemoveShorthandsParams} params - Request parameters.
 * @returns {Promise<InboxRemoveShorthandsResponse>}
 */
  removeShorthands(params) {
    return this.fetcher('POST', '/api/inbox/removeShorthands', params, true);
  }

}
