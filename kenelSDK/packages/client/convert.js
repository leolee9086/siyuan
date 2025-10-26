// Generated API client for group convert
export class ConvertApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').ConvertPandocParams} ConvertPandocParams
 * @typedef {import('./index.d.ts').ConvertPandocResponse} ConvertPandocResponse
 * 调用系统安装的 Pandoc 工具进行文档格式转换。需要提供 Pandoc 命令行参数。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {ConvertPandocParams} params - Request parameters.
 * @returns {Promise<ConvertPandocResponse>}
 */
  pandoc(params) {
    return this.fetcher('POST', '/api/convert/pandoc', params, true);
  }

}
