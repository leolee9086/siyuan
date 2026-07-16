import type {ColorToolState, PaletteColor, RGB, StoredPalette} from "./types";

/** 检查未知值是否是三通道 RGB 元组，供本地存储解析使用。 */
const isRgb = (value: unknown): value is RGB => Array.isArray(value)
    && value.length === 3
    && value.every(item => typeof item === "number" && Number.isFinite(item));

/** 检查未知值是否符合调色板颜色结构，避免 JSON 解析使用断言。 */
const isPaletteColor = (value: unknown): value is PaletteColor => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const record = value as Record<string, unknown>;
    return isRgb(record.rgb)
        && (record.ratio === undefined || typeof record.ratio === "number")
        && (record.name === undefined || typeof record.name === "string");
};

/** 检查未知值是否是可安全恢复的用户色板。 */
export const isStoredPalette = (value: unknown): value is StoredPalette => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const record = value as Record<string, unknown>;
    return typeof record.id === "string"
        && typeof record.name === "string"
        && Array.isArray(record.colors)
        && record.colors.every(isPaletteColor);
};

/** 检查未知值是否是颜色工具持久化状态。 */
export const isColorToolState = (value: unknown): value is ColorToolState => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const record = value as Record<string, unknown>;
    return Array.isArray(record.recentColors)
        && record.recentColors.every(item => typeof item === "string")
        && Array.isArray(record.customColors)
        && record.customColors.every(item => typeof item === "string")
        && Array.isArray(record.palettes)
        && record.palettes.every(isStoredPalette)
        && typeof record.maxImageColors === "number";
};
