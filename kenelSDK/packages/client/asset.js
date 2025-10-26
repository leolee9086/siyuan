// Generated API client for group asset
export class AssetApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').AssetFullReindexAssetContentResponse} AssetFullReindexAssetContentResponse
 * 完全重新索引工作空间中所有资源文件的内容，用于搜索。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<AssetFullReindexAssetContentResponse>}
 */
  fullReindexAssetContent() {
    return this.fetcher('POST', '/api/asset/fullReindexAssetContent', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetGetDocAssetsParams} AssetGetDocAssetsParams
 * @typedef {import('./index.d.ts').AssetGetDocAssetsResponse} AssetGetDocAssetsResponse
 * 获取指定文档块所引用的所有资源文件列表。
 * (Requires authentication)
 * @param {AssetGetDocAssetsParams} params - Request parameters.
 * @returns {Promise<AssetGetDocAssetsResponse>}
 */
  getDocAssets(params) {
    return this.fetcher('POST', '/api/asset/getDocAssets', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetGetDocImageAssetsParams} AssetGetDocImageAssetsParams
 * @typedef {import('./index.d.ts').AssetGetDocImageAssetsResponse} AssetGetDocImageAssetsResponse
 * 获取指定文档块所引用的所有图片类型资源文件列表。
 * (Requires authentication)
 * @param {AssetGetDocImageAssetsParams} params - Request parameters.
 * @returns {Promise<AssetGetDocImageAssetsResponse>}
 */
  getDocImageAssets(params) {
    return this.fetcher('POST', '/api/asset/getDocImageAssets', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetGetFileAnnotationParams} AssetGetFileAnnotationParams
 * @typedef {import('./index.d.ts').AssetGetFileAnnotationResponse} AssetGetFileAnnotationResponse
 * 获取指定资源文件的标注信息（通常是 XFDF 格式的 PDF 标注）。
 * (Requires authentication)
 * @param {AssetGetFileAnnotationParams} params - Request parameters.
 * @returns {Promise<AssetGetFileAnnotationResponse>}
 */
  getFileAnnotation(params) {
    return this.fetcher('POST', '/api/asset/getFileAnnotation', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetGetImageOCRTextParams} AssetGetImageOCRTextParams
 * @typedef {import('./index.d.ts').AssetGetImageOCRTextResponse} AssetGetImageOCRTextResponse
 * 获取指定图片资源文件后台 OCR 识别的文本内容。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AssetGetImageOCRTextParams} params - Request parameters.
 * @returns {Promise<AssetGetImageOCRTextResponse>}
 */
  getImageOCRText(params) {
    return this.fetcher('POST', '/api/asset/getImageOCRText', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetGetMissingAssetsResponse} AssetGetMissingAssetsResponse
 * 获取所有在文档中被引用但实际资源文件已不存在的资源路径列表。
 * (Requires authentication)
 * @returns {Promise<AssetGetMissingAssetsResponse>}
 */
  getMissingAssets() {
    return this.fetcher('POST', '/api/asset/getMissingAssets', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetGetUnusedAssetsResponse} AssetGetUnusedAssetsResponse
 * 获取工作空间中存在但未被任何文档引用的资源文件列表（最多返回512条）。
 * (Requires authentication)
 * @returns {Promise<AssetGetUnusedAssetsResponse>}
 */
  getUnusedAssets() {
    return this.fetcher('POST', '/api/asset/getUnusedAssets', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetInsertLocalAssetsParams} AssetInsertLocalAssetsParams
 * @typedef {import('./index.d.ts').AssetInsertLocalAssetsResponse} AssetInsertLocalAssetsResponse
 * 将指定的本地文件复制到当前笔记本的 assets 文件夹中，并在指定文档中插入对这些资源的引用。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AssetInsertLocalAssetsParams} params - Request parameters.
 * @returns {Promise<AssetInsertLocalAssetsResponse>}
 */
  insertLocalAssets(params) {
    return this.fetcher('POST', '/api/asset/insertLocalAssets', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetOcrParams} AssetOcrParams
 * @typedef {import('./index.d.ts').AssetOcrResponse} AssetOcrResponse
 * 对指定的图片资源文件执行光学字符识别，并返回识别出的文本及原始 OCR 结果。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AssetOcrParams} params - Request parameters.
 * @returns {Promise<AssetOcrResponse>}
 */
  ocr(params) {
    return this.fetcher('POST', '/api/asset/ocr', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetRemoveUnusedAssetParams} AssetRemoveUnusedAssetParams
 * @typedef {import('./index.d.ts').AssetRemoveUnusedAssetResponse} AssetRemoveUnusedAssetResponse
 * 删除工作空间中指定的单个未使用（未被任何文档引用）的资源文件。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AssetRemoveUnusedAssetParams} params - Request parameters.
 * @returns {Promise<AssetRemoveUnusedAssetResponse>}
 */
  removeUnusedAsset(params) {
    return this.fetcher('POST', '/api/asset/removeUnusedAsset', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetRemoveUnusedAssetsResponse} AssetRemoveUnusedAssetsResponse
 * 删除工作空间中所有未被任何文档引用的资源文件。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<AssetRemoveUnusedAssetsResponse>}
 */
  removeUnusedAssets() {
    return this.fetcher('POST', '/api/asset/removeUnusedAssets', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetRenameAssetParams} AssetRenameAssetParams
 * @typedef {import('./index.d.ts').AssetRenameAssetResponse} AssetRenameAssetResponse
 * 重命名指定的资源文件，并自动更新所有文档中对该资源的引用。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AssetRenameAssetParams} params - Request parameters.
 * @returns {Promise<AssetRenameAssetResponse>}
 */
  renameAsset(params) {
    return this.fetcher('POST', '/api/asset/renameAsset', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetResolveAssetPathParams} AssetResolveAssetPathParams
 * @typedef {import('./index.d.ts').AssetResolveAssetPathResponse} AssetResolveAssetPathResponse
 * 将资源文件在思源笔记中的相对路径（如 'assets/image.png'）转换为其在文件系统中的绝对路径。
 * (Requires authentication)
 * @param {AssetResolveAssetPathParams} params - Request parameters.
 * @returns {Promise<AssetResolveAssetPathResponse>}
 */
  resolveAssetPath(params) {
    return this.fetcher('POST', '/api/asset/resolveAssetPath', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetSetFileAnnotationParams} AssetSetFileAnnotationParams
 * @typedef {import('./index.d.ts').AssetSetFileAnnotationResponse} AssetSetFileAnnotationResponse
 * 为指定的资源文件（通常是 PDF）保存或更新其标注信息（通常是 XFDF 格式）。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AssetSetFileAnnotationParams} params - Request parameters.
 * @returns {Promise<AssetSetFileAnnotationResponse>}
 */
  setFileAnnotation(params) {
    return this.fetcher('POST', '/api/asset/setFileAnnotation', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetSetImageOCRTextParams} AssetSetImageOCRTextParams
 * @typedef {import('./index.d.ts').AssetSetImageOCRTextResponse} AssetSetImageOCRTextResponse
 * 手动为指定的图片资源文件设置或更新其 OCR 文本内容，并刷新到数据库。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AssetSetImageOCRTextParams} params - Request parameters.
 * @returns {Promise<AssetSetImageOCRTextResponse>}
 */
  setImageOCRText(params) {
    return this.fetcher('POST', '/api/asset/setImageOCRText', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetStatAssetParams} AssetStatAssetParams
 * @typedef {import('./index.d.ts').AssetStatAssetResponse} AssetStatAssetResponse
 * 获取指定资源文件（assets/ 路径）或本地文件（file:/// 路径）的大小、创建及修改时间等元信息。
 * (Requires authentication, Requires admin role)
 * @param {AssetStatAssetParams} params - Request parameters.
 * @returns {Promise<AssetStatAssetResponse>}
 */
  statAsset(params) {
    return this.fetcher('POST', '/api/asset/statAsset', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetUploadParams} AssetUploadParams
 * @typedef {import('./index.d.ts').AssetUploadResponse} AssetUploadResponse
 * 处理文件上传。通常用于将文件上传到服务器的临时目录或直接作为资源插入。参数通过 FormData 传递，如 assetPath (可选，指定保存路径) 和 id (可选，关联的文档ID)。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AssetUploadParams} params - Request parameters.
 * @returns {Promise<AssetUploadResponse>}
 */
  Upload(params) {
    return this.fetcher('POST', '/api/asset/upload', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AssetUploadCloudParams} AssetUploadCloudParams
 * @typedef {import('./index.d.ts').AssetUploadCloudResponse} AssetUploadCloudResponse
 * 将指定文档（及其子文档中）引用的所有本地资源文件上传到用户配置的云存储服务。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AssetUploadCloudParams} params - Request parameters.
 * @returns {Promise<AssetUploadCloudResponse>}
 */
  uploadCloud(params) {
    return this.fetcher('POST', '/api/asset/uploadCloud', params, true);
  }

}
