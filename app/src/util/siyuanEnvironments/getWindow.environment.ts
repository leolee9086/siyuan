/**
 * 获取窗口尺寸的封装函数
 * 用于替代直接访问 window.innerWidth 和 window.innerHeight
 */
export function getSiyuanWindowSize(): { innerWidth: number; innerHeight: number } {
    return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
    };
}
