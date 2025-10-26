// Generated API client for group extension
export class ExtensionApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').ExtensionExtensionCopyParams} ExtensionExtensionCopyParams
 * @typedef {import('./index.d.ts').ExtensionExtensionCopyResponse} ExtensionExtensionCopyResponse
 * 处理来自浏览器扩展（如剪藏）复制过来的内容。将 HTML DOM 转换为 Markdown，并处理其中包含的图片等资源，将其保存到指定的笔记本或默认的 assets 目录。支持从链滴剪藏时直接获取 Markdown。这是一个 multipart/form-data 请求，除了明确定义的字段外，还可以包含多个文件字段。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {ExtensionExtensionCopyParams} params - Request parameters.
 * @returns {Promise<ExtensionExtensionCopyResponse>}
 */
  extensionCopy(params) {
    return this.fetcher('POST', '/api/extension/copy', params, true);
  }

}
