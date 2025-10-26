// Generated API client for group cloud
export class CloudApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').CloudGetCloudSpaceResponse} CloudGetCloudSpaceResponse
 * 获取用户的云端存储空间使用情况、流量消耗以及同步和备份状态等信息。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<CloudGetCloudSpaceResponse>}
 */
  getCloudSpace() {
    return this.fetcher('POST', '/api/cloud/getCloudSpace', {}, true);
  }

}
