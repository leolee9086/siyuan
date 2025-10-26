// Generated API client for group import
export class ImportApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').ImportImportDataResponse} ImportImportDataResponse
 * 导入完整的数据包备份 (.zip)。此操作会覆盖当前工作空间的数据。请求体为 FormData，必须包含 'file' 字段，值为 .zip 数据包文件。由于是 FormData，具体字段不在 Zod schema 中定义。代码实现详见 kernel/api/import.go:importData。导入过程会将文件暂存并在处理后删除。注意：此操作会覆盖当前工作空间。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<ImportImportDataResponse>}
 */
  importData() {
    return this.fetcher('POST', '/api/import/importData', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').ImportImportSYResponse} ImportImportSYResponse
 * 导入 .sy 文件 (思源笔记的标准文档/子文档包) 到指定的笔记本和路径下。请求体为 FormData。必须包含 'file' 字段 (值为 .sy.zip 文件), 'notebook' 字段 (目标笔记本ID), 'toPath' 字段 (目标文档父路径，例如 '/' 表示笔记本根目录)。由于是 FormData，具体字段不在 Zod schema 中定义。代码实现详见 kernel/api/import.go:importSY。导入过程会将文件暂存并在处理后删除。后台会显示进度。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<ImportImportSYResponse>}
 */
  importSY() {
    return this.fetcher('POST', '/api/import/importSY', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').ImportImportStdMdParams} ImportImportStdMdParams
 * @typedef {import('./index.d.ts').ImportImportStdMdResponse} ImportImportStdMdResponse
 * 从本地文件系统导入标准 Markdown 文件或包含 Markdown 文件的文件夹到指定的笔记本和路径下。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {ImportImportStdMdParams} params - Request parameters.
 * @returns {Promise<ImportImportStdMdResponse>}
 */
  importStdMd(params) {
    return this.fetcher('POST', '/api/import/importStdMd', params, true);
  }

}
