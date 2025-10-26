// Generated API client for group search
export class SearchApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').SearchFindReplaceParams} SearchFindReplaceParams
 * @typedef {import('./index.d.ts').SearchFindReplaceResponse} SearchFindReplaceResponse
 * 在指定的块ID范围、路径、笔记本、类型中查找内容并进行替换。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SearchFindReplaceParams} params - Request parameters.
 * @returns {Promise<SearchFindReplaceResponse>}
 */
  findReplace(params) {
    return this.fetcher('POST', '/api/search/findReplace', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchFullTextSearchAssetContentParams} SearchFullTextSearchAssetContentParams
 * @typedef {import('./index.d.ts').SearchFullTextSearchAssetContentResponse} SearchFullTextSearchAssetContentResponse
 * 对资源文件内容进行全文搜索（此功能需要付费订阅）。
 * (Requires authentication)
 * @param {SearchFullTextSearchAssetContentParams} params - Request parameters.
 * @returns {Promise<SearchFullTextSearchAssetContentResponse>}
 */
  fullTextSearchAssetContent(params) {
    return this.fetcher('POST', '/api/search/fullTextSearchAssetContent', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchFullTextSearchBlockParams} SearchFullTextSearchBlockParams
 * @typedef {import('./index.d.ts').SearchFullTextSearchBlockResponse} SearchFullTextSearchBlockResponse
 * 对块内容进行全文搜索，支持多种搜索方式和过滤条件。
 * (Requires authentication)
 * @param {SearchFullTextSearchBlockParams} params - Request parameters.
 * @returns {Promise<SearchFullTextSearchBlockResponse>}
 */
  fullTextSearchBlock(params) {
    return this.fetcher('POST', '/api/search/fullTextSearchBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchGetAssetContentParams} SearchGetAssetContentParams
 * @typedef {import('./index.d.ts').SearchGetAssetContentResponse} SearchGetAssetContentResponse
 * 获取资源文件内容中，与指定查询相关的片段。
 * (Requires authentication)
 * @param {SearchGetAssetContentParams} params - Request parameters.
 * @returns {Promise<SearchGetAssetContentResponse>}
 */
  getAssetContent(params) {
    return this.fetcher('POST', '/api/search/getAssetContent', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchGetEmbedBlockParams} SearchGetEmbedBlockParams
 * @typedef {import('./index.d.ts').SearchGetEmbedBlockResponse} SearchGetEmbedBlockResponse
 * 获取指定嵌入块的渲染内容，支持包含其子块或显示面包屑。
 * (Requires authentication)
 * @param {SearchGetEmbedBlockParams} params - Request parameters.
 * @returns {Promise<SearchGetEmbedBlockResponse>}
 */
  getEmbedBlock(params) {
    return this.fetcher('POST', '/api/search/getEmbedBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchListInvalidBlockRefsParams} SearchListInvalidBlockRefsParams
 * @typedef {import('./index.d.ts').SearchListInvalidBlockRefsResponse} SearchListInvalidBlockRefsResponse
 * 分页列出在当前工作空间中所有无效的块引用（例如，引用的块已被删除）。
 * (Requires authentication)
 * @param {SearchListInvalidBlockRefsParams} params - Request parameters.
 * @returns {Promise<SearchListInvalidBlockRefsResponse>}
 */
  listInvalidBlockRefs(params) {
    return this.fetcher('POST', '/api/search/listInvalidBlockRefs', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchRemoveTemplateParams} SearchRemoveTemplateParams
 * @typedef {import('./index.d.ts').SearchRemoveTemplateResponse} SearchRemoveTemplateResponse
 * 根据路径移除指定的模板文件。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SearchRemoveTemplateParams} params - Request parameters.
 * @returns {Promise<SearchRemoveTemplateResponse>}
 */
  removeTemplate(params) {
    return this.fetcher('POST', '/api/search/removeTemplate', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchSearchAssetParams} SearchSearchAssetParams
 * @typedef {import('./index.d.ts').SearchSearchAssetResponse} SearchSearchAssetResponse
 * 根据文件名关键词和可选的文件扩展名搜索资源文件。
 * (Requires authentication)
 * @param {SearchSearchAssetParams} params - Request parameters.
 * @returns {Promise<SearchSearchAssetResponse>}
 */
  searchAsset(params) {
    return this.fetcher('POST', '/api/search/searchAsset', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchSearchEmbedBlockParams} SearchSearchEmbedBlockParams
 * @typedef {import('./index.d.ts').SearchSearchEmbedBlockResponse} SearchSearchEmbedBlockResponse
 * 在指定的嵌入块（及其可能的子块）中使用 SQL 语句进行内容搜索。
 * (Requires authentication)
 * @param {SearchSearchEmbedBlockParams} params - Request parameters.
 * @returns {Promise<SearchSearchEmbedBlockResponse>}
 */
  searchEmbedBlock(params) {
    return this.fetcher('POST', '/api/search/searchEmbedBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchSearchRefBlockParams} SearchSearchRefBlockParams
 * @typedef {import('./index.d.ts').SearchSearchRefBlockResponse} SearchSearchRefBlockResponse
 * 在输入引用（例如 `((` 或 `[[`）时，根据关键词动态搜索可能的引用块建议。
 * (Requires authentication)
 * @param {SearchSearchRefBlockParams} params - Request parameters.
 * @returns {Promise<SearchSearchRefBlockResponse>}
 */
  searchRefBlock(params) {
    return this.fetcher('POST', '/api/search/searchRefBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchSearchTagParams} SearchSearchTagParams
 * @typedef {import('./index.d.ts').SearchSearchTagResponse} SearchSearchTagResponse
 * 根据关键词搜索已存在的标签。
 * (Requires authentication)
 * @param {SearchSearchTagParams} params - Request parameters.
 * @returns {Promise<SearchSearchTagResponse>}
 */
  searchTag(params) {
    return this.fetcher('POST', '/api/search/searchTag', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchSearchTemplateParams} SearchSearchTemplateParams
 * @typedef {import('./index.d.ts').SearchSearchTemplateResponse} SearchSearchTemplateResponse
 * 根据关键词搜索模板（通常是模板文件名或内容）。
 * (Requires authentication)
 * @param {SearchSearchTemplateParams} params - Request parameters.
 * @returns {Promise<SearchSearchTemplateResponse>}
 */
  searchTemplate(params) {
    return this.fetcher('POST', '/api/search/searchTemplate', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchSearchWidgetParams} SearchSearchWidgetParams
 * @typedef {import('./index.d.ts').SearchSearchWidgetResponse} SearchSearchWidgetResponse
 * 根据关键词搜索挂件块。
 * (Requires authentication)
 * @param {SearchSearchWidgetParams} params - Request parameters.
 * @returns {Promise<SearchSearchWidgetResponse>}
 */
  searchWidget(params) {
    return this.fetcher('POST', '/api/search/searchWidget', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SearchUpdateEmbedBlockParams} SearchUpdateEmbedBlockParams
 * @typedef {import('./index.d.ts').SearchUpdateEmbedBlockResponse} SearchUpdateEmbedBlockResponse
 * 更新指定**查询嵌入块（`query_embed` 类型）**的原始查询语句或脚本内容。此接口专门用于处理查询嵌入块，不适用于普通块的自定义属性更新。
 * (Requires authentication)
 * @param {SearchUpdateEmbedBlockParams} params - Request parameters.
 * @returns {Promise<SearchUpdateEmbedBlockResponse>}
 */
  updateEmbedBlock(params) {
    return this.fetcher('POST', '/api/search/updateEmbedBlock', params, true);
  }

}
