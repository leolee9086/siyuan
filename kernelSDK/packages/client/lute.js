// Generated API client for group lute
export class LuteApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').LuteCopyStdMarkdownParams} LuteCopyStdMarkdownParams
 * @typedef {import('./index.d.ts').LuteCopyStdMarkdownResponse} LuteCopyStdMarkdownResponse
 * 将指定ID的块内容导出为标准 Markdown 格式的字符串。
 * (Requires authentication)
 * @param {LuteCopyStdMarkdownParams} params - Request parameters.
 * @returns {Promise<LuteCopyStdMarkdownResponse>}
 */
  copyStdMarkdown(params) {
    return this.fetcher('POST', '/api/lute/copyStdMarkdown', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').LuteHtml2BlockDOMParams} LuteHtml2BlockDOMParams
 * @typedef {import('./index.d.ts').LuteHtml2BlockDOMResponse} LuteHtml2BlockDOMResponse
 * 将输入的 HTML 字符串转换为思源笔记的块级 DOM 结构 (仍为HTML字符串，但经过Lute处理)。会处理本地资源路径、空列表项、单列表格转段落等情况。
 * (Requires authentication)
 * @param {LuteHtml2BlockDOMParams} params - Request parameters.
 * @returns {Promise<LuteHtml2BlockDOMResponse>}
 */
  html2BlockDOM(params) {
    return this.fetcher('POST', '/api/lute/html2BlockDOM', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').LuteSpinBlockDOMParams} LuteSpinBlockDOMParams
 * @typedef {import('./index.d.ts').LuteSpinBlockDOMResponse} LuteSpinBlockDOMResponse
 * 对传入的块级 DOM 字符串执行 Lute 引擎的 SpinBlockDOM 处理，进行原生渲染相关的优化。
 * (Requires authentication)
 * @param {LuteSpinBlockDOMParams} params - Request parameters.
 * @returns {Promise<LuteSpinBlockDOMResponse>}
 */
  spinBlockDOM(params) {
    return this.fetcher('POST', '/api/lute/spinBlockDOM', params, true);
  }

}
