// Generated API client for group bookmark
export class BookmarkApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').BookmarkGetBookmarkResponse} BookmarkGetBookmarkResponse
 * 构建并返回当前工作空间的所有书签列表。书签是为块设置的特定名称，方便快速访问。
 * (Requires authentication)
 * @returns {Promise<BookmarkGetBookmarkResponse>}
 */
  getBookmark() {
    return this.fetcher('POST', '/api/bookmark/getBookmark', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').BookmarkRemoveBookmarkParams} BookmarkRemoveBookmarkParams
 * @typedef {import('./index.d.ts').BookmarkRemoveBookmarkResponse} BookmarkRemoveBookmarkResponse
 * 根据书签名称（即块的 IAL 中 bookmark 属性的值）移除一个或多个书签。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BookmarkRemoveBookmarkParams} params - Request parameters.
 * @returns {Promise<BookmarkRemoveBookmarkResponse>}
 */
  removeBookmark(params) {
    return this.fetcher('POST', '/api/bookmark/removeBookmark', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BookmarkRenameBookmarkParams} BookmarkRenameBookmarkParams
 * @typedef {import('./index.d.ts').BookmarkRenameBookmarkResponse} BookmarkRenameBookmarkResponse
 * 将具有特定旧书签名称（块 IAL 中 bookmark 属性的旧值）的所有书签重命名为一个新的书签名称。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BookmarkRenameBookmarkParams} params - Request parameters.
 * @returns {Promise<BookmarkRenameBookmarkResponse>}
 */
  renameBookmark(params) {
    return this.fetcher('POST', '/api/bookmark/renameBookmark', params, true);
  }

}
