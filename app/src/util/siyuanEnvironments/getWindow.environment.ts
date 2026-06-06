/**
 * 获取窗口尺寸的封装函数
 * 用于替代直接访问 window.innerWidth 和 window.innerHeight
 * @同步豁免: 需要绝对同步的DOM访问 - 读取 window.innerWidth/Height 必须同步返回，异步化会导致返回过时的布局尺寸。
 */
export function getSiyuanWindowSize() {
    return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
    };
}
