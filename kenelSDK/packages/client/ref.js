// Generated API client for group ref
export class RefApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').RefGetBacklinkParams} RefGetBacklinkParams
 * @typedef {import('./index.d.ts').RefGetBacklinkResponse} RefGetBacklinkResponse
 * 获取指定块ID的反向链接和反向提及列表。此接口为旧版，建议使用 /api/ref/getBacklink2。
 * (Requires authentication)
 * @param {RefGetBacklinkParams} params - Request parameters.
 * @returns {Promise<RefGetBacklinkResponse>}
 */
  getBacklink(params) {
    return this.fetcher('POST', '/api/ref/getBacklink', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RefGetBacklink2Params} RefGetBacklink2Params
 * @typedef {import('./index.d.ts').RefGetBacklink2Response} RefGetBacklink2Response
 * 获取指定块ID的反向链接和反向提及列表，支持排序。
 * (Requires authentication)
 * @param {RefGetBacklink2Params} params - Request parameters.
 * @returns {Promise<RefGetBacklink2Response>}
 */
  getBacklink2(params) {
    return this.fetcher('POST', '/api/ref/getBacklink2', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RefGetBacklinkDocParams} RefGetBacklinkDocParams
 * @typedef {import('./index.d.ts').RefGetBacklinkDocResponse} RefGetBacklinkDocResponse
 * 获取指定 定义块 在某个特定 文档树 内的反向链接列表。用于在打开一个文档时，显示该文档中有哪些块引用了当前面板的文档。
 * (Requires authentication)
 * @param {RefGetBacklinkDocParams} params - Request parameters.
 * @returns {Promise<RefGetBacklinkDocResponse>}
 */
  getBacklinkDoc(params) {
    return this.fetcher('POST', '/api/ref/getBacklinkDoc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RefGetBackmentionDocParams} RefGetBackmentionDocParams
 * @typedef {import('./index.d.ts').RefGetBackmentionDocResponse} RefGetBackmentionDocResponse
 * 获取指定 定义块 在某个特定 文档树 内的反向提及列表 (提及了定义块的名称或别名，但未直接引用的块)。
 * (Requires authentication)
 * @param {RefGetBackmentionDocParams} params - Request parameters.
 * @returns {Promise<RefGetBackmentionDocResponse>}
 */
  getBackmentionDoc(params) {
    return this.fetcher('POST', '/api/ref/getBackmentionDoc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RefRefreshBacklinkParams} RefRefreshBacklinkParams
 * @typedef {import('./index.d.ts').RefRefreshBacklinkResponse} RefRefreshBacklinkResponse
 * 手动触发指定块的反向链接和提及关系的刷新计算。通常在数据发生变更后，系统会自动更新，但此接口可用于强制刷新。
 * (Requires authentication)
 * @param {RefRefreshBacklinkParams} params - Request parameters.
 * @returns {Promise<RefRefreshBacklinkResponse>}
 */
  refreshBacklink(params) {
    return this.fetcher('POST', '/api/ref/refreshBacklink', params, true);
  }

}
