// Generated API client for group format
export class FormatApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').FormatAutoSpaceParams} FormatAutoSpaceParams
 * @typedef {import('./index.d.ts').FormatAutoSpaceResponse} FormatAutoSpaceResponse
 * 为指定块ID的内容（Markdown原文）在中文与英文、数字之间自动添加空格，以优化排版。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FormatAutoSpaceParams} params - Request parameters.
 * @returns {Promise<FormatAutoSpaceResponse>}
 */
  autoSpace(params) {
    return this.fetcher('POST', '/api/format/autoSpace', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FormatNetAssets2LocalAssetsParams} FormatNetAssets2LocalAssetsParams
 * @typedef {import('./index.d.ts').FormatNetAssets2LocalAssetsResponse} FormatNetAssets2LocalAssetsResponse
 * 将指定块ID内的所有外部网络资源（如图片、附件等，但不包括仅被引用的网络图片链接）下载并转存为本地资源。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FormatNetAssets2LocalAssetsParams} params - Request parameters.
 * @returns {Promise<FormatNetAssets2LocalAssetsResponse>}
 */
  netAssets2LocalAssets(params) {
    return this.fetcher('POST', '/api/format/netAssets2LocalAssets', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FormatNetImg2LocalAssetsParams} FormatNetImg2LocalAssetsParams
 * @typedef {import('./index.d.ts').FormatNetImg2LocalAssetsResponse} FormatNetImg2LocalAssetsResponse
 * 将指定块ID内的网络图片（Markdown中实际嵌入的图片，非普通链接）转存为本地资源。可以指定单个图片URL进行转存，或留空以转存块内所有网络图片。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FormatNetImg2LocalAssetsParams} params - Request parameters.
 * @returns {Promise<FormatNetImg2LocalAssetsResponse>}
 */
  netImg2LocalAssets(params) {
    return this.fetcher('POST', '/api/format/netImg2LocalAssets', params, true);
  }

}
