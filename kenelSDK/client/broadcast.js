// Generated API client for group broadcast
export class BroadcastApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').BroadcastGetChannelInfoParams} BroadcastGetChannelInfoParams
 * @typedef {import('./index.d.ts').BroadcastGetChannelInfoResponse} BroadcastGetChannelInfoResponse
 * 获取指定名称的广播频道的详细信息，如订阅者数量。
 * (Requires authentication, Requires admin role)
 * @param {BroadcastGetChannelInfoParams} params - Request parameters.
 * @returns {Promise<BroadcastGetChannelInfoResponse>}
 */
  getChannelInfo(params) {
    return this.fetcher('POST', '/api/broadcast/getChannelInfo', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BroadcastGetChannelsResponse} BroadcastGetChannelsResponse
 * 获取当前所有活跃的广播频道及其订阅者数量的列表。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<BroadcastGetChannelsResponse>}
 */
  getChannels() {
    return this.fetcher('POST', '/api/broadcast/getChannels', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').BroadcastPostMessageParams} BroadcastPostMessageParams
 * @typedef {import('./index.d.ts').BroadcastPostMessageResponse} BroadcastPostMessageResponse
 * 向指定的广播频道发送文本消息。也可以用于发送特定命令 (cmd)。
 * (Requires authentication, Requires admin role)
 * @param {BroadcastPostMessageParams} params - Request parameters.
 * @returns {Promise<BroadcastPostMessageResponse>}
 */
  postMessage(params) {
    return this.fetcher('POST', '/api/broadcast/postMessage', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BroadcastBroadcastPublishParams} BroadcastBroadcastPublishParams
 * @typedef {import('./index.d.ts').BroadcastBroadcastPublishResponse} BroadcastBroadcastPublishResponse
 * 向指定的广播频道发布消息。可以是文本消息，也可以通过上传文件发布二进制消息。请求体应为 multipart/form-data。
 * (Requires authentication, Requires admin role)
 * @param {BroadcastBroadcastPublishParams} params - Request parameters.
 * @returns {Promise<BroadcastBroadcastPublishResponse>}
 */
  broadcastPublish(params) {
    return this.fetcher('POST', '/api/broadcast/publish', params, true);
  }

}
