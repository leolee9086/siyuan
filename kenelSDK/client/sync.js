// Generated API client for group sync
export class SyncApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').SyncCreateCloudSyncDirParams} SyncCreateCloudSyncDirParams
 * @typedef {import('./index.d.ts').SyncCreateCloudSyncDirResponse} SyncCreateCloudSyncDirResponse
 * 在云端存储中创建一个新的同步目录。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncCreateCloudSyncDirParams} params - Request parameters.
 * @returns {Promise<SyncCreateCloudSyncDirResponse>}
 */
  createCloudSyncDir(params) {
    return this.fetcher('POST', '/api/sync/createCloudSyncDir', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncExportSyncProviderS3Response} SyncExportSyncProviderS3Response
 * 将会话中当前的 S3 同步配置加密并打包成 .zip 文件供导出。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<SyncExportSyncProviderS3Response>}
 */
  exportSyncProviderS3() {
    return this.fetcher('POST', '/api/sync/exportSyncProviderS3', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncExportSyncProviderWebDAVResponse} SyncExportSyncProviderWebDAVResponse
 * 将会话中当前的 WebDAV 同步配置加密并打包成 .zip 文件供导出。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<SyncExportSyncProviderWebDAVResponse>}
 */
  exportSyncProviderWebDAV() {
    return this.fetcher('POST', '/api/sync/exportSyncProviderWebDAV', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncGetBootSyncResponse} SyncGetBootSyncResponse
 * 检查应用启动时数据同步是否成功完成。此接口仅在管理员角色下，且同步已启用且成功时返回特定提示。
 * (Requires authentication)
 * @returns {Promise<SyncGetBootSyncResponse>}
 */
  getBootSync() {
    return this.fetcher('POST', '/api/sync/getBootSync', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncGetSyncInfoResponse} SyncGetSyncInfoResponse
 * 获取当前的同步状态、最后同步时间、以及当前在线的内核实例等信息。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<SyncGetSyncInfoResponse>}
 */
  getSyncInfo() {
    return this.fetcher('POST', '/api/sync/getSyncInfo', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncImportSyncProviderS3Response} SyncImportSyncProviderS3Response
 * 通过上传的 .zip 或 .json 文件导入 S3 同步配置。导入的配置会经过解密和验证。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<SyncImportSyncProviderS3Response>}
 */
  importSyncProviderS3() {
    return this.fetcher('POST', '/api/sync/importSyncProviderS3', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncImportSyncProviderWebDAVResponse} SyncImportSyncProviderWebDAVResponse
 * 通过上传的 .zip 或 .json 文件导入 WebDAV 同步配置。导入的配置会经过解密和验证。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<SyncImportSyncProviderWebDAVResponse>}
 */
  importSyncProviderWebDAV() {
    return this.fetcher('POST', '/api/sync/importSyncProviderWebDAV', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncListCloudSyncDirResponse} SyncListCloudSyncDirResponse
 * 列出当前配置的云端存储中可用的同步目录及其大小信息。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<SyncListCloudSyncDirResponse>}
 */
  listCloudSyncDir() {
    return this.fetcher('POST', '/api/sync/listCloudSyncDir', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncPerformBootSyncResponse} SyncPerformBootSyncResponse
 * 执行启动时的数据同步流程。此接口会触发 model.BootSyncData()。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<SyncPerformBootSyncResponse>}
 */
  performBootSync() {
    return this.fetcher('POST', '/api/sync/performBootSync', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncPerformSyncParams} SyncPerformSyncParams
 * @typedef {import('./index.d.ts').SyncPerformSyncResponse} SyncPerformSyncResponse
 * 执行数据同步操作。对于非云端同步模式 (mode != 3)，将触发 model.SyncData(true)。对于云端同步模式 (mode === 3)，需要明确指定同步方向 (upload: true/false)。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncPerformSyncParams} params - Request parameters.
 * @returns {Promise<SyncPerformSyncResponse>}
 */
  performSync(params) {
    return this.fetcher('POST', '/api/sync/performSync', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncRemoveCloudSyncDirParams} SyncRemoveCloudSyncDirParams
 * @typedef {import('./index.d.ts').SyncRemoveCloudSyncDirResponse} SyncRemoveCloudSyncDirResponse
 * 从云端存储中移除指定的同步目录。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncRemoveCloudSyncDirParams} params - Request parameters.
 * @returns {Promise<SyncRemoveCloudSyncDirResponse>}
 */
  removeCloudSyncDir(params) {
    return this.fetcher('POST', '/api/sync/removeCloudSyncDir', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncSetCloudSyncDirParams} SyncSetCloudSyncDirParams
 * @typedef {import('./index.d.ts').SyncSetCloudSyncDirResponse} SyncSetCloudSyncDirResponse
 * 设置当前内核实例使用的云端同步目录。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncSetCloudSyncDirParams} params - Request parameters.
 * @returns {Promise<SyncSetCloudSyncDirResponse>}
 */
  setCloudSyncDir(params) {
    return this.fetcher('POST', '/api/sync/setCloudSyncDir', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncSetSyncEnableParams} SyncSetSyncEnableParams
 * @typedef {import('./index.d.ts').SyncSetSyncEnableResponse} SyncSetSyncEnableResponse
 * 设置是否启用数据同步功能。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncSetSyncEnableParams} params - Request parameters.
 * @returns {Promise<SyncSetSyncEnableResponse>}
 */
  setSyncEnable(params) {
    return this.fetcher('POST', '/api/sync/setSyncEnable', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncSetSyncGenerateConflictDocParams} SyncSetSyncGenerateConflictDocParams
 * @typedef {import('./index.d.ts').SyncSetSyncGenerateConflictDocResponse} SyncSetSyncGenerateConflictDocResponse
 * 设置在数据同步过程中发生内容冲突时，是否自动生成冲突副本文件。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncSetSyncGenerateConflictDocParams} params - Request parameters.
 * @returns {Promise<SyncSetSyncGenerateConflictDocResponse>}
 */
  setSyncGenerateConflictDoc(params) {
    return this.fetcher('POST', '/api/sync/setSyncGenerateConflictDoc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncSetSyncIntervalParams} SyncSetSyncIntervalParams
 * @typedef {import('./index.d.ts').SyncSetSyncIntervalResponse} SyncSetSyncIntervalResponse
 * 设置自动数据同步的时间间隔（单位：分钟）。设置后会重置同步计时器。
 * (Requires authentication)
 * @param {SyncSetSyncIntervalParams} params - Request parameters.
 * @returns {Promise<SyncSetSyncIntervalResponse>}
 */
  setSyncInterval(params) {
    return this.fetcher('POST', '/api/sync/setSyncInterval', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncSetSyncModeParams} SyncSetSyncModeParams
 * @typedef {import('./index.d.ts').SyncSetSyncModeResponse} SyncSetSyncModeResponse
 * 设置数据同步的模式。例如：0 表示自动同步，1 表示手动同步，3 表示云端双向同步时需手动触发单向同步。设置后会重置同步计时器。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncSetSyncModeParams} params - Request parameters.
 * @returns {Promise<SyncSetSyncModeResponse>}
 */
  setSyncMode(params) {
    return this.fetcher('POST', '/api/sync/setSyncMode', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncSetSyncPerceptionParams} SyncSetSyncPerceptionParams
 * @typedef {import('./index.d.ts').SyncSetSyncPerceptionResponse} SyncSetSyncPerceptionResponse
 * 设置是否启用同步感知功能。启用后，当检测到远程数据更新时，可能会有相应的提示或行为。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncSetSyncPerceptionParams} params - Request parameters.
 * @returns {Promise<SyncSetSyncPerceptionResponse>}
 */
  setSyncPerception(params) {
    return this.fetcher('POST', '/api/sync/setSyncPerception', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncSetSyncProviderParams} SyncSetSyncProviderParams
 * @typedef {import('./index.d.ts').SyncSetSyncProviderResponse} SyncSetSyncProviderResponse
 * 设置当前使用的数据同步服务提供商，例如 S3、WebDAV 或本地文件夹。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncSetSyncProviderParams} params - Request parameters.
 * @returns {Promise<SyncSetSyncProviderResponse>}
 */
  setSyncProvider(params) {
    return this.fetcher('POST', '/api/sync/setSyncProvider', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncSetSyncProviderLocalParams} SyncSetSyncProviderLocalParams
 * @typedef {import('./index.d.ts').SyncSetSyncProviderLocalResponse} SyncSetSyncProviderLocalResponse
 * 设置当同步服务提供商为本地文件夹时，所使用的本地文件夹路径。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncSetSyncProviderLocalParams} params - Request parameters.
 * @returns {Promise<SyncSetSyncProviderLocalResponse>}
 */
  setSyncProviderLocal(params) {
    return this.fetcher('POST', '/api/sync/setSyncProviderLocal', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncSetSyncProviderS3Params} SyncSetSyncProviderS3Params
 * @typedef {import('./index.d.ts').SyncSetSyncProviderS3Response} SyncSetSyncProviderS3Response
 * 设置使用 S3作为同步服务提供商时的详细配置信息，如 Access Key, Secret Key, Endpoint, Bucket 等。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncSetSyncProviderS3Params} params - Request parameters.
 * @returns {Promise<SyncSetSyncProviderS3Response>}
 */
  setSyncProviderS3(params) {
    return this.fetcher('POST', '/api/sync/setSyncProviderS3', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SyncSetSyncProviderWebDAVParams} SyncSetSyncProviderWebDAVParams
 * @typedef {import('./index.d.ts').SyncSetSyncProviderWebDAVResponse} SyncSetSyncProviderWebDAVResponse
 * 设置使用 WebDAV 作为同步服务提供商时的详细配置信息，如 Endpoint, 用户名和密码。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SyncSetSyncProviderWebDAVParams} params - Request parameters.
 * @returns {Promise<SyncSetSyncProviderWebDAVResponse>}
 */
  setSyncProviderWebDAV(params) {
    return this.fetcher('POST', '/api/sync/setSyncProviderWebDAV', params, true);
  }

}
