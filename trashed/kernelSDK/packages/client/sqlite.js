// Generated API client for group sqlite
export class SqliteApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').SqliteFlushTransactionResponse} SqliteFlushTransactionResponse
 * 将内核中待处理的数据库事务队列立即刷新到磁盘。这通常用于确保在关键操作后数据被持久化。该接口不接收参数。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<SqliteFlushTransactionResponse>}
 */
  flushTransaction() {
    return this.fetcher('POST', '/api/sqlite/flushTransaction', {}, true);
  }

}
