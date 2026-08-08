/** 用途：文件浏览器 API 领域类型；使用范围：不可信响应的运行时校验。 */
import type {
    FileBrowserDirectoryPage,
    FileBrowserEditorDocument,
    FileBrowserEditorEncoding,
    FileBrowserEditorWriteResult,
    FileBrowserEditorTabData,
    FileBrowserEntry,
    FileBrowserFileStat,
	FileBrowserOperationResult,
    FileBrowserGalleryTabData,
    FileBrowserPermission,
    FileBrowserRoot,
    FileBrowserRootCapabilities,
    FileBrowserRootMount,
    FileBrowserRootSource,
    FileBrowserTextPreview,
    FileBrowserPreviewKind,
    FileBrowserPreviewTabData,
    FileBrowserSortField,
} from "./FileBrowser.types";
import type {FileBrowserSearchRequest} from "./FileBrowser.query.types";

/** @同步豁免: 类型守卫 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

/** @同步豁免: 类型守卫 */
const isPermission = (value: unknown): value is FileBrowserPermission =>
    value === "read-only" || value === "read-write" || value === "command";

/** @同步豁免: 类型守卫 */
export const isFileBrowserSortField = (value: unknown): value is FileBrowserSortField =>
    value === "name" || value === "size" || value === "updated" || value === "extension";

/** @同步豁免: 类型守卫 */
const isRootCapabilities = (value: unknown): value is FileBrowserRootCapabilities =>
    isRecord(value) &&
    typeof value.browse === "boolean" &&
    typeof value.write === "boolean" &&
    typeof value.command === "boolean";

/** @同步豁免: 类型守卫 */
const isRootSource = (value: unknown): value is FileBrowserRootSource =>
    isRecord(value) &&
    typeof value.sessionID === "string" &&
    typeof value.directoryID === "string" &&
    typeof value.name === "string" &&
    typeof value.path === "string" &&
    isPermission(value.permission) &&
    typeof value.external === "boolean" &&
    typeof value.boundAt === "number";

const isRootMount = (value: unknown): value is FileBrowserRootMount =>
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.kind === "workspace" || value.kind === "agent-task-directory") &&
    typeof value.label === "string" &&
    typeof value.path === "string" &&
    typeof value.relativePath === "string" &&
    isPermission(value.permission) &&
    isRootCapabilities(value.capabilities) &&
    (value.sources === undefined || (Array.isArray(value.sources) && value.sources.every(isRootSource))) &&
    typeof value.exists === "boolean";

/** @同步豁免: 类型守卫 */
export const isFileBrowserRoot = (value: unknown): value is FileBrowserRoot => {
    if (!isRecord(value)) {
        return false;
    }
    const sourcesValid = value.sources === undefined || (
        Array.isArray(value.sources) && value.sources.every(isRootSource)
    );
    const mountsValid = value.mounts === undefined || (
        Array.isArray(value.mounts) && value.mounts.every(isRootMount)
    );
    return (value.kind === "workspace" || value.kind === "agent-task-directory") &&
        typeof value.id === "string" &&
        typeof value.label === "string" &&
        typeof value.path === "string" &&
        isPermission(value.permission) &&
        isRootCapabilities(value.capabilities) &&
        sourcesValid &&
        mountsValid &&
        typeof value.exists === "boolean";
};

/** @同步豁免: 类型守卫 */
export const isFileBrowserEntry = (value: unknown): value is FileBrowserEntry =>
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.path === "string" &&
    typeof value.isDir === "boolean" &&
    typeof value.isSymlink === "boolean" &&
    typeof value.restricted === "boolean" &&
    typeof value.hidden === "boolean" &&
    typeof value.size === "number" &&
    typeof value.updated === "number" &&
    (value.extension === undefined || typeof value.extension === "string") &&
    (value.childFileCount === undefined || typeof value.childFileCount === "number") &&
    (value.childDirectoryCount === undefined || typeof value.childDirectoryCount === "number") &&
    (value.childCountKnown === undefined || typeof value.childCountKnown === "boolean");

