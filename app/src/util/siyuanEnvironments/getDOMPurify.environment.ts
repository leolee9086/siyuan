/**
 * 获取 DOMPurify 库的封装函数
 * 用于替代直接访问 window.DOMPurify
 * @同步豁免: 需要绝对同步的DOM访问 - 读取 window.DOMPurify 必须同步返回，异步化会导致安全过滤函数在异步间隙中不可用。
 */
export function getDOMPurify() {
    return window.DOMPurify;
}
