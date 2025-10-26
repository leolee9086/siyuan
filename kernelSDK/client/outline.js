// Generated API client for group outline
export class OutlineApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').OutlineGetDocOutlineParams} OutlineGetDocOutlineParams
 * @typedef {import('./index.d.ts').OutlineGetDocOutlineResponse} OutlineGetDocOutlineResponse
 * 获取指定文档块（通常是文档的根块ID）的层级大纲结构。
 * (Requires authentication)
 * @param {OutlineGetDocOutlineParams} params - Request parameters.
 * @returns {Promise<OutlineGetDocOutlineResponse>}
 */
  getDocOutline(params) {
    return this.fetcher('POST', '/api/outline/getDocOutline', params, true);
  }

}