/** @同步豁免: 类型守卫 */
export const isFileBrowserPreviewKind = (value: unknown): value is FileBrowserPreviewKind =>
    value === "directory" || value === "image" || value === "audio" || value === "video" || value === "pdf" ||
    value === "text" || value === "d5a" || value === "binary";

/** @同步豁免: 类型守卫 */
export const isFileBrowserPreviewTabData = (value: unknown): value is FileBrowserPreviewTabData =>
    isRecord(value) && typeof value.rootID === "string" && typeof value.path === "string" &&
    typeof value.name === "string";

/** @同步豁免: 类型守卫 */
export const isFileBrowserEditorTabData = (value: unknown): value is FileBrowserEditorTabData =>
    isRecord(value) && typeof value.rootID === "string" && typeof value.path === "string" &&
    typeof value.name === "string";

/** @同步豁免: 类型守卫 */
export const isFileBrowserEditorEncoding = (value: unknown): value is FileBrowserEditorEncoding =>
    value === "utf-8" || value === "utf-8-bom" || value === "utf-16le" || value === "utf-16be";

/** @同步豁免: 类型守卫 */
const isEditorDocumentShape = (value: unknown): value is FileBrowserEditorDocument | FileBrowserEditorWriteResult =>
    isRecord(value) && isFileBrowserRoot(value.root) && isFileBrowserEntry(value.entry) &&
    value.previewKind === "text" && typeof value.contentURL === "string" &&
    isFileBrowserEditorEncoding(value.encoding) && typeof value.size === "number" &&
    Number.isFinite(value.size) && value.size >= 0 && typeof value.updated === "number" &&
    Number.isFinite(value.updated) && typeof value.revision === "string" &&
    typeof value.readOnly === "boolean" && typeof value.language === "string";

/** 严格校验编辑器读取响应。 */
export function parseFileBrowserEditorDocument(value: unknown): FileBrowserEditorDocument {
    if (!isEditorDocumentShape(value) || typeof value.text !== "string") {
        throw new Error("文件编辑器文档响应格式错误");
    }
    return value;
}

/** 严格校验编辑器保存响应。 */
export function parseFileBrowserEditorWriteResult(value: unknown): FileBrowserEditorWriteResult {
    if (!isEditorDocumentShape(value)) {
        throw new Error("文件编辑器保存响应格式错误");
    }
    return value;
}

function isFileBrowserSearchQuery(value: unknown): value is FileBrowserSearchRequest {
    if (!isRecord(value)) {
        return false;
    }
    const stringArray = (item: unknown) => Array.isArray(item) && item.every(entry => typeof entry === "string");
    const order = value.orderBy;
    return (value.keyword === undefined || typeof value.keyword === "string") &&
        (value.rootIDs === undefined || stringArray(value.rootIDs)) &&
        (value.allRoots === undefined || typeof value.allRoots === "boolean") &&
        (value.tags === undefined || stringArray(value.tags)) &&
        (value.matchAllTags === undefined || typeof value.matchAllTags === "boolean") &&
        (value.exts === undefined || stringArray(value.exts)) &&
        (order === undefined || order === "name" || order === "size" || order === "resolution" ||
            order === "star" || order === "updated");
}

/** 校验瀑布流页签恢复数据，拒绝把绝对路径塞进页签持久化。 */
export const isFileBrowserGalleryTabData = (value: unknown): value is FileBrowserGalleryTabData =>
    isRecord(value) && typeof value.rootID === "string" && typeof value.path === "string" &&
    typeof value.name === "string" && (value.scope === undefined || value.scope === "global" ||
        value.scope === "directory") && (value.query === undefined || isFileBrowserSearchQuery(value.query));

/** 把根列表响应收窄到稳定领域契约。 */
export function parseFileBrowserRoots(value: unknown): FileBrowserRoot[] {
    if (!Array.isArray(value) || !value.every(isFileBrowserRoot)) {
        throw new Error("文件根响应格式错误");
    }
    return value;
}

