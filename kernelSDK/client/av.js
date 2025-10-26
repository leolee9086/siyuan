// Generated API client for group av
export class AvApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').AvAddAttributeViewBlocksParams} AvAddAttributeViewBlocksParams
 * @typedef {import('./index.d.ts').AvAddAttributeViewBlocksResponse} AvAddAttributeViewBlocksResponse
 * 向指定的属性视图中添加一个或多个数据块。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvAddAttributeViewBlocksParams} params - Request parameters.
 * @returns {Promise<AvAddAttributeViewBlocksResponse>}
 */
  addAttributeViewBlocks(params) {
    return this.fetcher('POST', '/api/av/addAttributeViewBlocks', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvAddAttributeViewKeyParams} AvAddAttributeViewKeyParams
 * @typedef {import('./index.d.ts').AvAddAttributeViewKeyResponse} AvAddAttributeViewKeyResponse
 * 向指定的属性视图添加一个新的列定义。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvAddAttributeViewKeyParams} params - Request parameters.
 * @returns {Promise<AvAddAttributeViewKeyResponse>}
 */
  addAttributeViewKey(params) {
    return this.fetcher('POST', '/api/av/addAttributeViewKey', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvAppendAttributeViewDetachedBlocksWithValuesParams} AvAppendAttributeViewDetachedBlocksWithValuesParams
 * @typedef {import('./index.d.ts').AvAppendAttributeViewDetachedBlocksWithValuesResponse} AvAppendAttributeViewDetachedBlocksWithValuesResponse
 * 向属性视图追加多个新的独立块，并为这些块设置初始值。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvAppendAttributeViewDetachedBlocksWithValuesParams} params - Request parameters.
 * @returns {Promise<AvAppendAttributeViewDetachedBlocksWithValuesResponse>}
 */
  appendAttributeViewDetachedBlocksWithValues(params) {
    return this.fetcher('POST', '/api/av/appendAttributeViewDetachedBlocksWithValues', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvDuplicateAttributeViewBlockParams} AvDuplicateAttributeViewBlockParams
 * @typedef {import('./index.d.ts').AvDuplicateAttributeViewBlockResponse} AvDuplicateAttributeViewBlockResponse
 * 复制一个属性视图块（数据库块）。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvDuplicateAttributeViewBlockParams} params - Request parameters.
 * @returns {Promise<AvDuplicateAttributeViewBlockResponse>}
 */
  duplicateAttributeViewBlock(params) {
    return this.fetcher('POST', '/api/av/duplicateAttributeViewBlock', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvGetAttributeViewParams} AvGetAttributeViewParams
 * @typedef {import('./index.d.ts').AvGetAttributeViewResponse} AvGetAttributeViewResponse
 * 获取指定ID的属性视图的详细信息。
 * (Requires authentication, Unavailable in read-only mode)
 * @param {AvGetAttributeViewParams} params - Request parameters.
 * @returns {Promise<AvGetAttributeViewResponse>}
 */
  getAttributeView(params) {
    return this.fetcher('POST', '/api/av/getAttributeView', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvGetAttributeViewFilterSortParams} AvGetAttributeViewFilterSortParams
 * @typedef {import('./index.d.ts').AvGetAttributeViewFilterSortResponse} AvGetAttributeViewFilterSortResponse
 * 获取指定属性视图（或其关联块）的筛选条件和排序规则。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvGetAttributeViewFilterSortParams} params - Request parameters.
 * @returns {Promise<AvGetAttributeViewFilterSortResponse>}
 */
  getAttributeViewFilterSort(params) {
    return this.fetcher('POST', '/api/av/getAttributeViewFilterSort', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvGetAttributeViewKeysParams} AvGetAttributeViewKeysParams
 * @typedef {import('./index.d.ts').AvGetAttributeViewKeysResponse} AvGetAttributeViewKeysResponse
 * 获取指定属性视图ID的所有列定义 (keys)。
 * (Requires authentication)
 * @param {AvGetAttributeViewKeysParams} params - Request parameters.
 * @returns {Promise<AvGetAttributeViewKeysResponse>}
 */
  getAttributeViewKeys(params) {
    return this.fetcher('POST', '/api/av/getAttributeViewKeys', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvGetAttributeViewKeysByAvIDParams} AvGetAttributeViewKeysByAvIDParams
 * @typedef {import('./index.d.ts').AvGetAttributeViewKeysByAvIDResponse} AvGetAttributeViewKeysByAvIDResponse
 * 通过属性视图ID获取其所有列定义 (keys)。(此接口功能上可能与 getAttributeViewKeys 重复，需确认)
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvGetAttributeViewKeysByAvIDParams} params - Request parameters.
 * @returns {Promise<AvGetAttributeViewKeysByAvIDResponse>}
 */
  getAttributeViewKeysByAvID(params) {
    return this.fetcher('POST', '/api/av/getAttributeViewKeysByAvID', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvGetAttributeViewPrimaryKeyValuesParams} AvGetAttributeViewPrimaryKeyValuesParams
 * @typedef {import('./index.d.ts').AvGetAttributeViewPrimaryKeyValuesResponse} AvGetAttributeViewPrimaryKeyValuesResponse
 * 获取指定属性视图的主键列的值，支持分页和关键词搜索。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvGetAttributeViewPrimaryKeyValuesParams} params - Request parameters.
 * @returns {Promise<AvGetAttributeViewPrimaryKeyValuesResponse>}
 */
  getAttributeViewPrimaryKeyValues(params) {
    return this.fetcher('POST', '/api/av/getAttributeViewPrimaryKeyValues', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvGetMirrorDatabaseBlocksParams} AvGetMirrorDatabaseBlocksParams
 * @typedef {import('./index.d.ts').AvGetMirrorDatabaseBlocksResponse} AvGetMirrorDatabaseBlocksResponse
 * 获取指定属性视图ID的镜像数据库块ID列表。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvGetMirrorDatabaseBlocksParams} params - Request parameters.
 * @returns {Promise<AvGetMirrorDatabaseBlocksResponse>}
 */
  getMirrorDatabaseBlocks(params) {
    return this.fetcher('POST', '/api/av/getMirrorDatabaseBlocks', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvRemoveAttributeViewBlocksParams} AvRemoveAttributeViewBlocksParams
 * @typedef {import('./index.d.ts').AvRemoveAttributeViewBlocksResponse} AvRemoveAttributeViewBlocksResponse
 * 从指定的属性视图中移除一个或多个数据块。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvRemoveAttributeViewBlocksParams} params - Request parameters.
 * @returns {Promise<AvRemoveAttributeViewBlocksResponse>}
 */
  removeAttributeViewBlocks(params) {
    return this.fetcher('POST', '/api/av/removeAttributeViewBlocks', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvRemoveAttributeViewKeyParams} AvRemoveAttributeViewKeyParams
 * @typedef {import('./index.d.ts').AvRemoveAttributeViewKeyResponse} AvRemoveAttributeViewKeyResponse
 * 从指定的属性视图移除一个列定义。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvRemoveAttributeViewKeyParams} params - Request parameters.
 * @returns {Promise<AvRemoveAttributeViewKeyResponse>}
 */
  removeAttributeViewKey(params) {
    return this.fetcher('POST', '/api/av/removeAttributeViewKey', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvRenderAttributeViewParams} AvRenderAttributeViewParams
 * @typedef {import('./index.d.ts').AvRenderAttributeViewResponse} AvRenderAttributeViewResponse
 * 渲染属性视图，获取其名称、视图类型、视图ID、所有视图、当前视图详情以及是否为镜像等信息。
 * (Requires authentication)
 * @param {AvRenderAttributeViewParams} params - Request parameters.
 * @returns {Promise<AvRenderAttributeViewResponse>}
 */
  renderAttributeView(params) {
    return this.fetcher('POST', '/api/av/renderAttributeView', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvRenderHistoryAttributeViewParams} AvRenderHistoryAttributeViewParams
 * @typedef {import('./index.d.ts').AvRenderHistoryAttributeViewResponse} AvRenderHistoryAttributeViewResponse
 * 渲染指定历史版本的属性视图。
 * (Requires authentication, Requires admin role)
 * @param {AvRenderHistoryAttributeViewParams} params - Request parameters.
 * @returns {Promise<AvRenderHistoryAttributeViewResponse>}
 */
  renderHistoryAttributeView(params) {
    return this.fetcher('POST', '/api/av/renderHistoryAttributeView', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvRenderSnapshotAttributeViewParams} AvRenderSnapshotAttributeViewParams
 * @typedef {import('./index.d.ts').AvRenderSnapshotAttributeViewResponse} AvRenderSnapshotAttributeViewResponse
 * 渲染指定快照索引的属性视图。
 * (Requires authentication, Requires admin role)
 * @param {AvRenderSnapshotAttributeViewParams} params - Request parameters.
 * @returns {Promise<AvRenderSnapshotAttributeViewResponse>}
 */
  renderSnapshotAttributeView(params) {
    return this.fetcher('POST', '/api/av/renderSnapshotAttributeView', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvSearchAttributeViewParams} AvSearchAttributeViewParams
 * @typedef {import('./index.d.ts').AvSearchAttributeViewResponse} AvSearchAttributeViewResponse
 * 根据关键词搜索属性视图，可排除指定ID。
 * (Requires authentication, Unavailable in read-only mode)
 * @param {AvSearchAttributeViewParams} params - Request parameters.
 * @returns {Promise<AvSearchAttributeViewResponse>}
 */
  searchAttributeView(params) {
    return this.fetcher('POST', '/api/av/searchAttributeView', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvSearchAttributeViewNonRelationKeyParams} AvSearchAttributeViewNonRelationKeyParams
 * @typedef {import('./index.d.ts').AvSearchAttributeViewNonRelationKeyResponse} AvSearchAttributeViewNonRelationKeyResponse
 * 根据关键词搜索指定属性视图的非关联列 (Non-relation Key)。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvSearchAttributeViewNonRelationKeyParams} params - Request parameters.
 * @returns {Promise<AvSearchAttributeViewNonRelationKeyResponse>}
 */
  searchAttributeViewNonRelationKey(params) {
    return this.fetcher('POST', '/api/av/searchAttributeViewNonRelationKey', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvSearchAttributeViewRelationKeyParams} AvSearchAttributeViewRelationKeyParams
 * @typedef {import('./index.d.ts').AvSearchAttributeViewRelationKeyResponse} AvSearchAttributeViewRelationKeyResponse
 * 根据关键词搜索指定属性视图的关联列 (Relation Key)。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvSearchAttributeViewRelationKeyParams} params - Request parameters.
 * @returns {Promise<AvSearchAttributeViewRelationKeyResponse>}
 */
  searchAttributeViewRelationKey(params) {
    return this.fetcher('POST', '/api/av/searchAttributeViewRelationKey', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvSetAttributeViewBlockAttrParams} AvSetAttributeViewBlockAttrParams
 * @typedef {import('./index.d.ts').AvSetAttributeViewBlockAttrResponse} AvSetAttributeViewBlockAttrResponse
 * 更新属性视图中指定行（块ID）、指定列（KeyID）的单元格的值。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvSetAttributeViewBlockAttrParams} params - Request parameters.
 * @returns {Promise<AvSetAttributeViewBlockAttrResponse>}
 */
  setAttributeViewBlockAttr(params) {
    return this.fetcher('POST', '/api/av/setAttributeViewBlockAttr', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvSetDatabaseBlockViewParams} AvSetDatabaseBlockViewParams
 * @typedef {import('./index.d.ts').AvSetDatabaseBlockViewResponse} AvSetDatabaseBlockViewResponse
 * 设置指定数据库块（属性视图块）的默认视图ID。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvSetDatabaseBlockViewParams} params - Request parameters.
 * @returns {Promise<AvSetDatabaseBlockViewResponse>}
 */
  setDatabaseBlockView(params) {
    return this.fetcher('POST', '/api/av/setDatabaseBlockView', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvSortAttributeViewKeyParams} AvSortAttributeViewKeyParams
 * @typedef {import('./index.d.ts').AvSortAttributeViewKeyResponse} AvSortAttributeViewKeyResponse
 * 对属性视图的列进行排序。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvSortAttributeViewKeyParams} params - Request parameters.
 * @returns {Promise<AvSortAttributeViewKeyResponse>}
 */
  sortAttributeViewKey(params) {
    return this.fetcher('POST', '/api/av/sortAttributeViewKey', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AvSortAttributeViewViewKeyParams} AvSortAttributeViewViewKeyParams
 * @typedef {import('./index.d.ts').AvSortAttributeViewViewKeyResponse} AvSortAttributeViewViewKeyResponse
 * 对属性视图中某个特定视图（如图表、看板等）的列进行排序。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AvSortAttributeViewViewKeyParams} params - Request parameters.
 * @returns {Promise<AvSortAttributeViewViewKeyResponse>}
 */
  sortAttributeViewViewKey(params) {
    return this.fetcher('POST', '/api/av/sortAttributeViewViewKey', params, true);
  }

}
