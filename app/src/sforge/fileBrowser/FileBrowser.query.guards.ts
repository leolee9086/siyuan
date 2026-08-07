/** 用途：索引查询响应守卫；使用范围：查询仓储 API 边界。 */
import type {
    FileBrowserAssetResult,
    FileBrowserPalette,
    FileBrowserSearchResult,
} from "./FileBrowser.query.types";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isRGB(value: unknown): value is [number, number, number] {
    return Array.isArray(value) && value.length === 3 && value.every(item => typeof item === "number");
}

function isPalette(value: unknown): value is FileBrowserPalette {
    return isRecord(value) && isRGB(value.color) &&
        typeof value.ratio === "number" && typeof value.h === "number" &&
        typeof value.s === "number" && typeof value.l === "number";
}

function isAsset(value: unknown): value is FileBrowserAssetResult {
    return isRecord(value) && typeof value.rootID === "string" && typeof value.path === "string" &&
        typeof value.name === "string" && Array.isArray(value.tags) && value.tags.every(item => typeof item === "string") &&
        typeof value.star === "number" && typeof value.annotation === "string" &&
        typeof value.boundBlockId === "string" && typeof value.source === "string" &&
        typeof value.sourceId === "string" && typeof value.importTime === "number" &&
        typeof value.width === "number" && typeof value.height === "number" &&
        typeof value.fileSize === "number" &&
        (value.palettes === undefined || (Array.isArray(value.palettes) && value.palettes.every(isPalette)));
}

/** 把索引查询响应收窄为结果视图可以消费的稳定结构。 */
export function parseFileBrowserSearchResult(value: unknown): FileBrowserSearchResult {
    if (!isRecord(value) || !Array.isArray(value.assets) || !value.assets.every(isAsset) ||
        typeof value.totalCount !== "number" || typeof value.pageCount !== "number") {
        throw new Error("文件查询响应格式错误");
    }
    return {
        assets: value.assets,
        totalCount: value.totalCount,
        pageCount: value.pageCount,
    };
}
