/** 旧 AssetCard 导入路径保留为兼容门面，实际策略归并在 assets 领域。 */
export {
    ASSET_IMAGE_EXTENSIONS,
    getAssetIconHref,
    getAssetThumbnailRequestURL,
    isAssetImage,
    isAssetText,
    isAssetThumbnail,
} from "../assetFormat";

import {getAssetThumbnailRequestURL} from "../assetFormat";

/** 旧资源卡片 API；新调用优先使用带 rootID 的请求构造器。 */
export function getAssetThumbnailUrl(path: string): string {
    return getAssetThumbnailRequestURL(path, 360);
}

export function isImageExt(ext: string): boolean {
    return getAssetThumbnailRequestURL(ext) !== "" && ext.toLowerCase().startsWith(".")
        ? isAssetImage(ext)
        : isAssetImage(`file.${ext}`);
}
