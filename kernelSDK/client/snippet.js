// Generated API client for group snippet
export class SnippetApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').SnippetGetSnippetParams} SnippetGetSnippetParams
 * @typedef {import('./index.d.ts').SnippetGetSnippetResponse} SnippetGetSnippetResponse
 * 获取已保存的代码片段列表。可以根据类型（js/css/all）、启用状态（0-禁用, 1-启用, 2-全部）和关键字进行过滤。
 * (Requires authentication)
 * @param {SnippetGetSnippetParams} params - Request parameters.
 * @returns {Promise<SnippetGetSnippetResponse>}
 */
  getSnippet(params) {
    return this.fetcher('POST', '/api/snippet/getSnippet', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SnippetSetSnippetParams} SnippetSetSnippetParams
 * @typedef {import('./index.d.ts').SnippetSetSnippetResponse} SnippetSetSnippetResponse
 * 设置全新的代码片段列表。这是一个全量替换操作，提供的 snippets 数组将完全覆盖当前所有的代码片段。如果只想修改或添加单个片段，需要先获取所有现有片段，在本地修改/添加后，将修改后的完整列表通过此API发送。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SnippetSetSnippetParams} params - Request parameters.
 * @returns {Promise<SnippetSetSnippetResponse>}
 */
  setSnippet(params) {
    return this.fetcher('POST', '/api/snippet/setSnippet', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SnippetRemoveSnippetParams} SnippetRemoveSnippetParams
 * @typedef {import('./index.d.ts').SnippetRemoveSnippetResponse} SnippetRemoveSnippetResponse
 * 根据ID移除指定的代码片段。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SnippetRemoveSnippetParams} params - Request parameters.
 * @returns {Promise<SnippetRemoveSnippetResponse>}
 */
  removeSnippet(params) {
    return this.fetcher('POST', '/api/snippet/removeSnippet', params, true);
  }

}
