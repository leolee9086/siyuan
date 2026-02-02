// Generated API client for group archive
export class ArchiveApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').ArchiveUnzipParams} ArchiveUnzipParams
 * @typedef {import('./index.d.ts').ArchiveUnzipResponse} ArchiveUnzipResponse
 * 将指定的 .zip 文件解压到指定路径。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {ArchiveUnzipParams} params - Request parameters.
 * @returns {Promise<ArchiveUnzipResponse>}
 */
  unzip(params) {
    return this.fetcher('POST', '/api/archive/unzip', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').ArchiveZipParams} ArchiveZipParams
 * @typedef {import('./index.d.ts').ArchiveZipResponse} ArchiveZipResponse
 * 将指定路径的文件或目录压缩到指定的 .zip 文件。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {ArchiveZipParams} params - Request parameters.
 * @returns {Promise<ArchiveZipResponse>}
 */
  zip(params) {
    return this.fetcher('POST', '/api/archive/zip', params, true);
  }

}
