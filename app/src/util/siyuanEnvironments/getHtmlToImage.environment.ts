/**
 * 作用：提供 html-to-image 运行时对象的统一访问入口。
 * 意图：避免业务模块直接访问 `window.htmlToImage`，集中环境依赖。
 * 调用时机：导出图片、水印渲染等需要调用 html-to-image API 的流程。
 * 问题/改进：当前依赖全局脚本注入，后续可改造成显式模块加载以提升类型与加载时机可控性。
 */
// 导出语句注释：导出 html-to-image 访问函数供业务模块调用。
export const getHtmlToImage = async () => {
    return window.htmlToImage;
};
