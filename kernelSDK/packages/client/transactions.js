// Generated API client for group transactions
export class TransactionsApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').TransactionsPerformTransactionsParams} TransactionsPerformTransactionsParams
 * @typedef {import('./index.d.ts').TransactionsPerformTransactionsResponse} TransactionsPerformTransactionsResponse
 * 执行一个或多个事务操作，每个事务可以包含多个具体的数据修改动作。这是思源笔记中进行数据修改最核心的接口之一。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {TransactionsPerformTransactionsParams} params - Request parameters.
 * @returns {Promise<TransactionsPerformTransactionsResponse>}
 */
  performTransactions(params) {
    return this.fetcher('POST', '/api/transactions', params, true);
  }

}