/** 把目录响应收窄到稳定领域契约。 */
export function parseFileBrowserDirectoryPage(value: unknown): FileBrowserDirectoryPage {
    if (!isRecord(value) ||
        !isFileBrowserRoot(value.root) ||
        typeof value.path !== "string" ||
        !Array.isArray(value.entries) ||
        !value.entries.every(isFileBrowserEntry) ||
        typeof value.total !== "number" ||
        typeof value.fileCount !== "number" ||
        typeof value.directoryCount !== "number" ||
        typeof value.offset !== "number" ||
        typeof value.limit !== "number" ||
        typeof value.hasMore !== "boolean") {
        throw new Error("目录列表响应格式错误");
    }
    return {
        root: value.root,
        path: value.path,
        entries: value.entries,
        total: value.total,
        fileCount: value.fileCount,
        directoryCount: value.directoryCount,
        offset: value.offset,
        limit: value.limit,
        hasMore: value.hasMore,
    };
}

/** 把文件统计响应收窄到稳定打开契约。 */
export function parseFileBrowserFileStat(value: unknown): FileBrowserFileStat {
    if (!isRecord(value) || !isFileBrowserRoot(value.root) || !isFileBrowserEntry(value.entry) ||
        typeof value.mediaType !== "string" || !isFileBrowserPreviewKind(value.previewKind) ||
        typeof value.contentURL !== "string" || typeof value.revision !== "string") {
        throw new Error("文件统计响应格式错误");
    }
    return {
        root: value.root, entry: value.entry, mediaType: value.mediaType,
        previewKind: value.previewKind, contentURL: value.contentURL, revision: value.revision,
    };
}

/** 把文本预览响应收窄到有界内容契约。 */
export function parseFileBrowserTextPreview(value: unknown): FileBrowserTextPreview {
    if (!isRecord(value) || typeof value.text !== "string" || typeof value.encoding !== "string" ||
        typeof value.truncated !== "boolean") {
        throw new Error("文本预览响应格式错误");
    }
    return {
        stat: parseFileBrowserFileStat(value.stat),
        text: value.text,
        encoding: value.encoding,
        truncated: value.truncated,
    };
}

/** 把文件操作成功响应收窄为不含绝对路径的稳定包络。 */
export function parseFileBrowserOperationResult(value: unknown): FileBrowserOperationResult {
    if (!isRecord(value) ||
        (value.operation !== "create-directory" && value.operation !== "rename" && value.operation !== "copy")) {
        throw new Error("文件操作响应格式错误");
    }
    const stringFields = ["rootID", "path", "sourceRootID", "sourcePath", "destinationRootID", "destinationPath"] as const;
    for (const field of stringFields) {
        if (value[field] !== undefined && typeof value[field] !== "string") {
            throw new Error(`文件操作响应格式错误：${field} 应为字符串`);
        }
    }
    const numberFields = ["copiedFileCount", "copiedDirectoryCount", "createdDirectoryCount", "copiedBytes"] as const;
    for (const field of numberFields) {
        if (value[field] !== undefined && (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] < 0)) {
            throw new Error(`文件操作响应格式错误：${field} 应为非负有限数字`);
        }
    }
    return {
        operation: value.operation,
        ...(typeof value.rootID === "string" ? {rootID: value.rootID} : {}),
        ...(typeof value.path === "string" ? {path: value.path} : {}),
        ...(typeof value.sourceRootID === "string" ? {sourceRootID: value.sourceRootID} : {}),
        ...(typeof value.sourcePath === "string" ? {sourcePath: value.sourcePath} : {}),
        ...(typeof value.destinationRootID === "string" ? {destinationRootID: value.destinationRootID} : {}),
        ...(typeof value.destinationPath === "string" ? {destinationPath: value.destinationPath} : {}),
        ...(typeof value.copiedFileCount === "number" ? {copiedFileCount: value.copiedFileCount} : {}),
        ...(typeof value.copiedDirectoryCount === "number" ? {copiedDirectoryCount: value.copiedDirectoryCount} : {}),
        ...(typeof value.createdDirectoryCount === "number" ? {createdDirectoryCount: value.createdDirectoryCount} : {}),
        ...(typeof value.copiedBytes === "number" ? {copiedBytes: value.copiedBytes} : {}),
    };
}
