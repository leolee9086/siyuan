/**
 * 获取 htmlToImage 库的封装函数
 * 用于替代直接访问 window.htmlToImage
 */

interface HtmlToImage {
    toBlob(element: Element): Promise<Blob>;
    toPng(element: Element): Promise<string>;
    toSvg(element: Element): Promise<string>;
}

export function getHtmlToImage(): HtmlToImage | undefined {
    return window.htmlToImage;
}
