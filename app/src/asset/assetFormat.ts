/** 资源格式策略的唯一前端入口；卡片、旧资源预览和主要页签都只消费这里的结果。 */
import {Constants} from "../constants";

export type AssetPreviewKind = "directory" | "image" | "audio" | "video" | "pdf" | "text" | "d5a" | "binary";
export type AssetThumbnailMode = "generated" | "none";
export type AssetMainSurface = "asset" | "text" | "binary";

export interface AssetFormatStrategy {
    extension: string;
    previewKind: AssetPreviewKind;
    thumbnailMode: AssetThumbnailMode;
    mainSurface: AssetMainSurface;
    iconHref: string;
    supportsAssetTab: boolean;
}

const IMAGE_EXTENSIONS = new Set([
    ...Constants.SIYUAN_ASSETS_IMAGE,
    ".heic", ".heif",
]);
const AUDIO_EXTENSIONS = new Set([
    ...Constants.SIYUAN_ASSETS_AUDIO,
    ".opus",
]);
const VIDEO_EXTENSIONS = new Set([
    ...Constants.SIYUAN_ASSETS_VIDEO,
    ".3gp", ".avi", ".flv", ".m4v", ".wmv",
]);

/** 参考资源搜索入口使用的文本扩展名集合。 */
export const ASSET_TEXT_EXTENSIONS = [
    ".adoc", ".bat", ".c", ".cc", ".cmd", ".config", ".cpp", ".css", ".csv", ".editorconfig", ".env",
    ".go", ".h", ".hpp", ".htm", ".html", ".ini", ".java", ".js", ".jsx", ".json", ".kt", ".log",
    ".markdown", ".md", ".mjs", ".opml", ".org", ".php", ".properties", ".py", ".rb", ".rs", ".rst",
    ".scss", ".sh", ".sql", ".swift", ".textile", ".toml", ".ts", ".tsx", ".txt", ".vue", ".wiki", ".xml",
    ".yaml", ".yml",
] as const;
const TEXT_EXTENSIONS = new Set<string>(ASSET_TEXT_EXTENSIONS);

/** 资源领域当前使用的图片扩展名；保留旧 API 的数组形状。 */
export const ASSET_IMAGE_EXTENSIONS = [...IMAGE_EXTENSIONS].map(extension => extension.slice(1));

function extensionOf(path: string) {
    const cleanPath = path.trim().split(/[?#]/, 1)[0] ?? "";
    const slash = Math.max(cleanPath.lastIndexOf("/"), cleanPath.lastIndexOf("\\"));
    const name = cleanPath.slice(slash + 1).toLowerCase();
    if (name.startsWith(".") && name.indexOf(".", 1) < 0) {
        return name;
    }
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot) : "";
}

function has(set: Set<string>, extension: string) {
    return set.has(extension);
}

export function getAssetFormat(path: string, mediaType = ""): AssetFormatStrategy {
    const extension = extensionOf(path);
    const baseType = mediaType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
    let previewKind: AssetPreviewKind = "binary";
    if (extension === ".pdf" || baseType === "application/pdf") {
        previewKind = "pdf";
    } else if (has(IMAGE_EXTENSIONS, extension) || baseType.startsWith("image/")) {
        previewKind = "image";
    } else if (has(AUDIO_EXTENSIONS, extension) || baseType.startsWith("audio/")) {
        previewKind = "audio";
    } else if (has(VIDEO_EXTENSIONS, extension) || baseType.startsWith("video/")) {
        previewKind = "video";
    } else if (extension === ".d5a" || extension === ".d5mesh") {
        previewKind = "d5a";
    } else if (baseType.startsWith("text/") || has(TEXT_EXTENSIONS, extension)) {
        previewKind = "text";
    }

    const supportsAssetTab = Constants.SIYUAN_ASSETS_EXTS.includes(extension) && previewKind !== "text";
    const thumbnailMode: AssetThumbnailMode = previewKind === "image" || extension === ".d5m" || extension === ".sy"
        ? "generated" : "none";
    const mainSurface: AssetMainSurface = previewKind === "text" ? "text" : supportsAssetTab ? "asset" : "binary";
    return {
        extension,
        previewKind,
        thumbnailMode,
        mainSurface,
        iconHref: getAssetIconHrefForFormat(previewKind),
        supportsAssetTab,
    };
}

function getAssetIconHrefForFormat(kind: AssetPreviewKind) {
    switch (kind) {
        case "video":
            return "#iconVideo";
        case "audio":
            return "#iconRecord";
        case "pdf":
            return "#iconPDF";
        default:
            return "#iconFile";
    }
}

export function isAssetImage(path: string) {
    return getAssetFormat(path).previewKind === "image";
}

export function isAssetThumbnail(path: string) {
    return getAssetFormat(path).thumbnailMode === "generated";
}

export function getAssetIconHref(path: string) {
    return getAssetFormat(path).iconHref;
}

/** 返回缩略图请求地址；rootID 存在时使用文件浏览器的授权地址。 */
export function getAssetThumbnailRequestURL(path: string, size = 360, rootID?: string) {
    if (rootID) {
        const params = new URLSearchParams({rootID, path, size: String(size)});
        return `/api/s-forge/file-browser/thumbnail?${params.toString()}`;
    }
    return `/api/s-forge/thumbnail?path=${encodeURIComponent(path)}&size=${size}`;
}

export function isAssetText(path: string) {
    return getAssetFormat(path).previewKind === "text";
}

export function supportsAssetMainTab(path: string, mediaType = "") {
    return getAssetFormat(path, mediaType).supportsAssetTab;
}
