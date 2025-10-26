// Generated API client for group notification
export class NotificationApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').NotificationPushErrMsgParams} NotificationPushErrMsgParams
 * @typedef {import('./index.d.ts').NotificationPushErrMsgResponse} NotificationPushErrMsgResponse
 * 向前端推送一条错误类型的消息通知，通常用于显示操作失败或异常情况。
 * (Requires authentication, Requires admin role)
 * @param {NotificationPushErrMsgParams} params - Request parameters.
 * @returns {Promise<NotificationPushErrMsgResponse>}
 */
  pushErrMsg(params) {
    return this.fetcher('POST', '/api/notification/pushErrMsg', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').NotificationPushMsgParams} NotificationPushMsgParams
 * @typedef {import('./index.d.ts').NotificationPushMsgResponse} NotificationPushMsgResponse
 * 向前端推送一条普通类型的消息通知，通常用于显示操作成功或提示信息。
 * (Requires authentication, Requires admin role)
 * @param {NotificationPushMsgParams} params - Request parameters.
 * @returns {Promise<NotificationPushMsgResponse>}
 */
  pushMsg(params) {
    return this.fetcher('POST', '/api/notification/pushMsg', params, true);
  }

}
