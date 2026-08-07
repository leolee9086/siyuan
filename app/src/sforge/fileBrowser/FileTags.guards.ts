/** 用途：标签定义 API 响应守卫；使用范围：网络边界。 */
import type {FileTagCount, FileTagDefinitionsSnapshot} from "./FileTags.types";
/** 用途：现有颜色工具 RGB 契约；使用范围：颜色函数返回值收窄。 */
import type {RGB} from "./properties/imports";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isDefinition = (value: unknown) => isRecord(value) && typeof value.name === "string" && typeof value.color === "string";

export function isRGB(value: unknown): value is RGB {
    return Array.isArray(value) && value.length === 3 && value.every(channel => typeof channel === "number");
}

export function parseFileTagDefinitionsSnapshot(value: unknown): FileTagDefinitionsSnapshot {
    if (!isRecord(value) || typeof value.revision !== "string" || !Array.isArray(value.items) || !value.items.every(isDefinition)) {
        throw new Error("标签定义响应格式错误");
    }
    return value as unknown as FileTagDefinitionsSnapshot;
}

export function parseFileTagCounts(value: unknown): FileTagCount[] {
    if (!Array.isArray(value) || !value.every(item => isRecord(item) && typeof item.name === "string" &&
        typeof item.count === "number" && Number.isInteger(item.count) && item.count >= 0)) {
        throw new Error("标签计数响应格式错误");
    }
    return value as FileTagCount[];
}
