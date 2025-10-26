// Generated API client for group query
export class QueryApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').QuerySQLParams} QuerySQLParams
 * @typedef {import('./index.d.ts').QuerySQLResponse} QuerySQLResponse
 * 执行 SQL 查询语句，返回查询结果。思源笔记使用 SQLite 作为底层数据库，支持标准的 SQL 查询语法。
 * (Requires authentication)
 * @param {QuerySQLParams} params - Request parameters.
 * @returns {Promise<QuerySQLResponse>}
 */
  SQL(params) {
    return this.fetcher('POST', '/api/query/sql', params, true);
  }

}
