// Generated API client for group export
export class ExportApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').ExportExport2LiandiParams} ExportExport2LiandiParams
 * @typedef {import('./index.d.ts').ExportExport2LiandiResponse} ExportExport2LiandiResponse
 * 将指定的文档内容导出到链滴社区。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {ExportExport2LiandiParams} params - Request parameters.
 * @returns {Promise<ExportExport2LiandiResponse>}
 */
  export2Liandi(params) {
    return this.fetcher('POST', '/api/export/export2Liandi', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportAsFileParams} ExportExportAsFileParams
 * @typedef {import('./index.d.ts').ExportExportAsFileResponse} ExportExportAsFileResponse
 * 接收上传的文件，将其保存到临时导出目录，并返回处理后的文件名及可访问路径。通常用于'另存为'等场景。文件通过 FormData 的 'file' 字段上传。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportAsFileParams} params - Request parameters.
 * @returns {Promise<ExportExportAsFileResponse>}
 */
  exportAsFile(params) {
    return this.fetcher('POST', '/api/export/exportAsFile', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportAsciiDocParams} ExportExportAsciiDocParams
 * @typedef {import('./index.d.ts').ExportExportAsciiDocResponse} ExportExportAsciiDocResponse
 * 将指定的文档导出为 AsciiDoc 格式的压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportAsciiDocParams} params - Request parameters.
 * @returns {Promise<ExportExportAsciiDocResponse>}
 */
  exportAsciiDoc(params) {
    return this.fetcher('POST', '/api/export/exportAsciiDoc', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportAttributeViewParams} ExportExportAttributeViewParams
 * @typedef {import('./index.d.ts').ExportExportAttributeViewResponse} ExportExportAttributeViewResponse
 * 将指定的属性视图导出为 CSV 压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportAttributeViewParams} params - Request parameters.
 * @returns {Promise<ExportExportAttributeViewResponse>}
 */
  exportAttributeView(params) {
    return this.fetcher('POST', '/api/export/exportAttributeView', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportDataResponse} ExportExportDataResponse
 * 导出当前工作空间的全部数据为一个 .zip 压缩文件。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<ExportExportDataResponse>}
 */
  exportData() {
    return this.fetcher('POST', '/api/export/exportData', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportDataInFolderParams} ExportExportDataInFolderParams
 * @typedef {import('./index.d.ts').ExportExportDataInFolderResponse} ExportExportDataInFolderResponse
 * 导出指定文件夹内的所有数据为一个压缩包。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportDataInFolderParams} params - Request parameters.
 * @returns {Promise<ExportExportDataInFolderResponse>}
 */
  exportDataInFolder(params) {
    return this.fetcher('POST', '/api/export/exportDataInFolder', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportDocxParams} ExportExportDocxParams
 * @typedef {import('./index.d.ts').ExportExportDocxResponse} ExportExportDocxResponse
 * 将指定的文档导出为 DOCX (.docx) 文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportDocxParams} params - Request parameters.
 * @returns {Promise<ExportExportDocxResponse>}
 */
  exportDocx(params) {
    return this.fetcher('POST', '/api/export/exportDocx', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportEPUBParams} ExportExportEPUBParams
 * @typedef {import('./index.d.ts').ExportExportEPUBResponse} ExportExportEPUBResponse
 * 将指定的文档导出为 EPUB 格式的压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportEPUBParams} params - Request parameters.
 * @returns {Promise<ExportExportEPUBResponse>}
 */
  exportEPUB(params) {
    return this.fetcher('POST', '/api/export/exportEPUB', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportHTMLParams} ExportExportHTMLParams
 * @typedef {import('./index.d.ts').ExportExportHTMLResponse} ExportExportHTMLResponse
 * 将指定文档导出为标准的、包含完整思源主题样式和脚本的 HTML 内容，通常用于生成可独立浏览的 HTML 文件或作为导出 PDF 的中间步骤。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportHTMLParams} params - Request parameters.
 * @returns {Promise<ExportExportHTMLResponse>}
 */
  exportHTML(params) {
    return this.fetcher('POST', '/api/export/exportHTML', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportMdParams} ExportExportMdParams
 * @typedef {import('./index.d.ts').ExportExportMdResponse} ExportExportMdResponse
 * 将指定的单个文档导出为 Markdown 文件，并打包成一个 .zip 压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportMdParams} params - Request parameters.
 * @returns {Promise<ExportExportMdResponse>}
 */
  exportMd(params) {
    return this.fetcher('POST', '/api/export/exportMd', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportMdContentParams} ExportExportMdContentParams
 * @typedef {import('./index.d.ts').ExportExportMdContentResponse} ExportExportMdContentResponse
 * 获取指定文档的 Markdown 文本内容，可自定义块引用和嵌入块的处理方式以及是否包含 YAML Front Matter。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportMdContentParams} params - Request parameters.
 * @returns {Promise<ExportExportMdContentResponse>}
 */
  exportMdContent(params) {
    return this.fetcher('POST', '/api/export/exportMdContent', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportMdHTMLParams} ExportExportMdHTMLParams
 * @typedef {import('./index.d.ts').ExportExportMdHTMLResponse} ExportExportMdHTMLResponse
 * 获取指定文档渲染后的纯 HTML 内容（不包含完整主题样式和脚本，主要用于内容嵌入）。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportMdHTMLParams} params - Request parameters.
 * @returns {Promise<ExportExportMdHTMLResponse>}
 */
  exportMdHTML(params) {
    return this.fetcher('POST', '/api/export/exportMdHTML', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportMdsParams} ExportExportMdsParams
 * @typedef {import('./index.d.ts').ExportExportMdsResponse} ExportExportMdsResponse
 * 将指定的多个文档分别导出为 Markdown 文件，并打包成一个 .zip 压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportMdsParams} params - Request parameters.
 * @returns {Promise<ExportExportMdsResponse>}
 */
  exportMds(params) {
    return this.fetcher('POST', '/api/export/exportMds', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportMediaWikiParams} ExportExportMediaWikiParams
 * @typedef {import('./index.d.ts').ExportExportMediaWikiResponse} ExportExportMediaWikiResponse
 * 将指定的文档导出为 MediaWiki 格式的压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportMediaWikiParams} params - Request parameters.
 * @returns {Promise<ExportExportMediaWikiResponse>}
 */
  exportMediaWiki(params) {
    return this.fetcher('POST', '/api/export/exportMediaWiki', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportNotebookMdParams} ExportExportNotebookMdParams
 * @typedef {import('./index.d.ts').ExportExportNotebookMdResponse} ExportExportNotebookMdResponse
 * 将指定的笔记本导出为 Markdown 格式的 .zip 压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportNotebookMdParams} params - Request parameters.
 * @returns {Promise<ExportExportNotebookMdResponse>}
 */
  exportNotebookMd(params) {
    return this.fetcher('POST', '/api/export/exportNotebookMd', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportNotebookSYParams} ExportExportNotebookSYParams
 * @typedef {import('./index.d.ts').ExportExportNotebookSYResponse} ExportExportNotebookSYResponse
 * 将指定的笔记本导出为思源原生 .sy 格式的压缩包。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportNotebookSYParams} params - Request parameters.
 * @returns {Promise<ExportExportNotebookSYResponse>}
 */
  exportNotebookSY(params) {
    return this.fetcher('POST', '/api/export/exportNotebookSY', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportODTParams} ExportExportODTParams
 * @typedef {import('./index.d.ts').ExportExportODTResponse} ExportExportODTResponse
 * 将指定的文档导出为 ODT 格式的压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportODTParams} params - Request parameters.
 * @returns {Promise<ExportExportODTResponse>}
 */
  exportODT(params) {
    return this.fetcher('POST', '/api/export/exportODT', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportOPMLParams} ExportExportOPMLParams
 * @typedef {import('./index.d.ts').ExportExportOPMLResponse} ExportExportOPMLResponse
 * 将指定的文档导出为 OPML 格式的压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportOPMLParams} params - Request parameters.
 * @returns {Promise<ExportExportOPMLResponse>}
 */
  exportOPML(params) {
    return this.fetcher('POST', '/api/export/exportOPML', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportOrgModeParams} ExportExportOrgModeParams
 * @typedef {import('./index.d.ts').ExportExportOrgModeResponse} ExportExportOrgModeResponse
 * 将指定的文档导出为 Org-mode 格式的压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportOrgModeParams} params - Request parameters.
 * @returns {Promise<ExportExportOrgModeResponse>}
 */
  exportOrgMode(params) {
    return this.fetcher('POST', '/api/export/exportOrgMode', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportPreviewHTMLParams} ExportExportPreviewHTMLParams
 * @typedef {import('./index.d.ts').ExportExportPreviewHTMLResponse} ExportExportPreviewHTMLResponse
 * 获取指定文档用于预览的 HTML 内容，包含块属性、类型等更丰富的上下文信息，并处理了块引链接。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportPreviewHTMLParams} params - Request parameters.
 * @returns {Promise<ExportExportPreviewHTMLResponse>}
 */
  exportPreviewHTML(params) {
    return this.fetcher('POST', '/api/export/exportPreviewHTML', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportRTFParams} ExportExportRTFParams
 * @typedef {import('./index.d.ts').ExportExportRTFResponse} ExportExportRTFResponse
 * 将指定的文档导出为 RTF 格式的压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportRTFParams} params - Request parameters.
 * @returns {Promise<ExportExportRTFResponse>}
 */
  exportRTF(params) {
    return this.fetcher('POST', '/api/export/exportRTF', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportReStructuredTextParams} ExportExportReStructuredTextParams
 * @typedef {import('./index.d.ts').ExportExportReStructuredTextResponse} ExportExportReStructuredTextResponse
 * 将指定的文档导出为 reStructuredText 格式的压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportReStructuredTextParams} params - Request parameters.
 * @returns {Promise<ExportExportReStructuredTextResponse>}
 */
  exportReStructuredText(params) {
    return this.fetcher('POST', '/api/export/exportReStructuredText', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportResourcesParams} ExportExportResourcesParams
 * @typedef {import('./index.d.ts').ExportExportResourcesResponse} ExportExportResourcesResponse
 * 将指定路径列表的文件或文件夹打包导出为一个 .zip 压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportResourcesParams} params - Request parameters.
 * @returns {Promise<ExportExportResourcesResponse>}
 */
  exportResources(params) {
    return this.fetcher('POST', '/api/export/exportResources', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportSYParams} ExportExportSYParams
 * @typedef {import('./index.d.ts').ExportExportSYResponse} ExportExportSYResponse
 * 将指定的单个文档导出为思源原生 .sy 格式的压缩包。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportSYParams} params - Request parameters.
 * @returns {Promise<ExportExportSYResponse>}
 */
  exportSY(params) {
    return this.fetcher('POST', '/api/export/exportSY', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportTempContentParams} ExportExportTempContentParams
 * @typedef {import('./index.d.ts').ExportExportTempContentResponse} ExportExportTempContentResponse
 * 将传入的 Markdown 内容保存为临时文件，并根据参数生成预览（HTML/PDF/图片），返回预览的 URL。注意：此接口在 `export.go` 中并未完整实现所有参数的逻辑（如 mode, theme, title, type, css, js 均未实际使用），主要实现了 content 的临时保存和URL返回。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportTempContentParams} params - Request parameters.
 * @returns {Promise<ExportExportTempContentResponse>}
 */
  exportTempContent(params) {
    return this.fetcher('POST', '/api/export/exportTempContent', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportTextileParams} ExportExportTextileParams
 * @typedef {import('./index.d.ts').ExportExportTextileResponse} ExportExportTextileResponse
 * 将指定的文档导出为 Textile 格式的压缩文件。
 * (Requires authentication, Requires admin role)
 * @param {ExportExportTextileParams} params - Request parameters.
 * @returns {Promise<ExportExportTextileResponse>}
 */
  exportTextile(params) {
    return this.fetcher('POST', '/api/export/exportTextile', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportExportPreviewParams} ExportExportPreviewParams
 * @typedef {import('./index.d.ts').ExportExportPreviewResponse} ExportExportPreviewResponse
 * 获取指定文档的完整 HTML 预览内容，包含标准主题和脚本，可直接用于浏览器展示。
 * (Requires authentication)
 * @param {ExportExportPreviewParams} params - Request parameters.
 * @returns {Promise<ExportExportPreviewResponse>}
 */
  exportPreview(params) {
    return this.fetcher('POST', '/api/export/preview', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ExportProcessPDFParams} ExportProcessPDFParams
 * @typedef {import('./index.d.ts').ExportProcessPDFResponse} ExportProcessPDFResponse
 * 对已生成的用于 PDF 导出的 HTML 文件进行后处理，如添加水印等。通常在调用 exportHTML (pdf=true) 之后使用。
 * (Requires authentication, Requires admin role)
 * @param {ExportProcessPDFParams} params - Request parameters.
 * @returns {Promise<ExportProcessPDFResponse>}
 */
  processPDF(params) {
    return this.fetcher('POST', '/api/export/processPDF', params, true);
  }

}
