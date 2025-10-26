// Generated API client for group network
export class NetworkApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').NetworkForwardProxyParams} NetworkForwardProxyParams
 * @typedef {import('./index.d.ts').NetworkForwardProxyResponse} NetworkForwardProxyResponse
 * 作为代理，将客户端构造的HTTP(S)请求转发到指定的目标URL，并返回目标服务器的响应。支持多种请求体编码方式。
 * (Requires authentication, Requires admin role)
 * @param {NetworkForwardProxyParams} params - Request parameters.
 * @returns {Promise<NetworkForwardProxyResponse>}
 */
  forwardProxy(params) {
    return this.fetcher('POST', '/api/network/forwardProxy', params, true);
  }

}
