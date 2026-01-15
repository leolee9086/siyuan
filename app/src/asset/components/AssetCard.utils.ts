/**
 * 判断是否为图片类型的扩展名
 * @param ext 文件扩展名
 * @returns 是否为图片
 */
export function isImageExt(ext: string): boolean {
    return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext);
}

/**
 * 根据路径判断是否为图片
 * @param path 文件路径
 * @returns 是否为图片
 */
export function isAssetImage(path: string): boolean {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return isImageExt(ext);
}

/**
 * 获取资源的缩略图 URL
 * @param path 文件路径
 * @returns 缩略图 URL
 */
export function getAssetThumbnailUrl(path: string): string {
    // 使用缩略图服务, 指定宽度为 360px 以适配瀑布流列宽
    return `/api/s-forge/thumbnail?path=${encodeURIComponent(path)}&size=360`;
}

/**
 * 获取非图片类型的图标 ID
 * @param path 文件路径
 * @returns SVG 图标 ID
 */
export function getAssetIconHref(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    if (["mp4", "webm", "mov", "avi"].includes(ext)) {
        return "#iconVideo";
    }
    if (["mp3", "wav", "ogg", "flac"].includes(ext)) {
        return "#iconRecord";
    }
    if (["pdf"].includes(ext)) {
        return "#iconPDF";
    }
    return "#iconFile";
}
