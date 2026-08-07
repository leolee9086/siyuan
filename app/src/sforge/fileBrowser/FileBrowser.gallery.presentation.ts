/** 用途：画廊卡片属性的纯展示格式化；使用范围：瀑布流卡片和属性列投影。 */
import {FILE_BROWSER_GALLERY_ATTRIBUTES} from "./FileBrowser.gallery.constants";
import type {FileBrowserGalleryAttribute} from "./FileBrowser.gallery.constants";
import type {FileBrowserAssetResult} from "./FileBrowser.query.types";

const attributeLabels = new Map(FILE_BROWSER_GALLERY_ATTRIBUTES.map(attribute => [attribute.key, attribute.label]));

export function formatFileBrowserBytes(value: number) {
    if (!Number.isFinite(value) || value < 0) {
        return "";
    }
    if (value < 1024) {
        return `${value} B`;
    }
    const units = ["KB", "MB", "GB", "TB"];
    let scaled = value;
    let unitIndex = -1;
    while (scaled >= 1024 && unitIndex < units.length - 1) {
        scaled /= 1024;
        unitIndex += 1;
    }
    const formatted = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(scaled >= 10 ? 0 : 1);
    return `${formatted} ${units[unitIndex]}`;
}

export function formatFileBrowserImportTime(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
        return "";
    }
    const date = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export function getFileBrowserGalleryAttributeLabel(attribute: FileBrowserGalleryAttribute) {
    return attributeLabels.get(attribute) ?? attribute;
}

export function getFileBrowserGalleryAttributeValue(
    asset: FileBrowserAssetResult,
    attribute: FileBrowserGalleryAttribute,
) {
    switch (attribute) {
        case "dimensions":
            return asset.width > 0 && asset.height > 0 ? `${asset.width} x ${asset.height}` : "";
        case "size":
            return formatFileBrowserBytes(asset.fileSize);
        case "extension":
            return extensionOf(asset.name || asset.path);
        case "source":
            return asset.source || asset.sourceId;
        case "importTime":
            return formatFileBrowserImportTime(asset.importTime);
        case "annotation":
            return asset.annotation;
    }
}

function extensionOf(path: string) {
    const dot = path.lastIndexOf(".");
    return dot >= 0 ? path.slice(dot).toLowerCase() : "";
}
