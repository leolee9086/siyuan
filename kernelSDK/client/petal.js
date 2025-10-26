// Generated API client for group petal
export class PetalApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').PetalLoadPetalsParams} PetalLoadPetalsParams
 * @typedef {import('./index.d.ts').PetalLoadPetalsResponse} PetalLoadPetalsResponse
 * 加载指定前端界面的所有已启用且兼容的插件（Petals）及其代码和配置信息。
 * (Requires authentication)
 * @param {PetalLoadPetalsParams} params - Request parameters.
 * @returns {Promise<PetalLoadPetalsResponse>}
 */
  loadPetals(params) {
    return this.fetcher('POST', '/api/petal/loadPetals', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').PetalSetPetalEnabledParams} PetalSetPetalEnabledParams
 * @typedef {import('./index.d.ts').PetalSetPetalEnabledResponse} PetalSetPetalEnabledResponse
 * 设置指定前端界面中特定插件（由包名识别）的启用或禁用状态。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {PetalSetPetalEnabledParams} params - Request parameters.
 * @returns {Promise<PetalSetPetalEnabledResponse>}
 */
  setPetalEnabled(params) {
    return this.fetcher('POST', '/api/petal/setPetalEnabled', params, true);
  }

}
