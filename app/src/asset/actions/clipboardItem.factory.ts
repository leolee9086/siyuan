/** 创建浏览器 Clipboard API 所需的 PNG 条目。 */
/** @同步豁免: UI构建 - ClipboardItem 必须在同一用户手势调用栈内同步创建并立即传给 navigator.clipboard.write，异步边界会丢失浏览器剪贴板授权。 */
export const createPNGClipboardItem = (blob: Blob) => new ClipboardItem({
    "image/png": blob,
});
