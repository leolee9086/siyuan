// Generated API client for group repo
export class RepoApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').RepoCheckoutRepoParams} RepoCheckoutRepoParams
 * @typedef {import('./index.d.ts').RepoCheckoutRepoResponse} RepoCheckoutRepoResponse
 * 将当前工作区内容回滚到指定的仓库快照版本。这是一个危险操作，会导致当前未保存的更改丢失，请谨慎操作。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RepoCheckoutRepoParams} params - Request parameters.
 * @returns {Promise<RepoCheckoutRepoResponse>}
 */
  checkoutRepo(params) {
    return this.fetcher('POST', '/api/repo/checkoutRepo', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoCreateSnapshotParams} RepoCreateSnapshotParams
 * @typedef {import('./index.d.ts').RepoCreateSnapshotResponse} RepoCreateSnapshotResponse
 * 为当前工作区创建一个新的快照。可以附带备注信息和标签。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RepoCreateSnapshotParams} params - Request parameters.
 * @returns {Promise<RepoCreateSnapshotResponse>}
 */
  createSnapshot(params) {
    return this.fetcher('POST', '/api/repo/createSnapshot', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoDiffRepoSnapshotsParams} RepoDiffRepoSnapshotsParams
 * @typedef {import('./index.d.ts').RepoDiffRepoSnapshotsResponse} RepoDiffRepoSnapshotsResponse
 * 比较两个指定的本地快照之间的差异，列出新增、修改和删除的文档。
 * (Requires authentication, Requires admin role)
 * @param {RepoDiffRepoSnapshotsParams} params - Request parameters.
 * @returns {Promise<RepoDiffRepoSnapshotsResponse>}
 */
  diffRepoSnapshots(params) {
    return this.fetcher('POST', '/api/repo/diffRepoSnapshots', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoDownloadCloudSnapshotParams} RepoDownloadCloudSnapshotParams
 * @typedef {import('./index.d.ts').RepoDownloadCloudSnapshotResponse} RepoDownloadCloudSnapshotResponse
 * 从云端下载指定的快照到本地。如果本地已存在同名快照，可能会被覆盖或操作失败。下载的是标签快照时需要提供标签名。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RepoDownloadCloudSnapshotParams} params - Request parameters.
 * @returns {Promise<RepoDownloadCloudSnapshotResponse>}
 */
  downloadCloudSnapshot(params) {
    return this.fetcher('POST', '/api/repo/downloadCloudSnapshot', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoGetCloudRepoSnapshotsParams} RepoGetCloudRepoSnapshotsParams
 * @typedef {import('./index.d.ts').RepoGetCloudRepoSnapshotsResponse} RepoGetCloudRepoSnapshotsResponse
 * 分页获取当前用户在云端存储的所有普通快照列表。
 * (Requires authentication, Requires admin role)
 * @param {RepoGetCloudRepoSnapshotsParams} params - Request parameters.
 * @returns {Promise<RepoGetCloudRepoSnapshotsResponse>}
 */
  getCloudRepoSnapshots(params) {
    return this.fetcher('POST', '/api/repo/getCloudRepoSnapshots', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoGetCloudRepoTagSnapshotsParams} RepoGetCloudRepoTagSnapshotsParams
 * @typedef {import('./index.d.ts').RepoGetCloudRepoTagSnapshotsResponse} RepoGetCloudRepoTagSnapshotsResponse
 * 分页获取当前用户在云端存储的所有标签快照列表。
 * (Requires authentication, Requires admin role)
 * @param {RepoGetCloudRepoTagSnapshotsParams} params - Request parameters.
 * @returns {Promise<RepoGetCloudRepoTagSnapshotsResponse>}
 */
  getCloudRepoTagSnapshots(params) {
    return this.fetcher('POST', '/api/repo/getCloudRepoTagSnapshots', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoGetRepoFileParams} RepoGetRepoFileParams
 * 获取指定快照中特定文件的原始内容。此接口直接返回文件数据流，不返回标准JSON结构。
 * (Requires authentication, Requires admin role)
 * @param {RepoGetRepoFileParams} params - Request parameters.
 * @returns {Promise<any>} 此接口不返回标准 JSON。成功时直接返回文件数据流 (HTTP 200)，Content-Type 根据文件类型确定。失败时返回标准 JSON 错误结构。
 */
  getRepoFile(params) {
    return this.fetcher('POST', '/api/repo/getRepoFile', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoGetRepoSnapshotsParams} RepoGetRepoSnapshotsParams
 * @typedef {import('./index.d.ts').RepoGetRepoSnapshotsResponse} RepoGetRepoSnapshotsResponse
 * 分页获取当前工作区本地存储的所有普通快照列表。
 * (Requires authentication, Requires admin role)
 * @param {RepoGetRepoSnapshotsParams} params - Request parameters.
 * @returns {Promise<RepoGetRepoSnapshotsResponse>}
 */
  getRepoSnapshots(params) {
    return this.fetcher('POST', '/api/repo/getRepoSnapshots', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoGetRepoTagSnapshotsParams} RepoGetRepoTagSnapshotsParams
 * @typedef {import('./index.d.ts').RepoGetRepoTagSnapshotsResponse} RepoGetRepoTagSnapshotsResponse
 * 分页获取当前工作区本地存储的所有标签快照列表。
 * (Requires authentication, Requires admin role)
 * @param {RepoGetRepoTagSnapshotsParams} params - Request parameters.
 * @returns {Promise<RepoGetRepoTagSnapshotsResponse>}
 */
  getRepoTagSnapshots(params) {
    return this.fetcher('POST', '/api/repo/getRepoTagSnapshots', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoImportRepoKeyResponse} RepoImportRepoKeyResponse
 * 导入仓库加密密钥。这是一个危险操作，错误的密钥可能导致数据无法解密。导入的密钥文件通常是 .sykey 后缀。此操作通过 FormData 接收文件。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<RepoImportRepoKeyResponse>}
 */
  importRepoKey() {
    return this.fetcher('POST', '/api/repo/importRepoKey', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoInitRepoKeyResponse} RepoInitRepoKeyResponse
 * 为当前工作区初始化一个新的随机加密密钥。此操作通常在首次设置加密或重置密钥时使用。旧密钥将被覆盖。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<RepoInitRepoKeyResponse>}
 */
  initRepoKey() {
    return this.fetcher('POST', '/api/repo/initRepoKey', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoInitRepoKeyFromPassphraseParams} RepoInitRepoKeyFromPassphraseParams
 * @typedef {import('./index.d.ts').RepoInitRepoKeyFromPassphraseResponse} RepoInitRepoKeyFromPassphraseResponse
 * 通过用户提供的口令生成并初始化仓库加密密钥。旧密钥将被覆盖。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RepoInitRepoKeyFromPassphraseParams} params - Request parameters.
 * @returns {Promise<RepoInitRepoKeyFromPassphraseResponse>}
 */
  initRepoKeyFromPassphrase(params) {
    return this.fetcher('POST', '/api/repo/initRepoKeyFromPassphrase', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoOpenRepoSnapshotDocParams} RepoOpenRepoSnapshotDocParams
 * @typedef {import('./index.d.ts').RepoOpenRepoSnapshotDocResponse} RepoOpenRepoSnapshotDocResponse
 * 获取并打开指定快照中特定文档的内容，用于预览历史版本。
 * (Requires authentication, Requires admin role)
 * @param {RepoOpenRepoSnapshotDocParams} params - Request parameters.
 * @returns {Promise<RepoOpenRepoSnapshotDocResponse>}
 */
  openRepoSnapshotDoc(params) {
    return this.fetcher('POST', '/api/repo/openRepoSnapshotDoc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoPurgeCloudRepoResponse} RepoPurgeCloudRepoResponse
 * 彻底删除用户在云端的所有仓库数据，包括所有快照和标签快照。这是一个非常危险且不可逆的操作，执行前通常会有二次确认。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<RepoPurgeCloudRepoResponse>}
 */
  purgeCloudRepo() {
    return this.fetcher('POST', '/api/repo/purgeCloudRepo', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoPurgeRepoResponse} RepoPurgeRepoResponse
 * 彻底删除当前工作区的本地仓库数据，包括所有快照和标签快照。这是一个非常危险且不可逆的操作，执行前通常会有二次确认。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<RepoPurgeRepoResponse>}
 */
  purgeRepo() {
    return this.fetcher('POST', '/api/repo/purgeRepo', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoRemoveCloudRepoTagSnapshotParams} RepoRemoveCloudRepoTagSnapshotParams
 * @typedef {import('./index.d.ts').RepoRemoveCloudRepoTagSnapshotResponse} RepoRemoveCloudRepoTagSnapshotResponse
 * 从云端移除指定的标签快照。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RepoRemoveCloudRepoTagSnapshotParams} params - Request parameters.
 * @returns {Promise<RepoRemoveCloudRepoTagSnapshotResponse>}
 */
  removeCloudRepoTagSnapshot(params) {
    return this.fetcher('POST', '/api/repo/removeCloudRepoTagSnapshot', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoRemoveRepoTagSnapshotParams} RepoRemoveRepoTagSnapshotParams
 * @typedef {import('./index.d.ts').RepoRemoveRepoTagSnapshotResponse} RepoRemoveRepoTagSnapshotResponse
 * 从本地仓库移除指定的标签快照。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RepoRemoveRepoTagSnapshotParams} params - Request parameters.
 * @returns {Promise<RepoRemoveRepoTagSnapshotResponse>}
 */
  removeRepoTagSnapshot(params) {
    return this.fetcher('POST', '/api/repo/removeRepoTagSnapshot', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoResetRepoResponse} RepoResetRepoResponse
 * 重置本地仓库，会清空所有快照和标签，并重新初始化仓库密钥。这是一个危险操作，执行前通常会有二次确认。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<RepoResetRepoResponse>}
 */
  resetRepo() {
    return this.fetcher('POST', '/api/repo/resetRepo', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoSetRepoIndexRetentionDaysParams} RepoSetRepoIndexRetentionDaysParams
 * @typedef {import('./index.d.ts').RepoSetRepoIndexRetentionDaysResponse} RepoSetRepoIndexRetentionDaysResponse
 * 设置本地仓库快照索引的保留天数。过期的索引将被自动清理。
 * (Requires authentication, Requires admin role)
 * @param {RepoSetRepoIndexRetentionDaysParams} params - Request parameters.
 * @returns {Promise<RepoSetRepoIndexRetentionDaysResponse>}
 */
  setRepoIndexRetentionDays(params) {
    return this.fetcher('POST', '/api/repo/setRepoIndexRetentionDays', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoSetRetentionIndexesDailyParams} RepoSetRetentionIndexesDailyParams
 * @typedef {import('./index.d.ts').RepoSetRetentionIndexesDailyResponse} RepoSetRetentionIndexesDailyResponse
 * 设置每日自动创建的快照在本地的保留数量。
 * (Requires authentication, Requires admin role)
 * @param {RepoSetRetentionIndexesDailyParams} params - Request parameters.
 * @returns {Promise<RepoSetRetentionIndexesDailyResponse>}
 */
  setRetentionIndexesDaily(params) {
    return this.fetcher('POST', '/api/repo/setRetentionIndexesDaily', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoTagSnapshotParams} RepoTagSnapshotParams
 * @typedef {import('./index.d.ts').RepoTagSnapshotResponse} RepoTagSnapshotResponse
 * 为指定的本地快照打上标签，使其成为一个标签快照。可以同时提供备注，如果提供会覆盖快照原有的备注。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RepoTagSnapshotParams} params - Request parameters.
 * @returns {Promise<RepoTagSnapshotResponse>}
 */
  tagSnapshot(params) {
    return this.fetcher('POST', '/api/repo/tagSnapshot', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').RepoUploadCloudSnapshotParams} RepoUploadCloudSnapshotParams
 * @typedef {import('./index.d.ts').RepoUploadCloudSnapshotResponse} RepoUploadCloudSnapshotResponse
 * 将指定的本地快照上传到云端。如果是标签快照，需要提供标签名。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {RepoUploadCloudSnapshotParams} params - Request parameters.
 * @returns {Promise<RepoUploadCloudSnapshotResponse>}
 */
  uploadCloudSnapshot(params) {
    return this.fetcher('POST', '/api/repo/uploadCloudSnapshot', params, true);
  }

}
