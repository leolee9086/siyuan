/** 用途：文件浏览基础响应守卫；使用范围：属性 API 边界。 */
import {
    isFileBrowserEntry,
    isFileBrowserPreviewKind,
    isFileBrowserRoot,
} from "./FileBrowser.guards";
/** 用途：属性 API 领域类型；使用范围：不可信响应收窄。 */
import type {
    FilePropertiesFailure,
    FilePropertiesInspectResult,
    FilePropertiesItem,
    FilePropertiesMetadata,
    FilePropertiesPalette,
    FilePropertiesPhysical,
    FilePropertiesUpdateResult,
    FilePropertiesUpdateResultItem,
} from "./FileProperties.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isRequest = (value: unknown) => isRecord(value) &&
    typeof value.rootID === "string" && typeof value.path === "string";

const isOptionalNumber = (value: unknown) => value === undefined || typeof value === "number";
const isOptionalString = (value: unknown) => value === undefined || typeof value === "string";

function isPalette(value: unknown): value is FilePropertiesPalette {
    return isRecord(value) && Array.isArray(value.color) && value.color.length === 3 &&
        value.color.every(item => typeof item === "number") && typeof value.ratio === "number" &&
        typeof value.h === "number" && typeof value.s === "number" && typeof value.l === "number";
}

function isMetadata(value: unknown): value is FilePropertiesMetadata {
    return isRecord(value) && typeof value.rootID === "string" && typeof value.path === "string" &&
        typeof value.name === "string" && Array.isArray(value.tags) && value.tags.every(tag => typeof tag === "string") &&
        typeof value.star === "number" && typeof value.annotation === "string" &&
        typeof value.boundBlockId === "string" && typeof value.source === "string" &&
        typeof value.sourceId === "string" && typeof value.importTime === "number" &&
        isOptionalNumber(value.width) && isOptionalNumber(value.height) && isOptionalNumber(value.fileSize) &&
        (value.palettes === undefined || (Array.isArray(value.palettes) && value.palettes.every(isPalette)));
}

function isPhysical(value: unknown): value is FilePropertiesPhysical {
    return isRecord(value) && isFileBrowserRoot(value.root) && isFileBrowserEntry(value.entry) &&
        isOptionalString(value.mediaType) && isFileBrowserPreviewKind(value.previewKind) &&
        isOptionalString(value.contentURL) && typeof value.revision === "string" &&
        isOptionalNumber(value.created) && isOptionalNumber(value.width) && isOptionalNumber(value.height) &&
        typeof value.readOnly === "boolean";
}

function isFailure(value: unknown): value is FilePropertiesFailure {
    return isRecord(value) && typeof value.code === "string" && typeof value.message === "string";
}

function isInspectItem(value: unknown): value is FilePropertiesItem {
    return isRecord(value) && isRequest(value.request) &&
        (value.properties === undefined || isPhysical(value.properties)) &&
        (value.metadata === undefined || isMetadata(value.metadata)) &&
        typeof value.metadataPersisted === "boolean" && typeof value.metadataWritable === "boolean" &&
        (value.error === undefined || isFailure(value.error)) &&
        (value.metadataError === undefined || isFailure(value.metadataError));
}

function isUpdateItem(value: unknown): value is FilePropertiesUpdateResultItem {
    return isRecord(value) && isRequest(value.request) &&
        (value.properties === undefined || isPhysical(value.properties)) &&
        (value.metadata === undefined || isMetadata(value.metadata)) &&
        (value.error === undefined || isFailure(value.error));
}

/** 校验批量属性读取响应。 */
export function parseFilePropertiesInspectResult(value: unknown): FilePropertiesInspectResult {
    if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isInspectItem) ||
        typeof value.successCount !== "number" || typeof value.failureCount !== "number" ||
        typeof value.metadataFailureCount !== "number") {
        throw new Error("文件属性响应格式错误");
    }
    return value as unknown as FilePropertiesInspectResult;
}

/** 校验批量元数据修改响应。 */
export function parseFilePropertiesUpdateResult(value: unknown): FilePropertiesUpdateResult {
    if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isUpdateItem) ||
        typeof value.successCount !== "number" || typeof value.failureCount !== "number") {
        throw new Error("文件属性更新响应格式错误");
    }
    return value as unknown as FilePropertiesUpdateResult;
}
