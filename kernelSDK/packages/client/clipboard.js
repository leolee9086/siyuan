// Generated API client for group clipboard
export class ClipboardApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').ClipboardReadFilePathsResponse} ClipboardReadFilePathsResponse
 * 从系统剪贴板中读取文件路径列表。注意：在 Linux 上此功能可能受限或不可用。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<ClipboardReadFilePathsResponse>}
 */
  readFilePaths() {
    return this.fetcher('POST', '/api/clipboard/readFilePaths', {}, true);
  }

}
