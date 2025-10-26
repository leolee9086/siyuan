// Generated API client for group template
export class TemplateApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').TemplateDocSaveAsTemplateParams} TemplateDocSaveAsTemplateParams
 * @typedef {import('./index.d.ts').TemplateDocSaveAsTemplateResponse} TemplateDocSaveAsTemplateResponse
 * 将指定 ID 的文档内容保存为一个模板。可以指定模板名称，以及是否覆盖同名模板。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {TemplateDocSaveAsTemplateParams} params - Request parameters.
 * @returns {Promise<TemplateDocSaveAsTemplateResponse>}
 */
  docSaveAsTemplate(params) {
    return this.fetcher('POST', '/api/template/docSaveAsTemplate', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').TemplateRenderTemplateParams} TemplateRenderTemplateParams
 * @typedef {import('./index.d.ts').TemplateRenderTemplateResponse} TemplateRenderTemplateResponse
 * 根据给定的模板文件路径和可选的上下文块ID，渲染模板内容。可以指定是否为预览模式。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {TemplateRenderTemplateParams} params - Request parameters.
 * @returns {Promise<TemplateRenderTemplateResponse>}
 */
  renderTemplate(params) {
    return this.fetcher('POST', '/api/template/render', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').TemplateRenderSprigParams} TemplateRenderSprigParams
 * @typedef {import('./index.d.ts').TemplateRenderSprigResponse} TemplateRenderSprigResponse
 * 使用 Go 的 Sprig 模板函数库渲染给定的模板字符串。
 * (Requires authentication)
 * @param {TemplateRenderSprigParams} params - Request parameters.
 * @returns {Promise<TemplateRenderSprigResponse>}
 */
  renderSprig(params) {
    return this.fetcher('POST', '/api/template/renderSprig', params, true);
  }

}
