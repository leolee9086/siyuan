// Generated API client for group misc
export class MiscApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').MiscBroadcastSubscribeParams} MiscBroadcastSubscribeParams
 * 通过 Server-Sent Events (SSE) 订阅一个或多个指定广播频道的消息。连接建立后，服务器会持续推送所订阅频道的消息。
 * (Requires authentication, Requires admin role)
 * @param {MiscBroadcastSubscribeParams} params - Request parameters.
 * @returns {Promise<object>}
 */
  broadcastSubscribe(params) {
    return this.fetcher('GET', '/es/broadcast/subscribe', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').MiscBroadcastParams} MiscBroadcastParams
 * 通过 WebSocket 连接到指定的广播频道，用于双向实时通讯。
 * (Requires authentication, Requires admin role)
 * @param {MiscBroadcastParams} params - Request parameters.
 * @returns {Promise<object>}
 */
  broadcast(params) {
    return this.fetcher('GET', '/ws/broadcast', params, true);
  }

}
