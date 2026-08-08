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
    return Array.isArray(value) && value.length === 3 &&
        typeof value[0] === "number" && Number.isFinite(value[0]) &&
        typeof value[1] === "number" && Number.isFinite(value[1]) &&
        typeof value[2] === "number" && Number.isFinite(value[2]);
}

function isPalette(value: unknown): value is FileBrowserPalette {
    return isRecord(value) && isRGB(value.color) &&
        typeof value.ratio === "number" && Number.isFinite(value.ratio) &&
        typeof value.h === "number" && Number.isFinite(value.h) &&
        typeof value.s === "number" && Number.isFinite(value.s) &&
        typeof value.l === "number" && Number.isFinite(value.l);
}

function optionalNumber(value: unknown): number | undefined {
    return value === undefined ? undefined : typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function typeName(value: unknown): string {
    if (value === null) {
        return "null";
    }
    if (Array.isArray(value)) {
        return "array";
    }
    return typeof value;
}

function assetLabel(index: number, value: Record<string, unknown>): string {
    const path = typeof value.path === "string" && value.path.length > 0 ? ` (${value.path})` : "";
    return `data.assets[${index}]${path}`;
}

function assetFormatError(index: number, value: Record<string, unknown>, field: string, expected: string): Error {
    return new Error(`文件查询响应格式错误：${assetLabel(index, value)} 的 ${field} 应为${expected}，实际为 ${typeName(value[field])}`);
}

const optionalStringFields = ["annotation", "boundBlockId", "source", "sourceId"] as const;
const optionalNumberFields = ["width", "height", "fileSize"] as const;

function parsePalettes(value: unknown, index: number, asset: Record<string, unknown>): FileBrowserPalette[] | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw assetFormatError(index, asset, "palettes", "调色板数组");
    }
    for (let paletteIndex = 0; paletteIndex < value.length; paletteIndex++) {
        const item = value[paletteIndex];
        if (!isPalette(item)) {
            throw new Error(`文件查询响应格式错误：${assetLabel(index, asset)} 的 palettes[${paletteIndex}] 不是有效调色板对象`);
        }
    }
    return value as FileBrowserPalette[];
}

function parseAsset(value: unknown, index: number): FileBrowserAssetResult {
    if (!isRecord(value)) {
        throw new Error(`文件查询响应格式错误：data.assets[${index}] 应为对象，实际为 ${typeName(value)}`);
    }
    if (typeof value.rootID !== "string") {
        throw assetFormatError(index, value, "rootID", "字符串");
    }
    if (typeof value.path !== "string") {
        throw assetFormatError(index, value, "path", "字符串");
    }
    if (typeof value.name !== "string") {
        throw assetFormatError(index, value, "name", "字符串");
    }
    if (!Array.isArray(value.tags)) {
        throw assetFormatError(index, value, "tags", "字符串数组");
    }
    for (let tagIndex = 0; tagIndex < value.tags.length; tagIndex++) {
        if (typeof value.tags[tagIndex] !== "string") {
            throw new Error(`文件查询响应格式错误：${assetLabel(index, value)} 的 tags[${tagIndex}] 应为字符串，实际为 ${typeName(value.tags[tagIndex])}`);
        }
    }
    if (value.star !== undefined && (typeof value.star !== "number" || !Number.isFinite(value.star))) {
        throw assetFormatError(index, value, "star", "有限数字");
    }
    for (const field of optionalStringFields) {
        if (value[field] !== undefined && typeof value[field] !== "string") {
            throw assetFormatError(index, value, field, "字符串");
        }
    }
    if (value.importTime !== undefined && (typeof value.importTime !== "number" || !Number.isFinite(value.importTime))) {
        throw assetFormatError(index, value, "importTime", "有限数字");
    }
    for (const field of optionalNumberFields) {
        if (value[field] !== undefined && optionalNumber(value[field]) === undefined) {
            throw assetFormatError(index, value, field, "有限数字");
        }
    }
    const palettes = parsePalettes(value.palettes, index, value);
    return {
        rootID: value.rootID,
        path: value.path,
        name: value.name,
        tags: value.tags,
        star: typeof value.star === "number" ? value.star : 0,
        annotation: typeof value.annotation === "string" ? value.annotation : "",
        boundBlockId: typeof value.boundBlockId === "string" ? value.boundBlockId : "",
        source: typeof value.source === "string" ? value.source : "scan",
        sourceId: typeof value.sourceId === "string" ? value.sourceId : "",
        importTime: typeof value.importTime === "number" ? value.importTime : 0,
        width: optionalNumber(value.width) ?? 0,
        height: optionalNumber(value.height) ?? 0,
        fileSize: optionalNumber(value.fileSize) ?? 0,
        ...(palettes ? {palettes} : {}),
    };
}

/** 把索引查询响应收窄为结果视图可以消费的稳定结构。 */
export function parseFileBrowserSearchResult(value: unknown): FileBrowserSearchResult {
    if (!isRecord(value)) {
        throw new Error(`文件查询响应格式错误：data 应为对象，实际为 ${typeName(value)}`);
    }
    if (!Array.isArray(value.assets)) {
        throw new Error(`文件查询响应格式错误：data.assets 应为数组，实际为 ${typeName(value.assets)}`);
    }
    if (typeof value.totalCount !== "number" || !Number.isFinite(value.totalCount)) {
        throw new Error(`文件查询响应格式错误：data.totalCount 应为有限数字，实际为 ${typeName(value.totalCount)}`);
    }
    if (typeof value.pageCount !== "number" || !Number.isFinite(value.pageCount)) {
        throw new Error(`文件查询响应格式错误：data.pageCount 应为有限数字，实际为 ${typeName(value.pageCount)}`);
    }
    const assets = value.assets.map((asset, index) => parseAsset(asset, index));
    return {
        assets,
        totalCount: value.totalCount,
        pageCount: value.pageCount,
    };
}
