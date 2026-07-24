/** 创建布局模型使用的原生 WebSocket；连接生命周期仍由 Model 独占管理。 */
/** @同步豁免: 生命周期 - Model 必须在同一调用栈中绑定 socket 事件并保存连接身份。 */
export function createModelWebSocket(url: string) {
    return new WebSocket(url);
}
