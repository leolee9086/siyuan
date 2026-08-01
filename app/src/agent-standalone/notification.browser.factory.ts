/**
 * 创建浏览器系统通知；实例化集中在 factory 边界内。
 * @同步豁免: UI构建 Notification 构造必须立即向浏览器提交，异步包装不会增加可替换性。
 */
export const createBrowserNotification = (title: string, body?: string) => new Notification(
    title,
    body === undefined ? {} : {body},
);
