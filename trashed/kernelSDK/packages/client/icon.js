// Generated API client for group icon
export class IconApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').IconGetDynamicIconParams} IconGetDynamicIconParams
 * 根据参数动态生成一个SVG格式的日期或文字图标。此接口直接返回 SVG 图像数据。
 * @param {IconGetDynamicIconParams} params - Request parameters.
 * @returns {Promise<any>} 此接口不返回 JSON。成功时直接返回 image/svg+xml 类型的 SVG 图像数据 (HTTP 200)。失败时可能返回其他 HTTP 错误状态码。
 */
  getDynamicIcon(params) {
    return this.fetcher('GET', '/api/icon/getDynamicIcon', params, false);
  }

}
