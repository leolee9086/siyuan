/**
 * 获取 DOMPurify 库的封装函数
 * 用于替代直接访问 window.DOMPurify
 */
export function getDOMPurify(): typeof DOMPurify {
    return window.DOMPurify;
}
