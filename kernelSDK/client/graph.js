// Generated API client for group graph
export class GraphApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').GraphGetGraphParams} GraphGetGraphParams
 * @typedef {import('./index.d.ts').GraphGetGraphResponse} GraphGetGraphResponse
 * @typedef {import('./index.d.ts').GraphGetGraphParamsConf} GraphGetGraphParamsConf
 * 根据关键词和配置获取全局关系图的节点和边数据。
 * (Requires authentication)
 * @param {GraphGetGraphParams} params - Request parameters.
 * @returns {Promise<GraphGetGraphResponse>}
 */
  getGraph(params) {
    return this.fetcher('POST', '/api/graph/getGraph', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').GraphGetLocalGraphParams} GraphGetLocalGraphParams
 * @typedef {import('./index.d.ts').GraphGetLocalGraphResponse} GraphGetLocalGraphResponse
 * @typedef {import('./index.d.ts').GraphGetLocalGraphParamsConf} GraphGetLocalGraphParamsConf
 * 根据指定的文档 ID、关键词和配置获取局部关系图（如文档关系图、反链关系图等）的节点和边数据。
 * (Requires authentication)
 * @param {GraphGetLocalGraphParams} params - Request parameters.
 * @returns {Promise<GraphGetLocalGraphResponse>}
 */
  getLocalGraph(params) {
    return this.fetcher('POST', '/api/graph/getLocalGraph', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').GraphResetGraphResponse} GraphResetGraphResponse
 * 将全局关系图的配置恢复为默认设置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<GraphResetGraphResponse>}
 */
  resetGraph() {
    return this.fetcher('POST', '/api/graph/resetGraph', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').GraphResetLocalGraphResponse} GraphResetLocalGraphResponse
 * 将局部关系图的配置恢复为默认设置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<GraphResetLocalGraphResponse>}
 */
  resetLocalGraph() {
    return this.fetcher('POST', '/api/graph/resetLocalGraph', {}, true);
  }

}
