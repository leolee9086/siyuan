/**
 * 创建一次上传使用的浏览器 XHR 实例。
 * @同步豁免: UI构建 - 调用方必须在同一调用栈中配置 headers、状态回调和 progress 后立即发送。
 */
export const createUploadXHR = () => new XMLHttpRequest();
