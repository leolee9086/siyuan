// Generated API client for group filetree
export class FiletreeApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').FiletreeChangeSortParams} FiletreeChangeSortParams
 * @typedef {import('./index.d.ts').FiletreeChangeSortResponse} FiletreeChangeSortResponse
 * 更改指定笔记本下，特定路径列表的文档树排序方式。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeChangeSortParams} params - Request parameters.
 * @returns {Promise<FiletreeChangeSortResponse>}
 */
  changeSort(params) {
    return this.fetcher('POST', '/api/filetree/changeSort', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeCreateDailyNoteParams} FiletreeCreateDailyNoteParams
 * @typedef {import('./index.d.ts').FiletreeCreateDailyNoteResponse} FiletreeCreateDailyNoteResponse
 * 根据用户配置的日记模板创建今日的日记文档。如果今日的日记已存在，则直接返回该日记的信息。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeCreateDailyNoteParams} params - Request parameters.
 * @returns {Promise<FiletreeCreateDailyNoteResponse>}
 */
  createDailyNote(params) {
    return this.fetcher('POST', '/api/filetree/createDailyNote', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeCreateDocParams} FiletreeCreateDocParams
 * @typedef {import('./index.d.ts').FiletreeCreateDocResponse} FiletreeCreateDocResponse
 * 在指定的笔记本和路径下创建一个新的文档，并可以附带初始Markdown内容和排序信息。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeCreateDocParams} params - Request parameters.
 * @returns {Promise<FiletreeCreateDocResponse>}
 */
  createDoc(params) {
    return this.fetcher('POST', '/api/filetree/createDoc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeCreateDocWithMdParams} FiletreeCreateDocWithMdParams
 * @typedef {import('./index.d.ts').FiletreeCreateDocWithMdResponse} FiletreeCreateDocWithMdResponse
 * 在指定笔记本、路径下，使用提供的Markdown内容创建一个新文档。可以指定父文档ID、新文档ID、标签等。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeCreateDocWithMdParams} params - Request parameters.
 * @returns {Promise<FiletreeCreateDocWithMdResponse>}
 */
  createDocWithMd(params) {
    return this.fetcher('POST', '/api/filetree/createDocWithMd', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeDoc2HeadingParams} FiletreeDoc2HeadingParams
 * @typedef {import('./index.d.ts').FiletreeDoc2HeadingResponse} FiletreeDoc2HeadingResponse
 * 将一个源文档的内容转换为一个标题块，并将其插入到目标文档的指定标题块之后或之前。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeDoc2HeadingParams} params - Request parameters.
 * @returns {Promise<FiletreeDoc2HeadingResponse>}
 */
  doc2Heading(params) {
    return this.fetcher('POST', '/api/filetree/doc2Heading', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeDuplicateDocParams} FiletreeDuplicateDocParams
 * @typedef {import('./index.d.ts').FiletreeDuplicateDocResponse} FiletreeDuplicateDocResponse
 * 复制（克隆）一个指定的文档。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeDuplicateDocParams} params - Request parameters.
 * @returns {Promise<FiletreeDuplicateDocResponse>}
 */
  duplicateDoc(params) {
    return this.fetcher('POST', '/api/filetree/duplicateDoc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeGetDocParams} FiletreeGetDocParams
 * @typedef {import('./index.d.ts').FiletreeGetDocResponse} FiletreeGetDocResponse
 * 获取指定文档（或文档中的一部分内容）的详细信息，包括块内容、结构、属性等。支持多种加载模式和查询参数。
 * (Requires authentication)
 * @param {FiletreeGetDocParams} params - Request parameters.
 * @returns {Promise<FiletreeGetDocResponse>}
 */
  getDoc(params) {
    return this.fetcher('POST', '/api/filetree/getDoc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeGetDocCreateSavePathParams} FiletreeGetDocCreateSavePathParams
 * @typedef {import('./index.d.ts').FiletreeGetDocCreateSavePathResponse} FiletreeGetDocCreateSavePathResponse
 * 根据当前笔记本和全局配置，计算并返回创建新文档时应使用的默认笔记本ID和保存路径 (HPath)。路径支持Go模板。
 * (Requires authentication)
 * @param {FiletreeGetDocCreateSavePathParams} params - Request parameters.
 * @returns {Promise<FiletreeGetDocCreateSavePathResponse>}
 */
  getDocCreateSavePath(params) {
    return this.fetcher('POST', '/api/filetree/getDocCreateSavePath', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeGetFullHPathByIDParams} FiletreeGetFullHPathByIDParams
 * @typedef {import('./index.d.ts').FiletreeGetFullHPathByIDResponse} FiletreeGetFullHPathByIDResponse
 * 根据文档或块的ID，获取其在笔记本中的完整层级标题路径 (HPath)，例如 '/父文档标题/子文档标题/当前文档标题'。
 * (Requires authentication)
 * @param {FiletreeGetFullHPathByIDParams} params - Request parameters.
 * @returns {Promise<FiletreeGetFullHPathByIDResponse>}
 */
  getFullHPathByID(params) {
    return this.fetcher('POST', '/api/filetree/getFullHPathByID', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeGetHPathByIDParams} FiletreeGetHPathByIDParams
 * @typedef {import('./index.d.ts').FiletreeGetHPathByIDResponse} FiletreeGetHPathByIDResponse
 * 根据文档或块的ID，获取其在笔记本中的人类可读路径 (HPath)，即文件路径形式的标题路径，例如 '/父文档标题/子文档标题/当前文档标题.sy' 的 Sy 文件名部分。
 * (Requires authentication)
 * @param {FiletreeGetHPathByIDParams} params - Request parameters.
 * @returns {Promise<FiletreeGetHPathByIDResponse>}
 */
  getHPathByID(params) {
    return this.fetcher('POST', '/api/filetree/getHPathByID', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeGetHPathByPathParams} FiletreeGetHPathByPathParams
 * @typedef {import('./index.d.ts').FiletreeGetHPathByPathResponse} FiletreeGetHPathByPathResponse
 * 根据文档在笔记本中的实际存储路径 (相对于笔记本根目录)，获取其人类可读路径 (HPath)。
 * (Requires authentication)
 * @param {FiletreeGetHPathByPathParams} params - Request parameters.
 * @returns {Promise<FiletreeGetHPathByPathResponse>}
 */
  getHPathByPath(params) {
    return this.fetcher('POST', '/api/filetree/getHPathByPath', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeGetHPathsByPathsParams} FiletreeGetHPathsByPathsParams
 * @typedef {import('./index.d.ts').FiletreeGetHPathsByPathsResponse} FiletreeGetHPathsByPathsResponse
 * 根据一组文档的实际存储路径 (包含笔记本ID和文档相对路径)，批量获取它们对应的人类可读路径 (HPath)。
 * (Requires authentication)
 * @param {FiletreeGetHPathsByPathsParams} params - Request parameters.
 * @returns {Promise<FiletreeGetHPathsByPathsResponse>}
 */
  getHPathsByPaths(params) {
    return this.fetcher('POST', '/api/filetree/getHPathsByPaths', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeGetIDsByHPathParams} FiletreeGetIDsByHPathParams
 * @typedef {import('./index.d.ts').FiletreeGetIDsByHPathResponse} FiletreeGetIDsByHPathResponse
 * 根据文档的人类可读路径 (HPath) 和其所在的笔记本ID，获取所有匹配该路径的文档的ID列表。因为HPath可能不唯一，所以返回的是数组。
 * (Requires authentication)
 * @param {FiletreeGetIDsByHPathParams} params - Request parameters.
 * @returns {Promise<FiletreeGetIDsByHPathResponse>}
 */
  getIDsByHPath(params) {
    return this.fetcher('POST', '/api/filetree/getIDsByHPath', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeGetPathByIDParams} FiletreeGetPathByIDParams
 * @typedef {import('./index.d.ts').FiletreeGetPathByIDResponse} FiletreeGetPathByIDResponse
 * 根据文档或块的ID，获取其在工作空间中的实际存储路径 (相对于笔记本根目录) 和所在的笔记本ID。
 * (Requires authentication)
 * @param {FiletreeGetPathByIDParams} params - Request parameters.
 * @returns {Promise<FiletreeGetPathByIDResponse>}
 */
  getPathByID(params) {
    return this.fetcher('POST', '/api/filetree/getPathByID', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeGetRefCreateSavePathParams} FiletreeGetRefCreateSavePathParams
 * @typedef {import('./index.d.ts').FiletreeGetRefCreateSavePathResponse} FiletreeGetRefCreateSavePathResponse
 * 根据当前笔记本和全局配置，计算并返回创建新块引文档时应使用的默认笔记本ID和保存路径 (HPath)。路径支持Go模板。
 * (Requires authentication)
 * @param {FiletreeGetRefCreateSavePathParams} params - Request parameters.
 * @returns {Promise<FiletreeGetRefCreateSavePathResponse>}
 */
  getRefCreateSavePath(params) {
    return this.fetcher('POST', '/api/filetree/getRefCreateSavePath', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeHeading2DocParams} FiletreeHeading2DocParams
 * @typedef {import('./index.d.ts').FiletreeHeading2DocResponse} FiletreeHeading2DocResponse
 * 将源文档中的一个标题块及其后续同级内容，转换为一个新的独立文档。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeHeading2DocParams} params - Request parameters.
 * @returns {Promise<FiletreeHeading2DocResponse>}
 */
  heading2Doc(params) {
    return this.fetcher('POST', '/api/filetree/heading2Doc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeLi2DocParams} FiletreeLi2DocParams
 * @typedef {import('./index.d.ts').FiletreeLi2DocResponse} FiletreeLi2DocResponse
 * 将源文档中的一个列表项（及其所有子项）转换为一个新的独立文档。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeLi2DocParams} params - Request parameters.
 * @returns {Promise<FiletreeLi2DocResponse>}
 */
  li2Doc(params) {
    return this.fetcher('POST', '/api/filetree/li2Doc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeListDocTreeParams} FiletreeListDocTreeParams
 * @typedef {import('./index.d.ts').FiletreeListDocTreeResponse} FiletreeListDocTreeResponse
 * 列出指定笔记本的文档树结构，支持过滤、排序等。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeListDocTreeParams} params - Request parameters.
 * @returns {Promise<FiletreeListDocTreeResponse>}
 */
  listDocTree(params) {
    return this.fetcher('POST', '/api/filetree/listDocTree', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeListDocsByPathParams} FiletreeListDocsByPathParams
 * @typedef {import('./index.d.ts').FiletreeListDocsByPathResponse} FiletreeListDocsByPathResponse
 * 获取指定笔记本和路径下的文档及子文件夹列表，支持排序、闪卡过滤和数量限制。
 * (Requires authentication)
 * @param {FiletreeListDocsByPathParams} params - Request parameters.
 * @returns {Promise<FiletreeListDocsByPathResponse>}
 */
  listDocsByPath(params) {
    return this.fetcher('POST', '/api/filetree/listDocsByPath', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeMoveDocsParams} FiletreeMoveDocsParams
 * @typedef {import('./index.d.ts').FiletreeMoveDocsResponse} FiletreeMoveDocsResponse
 * 将一组源文档（通过其在各自笔记本中的相对路径指定）移动到目标笔记本的指定路径下。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeMoveDocsParams} params - Request parameters.
 * @returns {Promise<FiletreeMoveDocsResponse>}
 */
  moveDocs(params) {
    return this.fetcher('POST', '/api/filetree/moveDocs', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeMoveDocsByIDParams} FiletreeMoveDocsByIDParams
 * @typedef {import('./index.d.ts').FiletreeMoveDocsByIDResponse} FiletreeMoveDocsByIDResponse
 * 将一组源文档（通过其ID指定）移动到目标文档（通过其ID指定）的目录下或成为其子文档（取决于目标ID是文件夹还是文件）。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeMoveDocsByIDParams} params - Request parameters.
 * @returns {Promise<FiletreeMoveDocsByIDResponse>}
 */
  moveDocsByID(params) {
    return this.fetcher('POST', '/api/filetree/moveDocsByID', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeMoveLocalShorthandsParams} FiletreeMoveLocalShorthandsParams
 * @typedef {import('./index.d.ts').FiletreeMoveLocalShorthandsResponse} FiletreeMoveLocalShorthandsResponse
 * 将指定笔记本中的本地闪念速记（通常是未整理的、直接记录在本地的摘录或想法）移动到配置的闪念速记存放位置。这是一个待改进的旧接口，未来可能基于文档树配置实现。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeMoveLocalShorthandsParams} params - Request parameters.
 * @returns {Promise<FiletreeMoveLocalShorthandsResponse>}
 */
  moveLocalShorthands(params) {
    return this.fetcher('POST', '/api/filetree/moveLocalShorthands', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeRefreshFiletreeResponse} FiletreeRefreshFiletreeResponse
 * 触发一次全局的文档树刷新和全量索引重建。这是一个耗时操作，请谨慎调用。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<FiletreeRefreshFiletreeResponse>}
 */
  refreshFiletree() {
    return this.fetcher('POST', '/api/filetree/refreshFiletree', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeRemoveDocParams} FiletreeRemoveDocParams
 * @typedef {import('./index.d.ts').FiletreeRemoveDocResponse} FiletreeRemoveDocResponse
 * 根据指定的笔记本ID和文档相对路径，移除（删除）该文档。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeRemoveDocParams} params - Request parameters.
 * @returns {Promise<FiletreeRemoveDocResponse>}
 */
  removeDoc(params) {
    return this.fetcher('POST', '/api/filetree/removeDoc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeRemoveDocByIDParams} FiletreeRemoveDocByIDParams
 * @typedef {import('./index.d.ts').FiletreeRemoveDocByIDResponse} FiletreeRemoveDocByIDResponse
 * 根据指定的文档ID，移除（删除）该文档。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeRemoveDocByIDParams} params - Request parameters.
 * @returns {Promise<FiletreeRemoveDocByIDResponse>}
 */
  removeDocByID(params) {
    return this.fetcher('POST', '/api/filetree/removeDocByID', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeRemoveDocsParams} FiletreeRemoveDocsParams
 * @typedef {import('./index.d.ts').FiletreeRemoveDocsResponse} FiletreeRemoveDocsResponse
 * 根据一组复合路径（包含笔记本ID和文档相对路径）批量移除（删除）文档。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeRemoveDocsParams} params - Request parameters.
 * @returns {Promise<FiletreeRemoveDocsResponse>}
 */
  removeDocs(params) {
    return this.fetcher('POST', '/api/filetree/removeDocs', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeRemoveIndexesParams} FiletreeRemoveIndexesParams
 * @typedef {import('./index.d.ts').FiletreeRemoveIndexesResponse} FiletreeRemoveIndexesResponse
 * 根据指定的文档路径列表（通常是 .sy 文件路径），从搜索引擎中移除这些文档的索引。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeRemoveIndexesParams} params - Request parameters.
 * @returns {Promise<FiletreeRemoveIndexesResponse>}
 */
  removeIndexes(params) {
    return this.fetcher('POST', '/api/filetree/removeIndexes', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeRenameDocParams} FiletreeRenameDocParams
 * @typedef {import('./index.d.ts').FiletreeRenameDocResponse} FiletreeRenameDocResponse
 * 根据指定的笔记本ID、旧文档相对路径和新标题，重命名该文档。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeRenameDocParams} params - Request parameters.
 * @returns {Promise<FiletreeRenameDocResponse>}
 */
  renameDoc(params) {
    return this.fetcher('POST', '/api/filetree/renameDoc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeRenameDocByIDParams} FiletreeRenameDocByIDParams
 * @typedef {import('./index.d.ts').FiletreeRenameDocByIDResponse} FiletreeRenameDocByIDResponse
 * 根据指定的文档ID和新标题，重命名该文档。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeRenameDocByIDParams} params - Request parameters.
 * @returns {Promise<FiletreeRenameDocByIDResponse>}
 */
  renameDocByID(params) {
    return this.fetcher('POST', '/api/filetree/renameDocByID', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeSearchDocsParams} FiletreeSearchDocsParams
 * @typedef {import('./index.d.ts').FiletreeSearchDocsResponse} FiletreeSearchDocsResponse
 * 根据关键词搜索匹配的文档标题和别名。主要用于快速查找文档，不支持全文搜索。
 * (Requires authentication)
 * @param {FiletreeSearchDocsParams} params - Request parameters.
 * @returns {Promise<FiletreeSearchDocsResponse>}
 */
  searchDocs(params) {
    return this.fetcher('POST', '/api/filetree/searchDocs', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FiletreeUpsertIndexesParams} FiletreeUpsertIndexesParams
 * @typedef {import('./index.d.ts').FiletreeUpsertIndexesResponse} FiletreeUpsertIndexesResponse
 * 根据指定的文档路径列表（通常是 .sy 文件路径），更新或插入这些文档在搜索引擎中的索引。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FiletreeUpsertIndexesParams} params - Request parameters.
 * @returns {Promise<FiletreeUpsertIndexesResponse>}
 */
  upsertIndexes(params) {
    return this.fetcher('POST', '/api/filetree/upsertIndexes', params, true);
  }

}
