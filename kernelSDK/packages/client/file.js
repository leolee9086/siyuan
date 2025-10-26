// Generated API client for group file
export class FileApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').FileCopyFileParams} FileCopyFileParams
 * @typedef {import('./index.d.ts').FileCopyFileResponse} FileCopyFileResponse
 * 复制工作空间内的单个文件或资源文件。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FileCopyFileParams} params - Request parameters.
 * @returns {Promise<FileCopyFileResponse>}
 */
  copyFile(params) {
    return this.fetcher('POST', '/api/file/copyFile', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FileGetFileParams} FileGetFileParams
 * @typedef {import('./index.d.ts').FileGetFileResponse} FileGetFileResponse
 * 获取指定路径的文件内容。注意：此接口不通过JSON返回文件内容，而是直接在HTTP响应体中返回文件数据流，Content-Type 根据文件类型确定。因此，zodResponseSchema 仅用于描述可能的错误情况下的JSON响应。成功获取文件时，HTTP状态码为200，响应体为文件内容。
 * (Requires authentication)
 * @param {FileGetFileParams} params - Request parameters.
 * @returns {Promise<FileGetFileResponse>}
 */
  getFile(params) {
    return this.fetcher('POST', '/api/file/getFile', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FileGetUniqueFilenameParams} FileGetUniqueFilenameParams
 * @typedef {import('./index.d.ts').FileGetUniqueFilenameResponse} FileGetUniqueFilenameResponse
 * 根据输入的文件路径，生成一个在目标位置唯一的、不冲突的文件名版本。例如，输入 'assets/image.png'，如果已存在，则可能返回 'assets/image_1.png'。
 * (Requires authentication)
 * @param {FileGetUniqueFilenameParams} params - Request parameters.
 * @returns {Promise<FileGetUniqueFilenameResponse>}
 */
  getUniqueFilename(params) {
    return this.fetcher('POST', '/api/file/getUniqueFilename', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FileGlobalCopyFilesParams} FileGlobalCopyFilesParams
 * @typedef {import('./index.d.ts').FileGlobalCopyFilesResponse} FileGlobalCopyFilesResponse
 * 将多个源文件复制到指定的目标目录 (相对于工作空间)。源文件路径必须是绝对路径。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FileGlobalCopyFilesParams} params - Request parameters.
 * @returns {Promise<FileGlobalCopyFilesResponse>}
 */
  globalCopyFiles(params) {
    return this.fetcher('POST', '/api/file/globalCopyFiles', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FilePutFileParams} FilePutFileParams
 * @typedef {import('./index.d.ts').FilePutFileResponse} FilePutFileResponse
 * 上传文件或创建目录。这是一个 multipart/form-data 请求。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FilePutFileParams} params - Request parameters.
 * @returns {Promise<FilePutFileResponse>}
 */
  putFile(params) {
    return this.fetcher('POST', '/api/file/putFile', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FileReadDirParams} FileReadDirParams
 * @typedef {import('./index.d.ts').FileReadDirResponse} FileReadDirResponse
 * 读取指定目录下的文件和子目录列表。
 * (Requires authentication)
 * @param {FileReadDirParams} params - Request parameters.
 * @returns {Promise<FileReadDirResponse>}
 */
  readDir(params) {
    return this.fetcher('POST', '/api/file/readDir', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FileRemoveFileParams} FileRemoveFileParams
 * @typedef {import('./index.d.ts').FileRemoveFileResponse} FileRemoveFileResponse
 * 移除指定路径的文件或目录。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FileRemoveFileParams} params - Request parameters.
 * @returns {Promise<FileRemoveFileResponse>}
 */
  removeFile(params) {
    return this.fetcher('POST', '/api/file/removeFile', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').FileRenameFileParams} FileRenameFileParams
 * @typedef {import('./index.d.ts').FileRenameFileResponse} FileRenameFileResponse
 * 重命名指定路径的文件或目录。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {FileRenameFileParams} params - Request parameters.
 * @returns {Promise<FileRenameFileResponse>}
 */
  renameFile(params) {
    return this.fetcher('POST', '/api/file/renameFile', params, true);
  }

}
