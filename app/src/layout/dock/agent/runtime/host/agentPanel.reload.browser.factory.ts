/**
 * 创建绑定当前 Location 接收者的重载函数，避免不同宿主重复实现同一浏览器动作。
 * @同步豁免: UI构建 必须同步返回 Port 函数，异步化会改变宿主 capability 契约。
 */
// @柯里化：绑定浏览器 Location 接收者，返回可注入的无参 Port 函数。
export const createBrowserHostReload = () => location.reload.bind(location);
