/** 用途：预览、编辑器和页签契约；使用范围：本地文件读取与视图宿主。 */
import type {
    FileBrowserDirectoryPage,
    FileBrowserEntry,
    FileBrowserFileRequest,
    FileBrowserListRequest,
    FileBrowserPreviewKind,
    FileBrowserRoot,
} from "./FileBrowser.core.types";

/** 已经通过 Kernel 边界校验的文件统计和打开目标。 */
export interface FileBrowserFileStat {
    root: FileBrowserRoot;
    entry: FileBrowserEntry;
    mediaType: string;
    previewKind: FileBrowserPreviewKind;
    contentURL: string;
    revision: string;
}

/** 有界文本预览请求。 */
export interface FileBrowserPreviewRequest extends FileBrowserFileRequest {
    maxBytes?: number;
}

/** 统一预览响应；文本与格式 loader 结果共用同一个 API。 */
export interface FileBrowserTextPreview {
    stat: FileBrowserFileStat;
    text: string;
    encoding: string;
    truncated: boolean;
}

export interface FileBrowserStructuredPreview {
    stat: FileBrowserFileStat;
    provider: "d5a";
    data: FileBrowserD5AInspectionReport;
}

export type FileBrowserPreview = FileBrowserTextPreview | FileBrowserStructuredPreview;

/** D5A/D5Mesh parser summary used by the file-browser preview surface. */
export interface FileBrowserD5AMeshSummary {
    version: number;
    sourceBytes: number;
    triangleCount: number;
    vertexCount: number;
    descriptorCount: number;
    geometryGroupCount: number;
    metadataTriangleCount?: number;
}

/** One D5Mesh/material bundle discovered inside a D5A container. */
export interface FileBrowserD5ABundleSummary {
    id: string;
    meshEntry: string;
    infoEntry?: string;
    status: string;
    mesh?: FileBrowserD5AMeshSummary;
    material?: {
        title: string;
        infoVersion?: number;
        materialCount: number;
        textureReferenceCount: number;
    };
    warnings: string[];
}

/** Versioned structural report from the migrated D5A domain package. */
export interface FileBrowserD5AInspectionReport {
    schemaVersion: number;
    documentKind: string;
    operation: string;
    status: string;
    format: string;
    elapsedMs: number;
    warnings: string[];
    d5a?: {
        variant: string;
        entryCount: number;
        fileEntryCount: number;
        encryptedEntryCount: number;
        compressedBytes: number;
        uncompressedBytes: number;
        groupInfoEntry?: string;
        bundles: FileBrowserD5ABundleSummary[];
    };
}

/** 编码后的本地编辑文档；文本内容来自已授权根的有界快照。 */
export type FileBrowserEditorEncoding = "utf-8" | "utf-8-bom" | "utf-16le" | "utf-16be";

/** 本地编辑器读取请求；客户端只携带根 ID 和根相对路径。 */
export interface FileBrowserEditorReadRequest extends FileBrowserFileRequest {
    maxBytes?: number;
}

/** 本地编辑器保存请求；revision 是读取快照的精确字节版本。 */
export interface FileBrowserEditorWriteRequest extends FileBrowserFileRequest {
    text: string;
    encoding: FileBrowserEditorEncoding;
    revision: string;
    maxBytes?: number;
}

/** 编辑器页签消费的完整本地文本快照。 */
export interface FileBrowserEditorDocument {
    root: FileBrowserRoot;
    entry: FileBrowserEntry;
    previewKind: "text";
    contentURL: string;
    text: string;
    encoding: FileBrowserEditorEncoding;
    size: number;
    updated: number;
    revision: string;
    readOnly: boolean;
    language: string;
}

/** 原子保存后的新版本元数据。 */
export interface FileBrowserEditorWriteResult {
    root: FileBrowserRoot;
    entry: FileBrowserEntry;
    previewKind: "text";
    contentURL: string;
    encoding: FileBrowserEditorEncoding;
    size: number;
    updated: number;
    revision: string;
    readOnly: boolean;
    language: string;
}

/** 文件浏览器的唯一前端数据入口。 */
export interface FileBrowserRepository {
    listRoots(): Promise<FileBrowserRoot[]>;
    listDirectory(request: FileBrowserListRequest): Promise<FileBrowserDirectoryPage>;
    statFile(request: FileBrowserFileRequest): Promise<FileBrowserFileStat>;
    previewFile(request: FileBrowserPreviewRequest): Promise<FileBrowserPreview>;
    readEditorFile(request: FileBrowserEditorReadRequest): Promise<FileBrowserEditorDocument>;
    writeEditorFile(request: FileBrowserEditorWriteRequest): Promise<FileBrowserEditorWriteResult>;
}

/** 自定义预览页签的稳定身份数据。 */
export interface FileBrowserPreviewTabData extends FileBrowserFileRequest {
    name: string;
}

/** 独立文件瀑布流页签的稳定范围；路径仍相对授权根。 */
export interface FileBrowserGalleryTabData extends FileBrowserFileRequest {
    name: string;
    /** 全根结果页签的稳定范围标记；筛选条件变化不应改变页签类型。 */
    scope?: "global" | "directory";
    query?: import("./FileBrowser.query.types").FileBrowserSearchRequest;
}

/** 只读预览组件参数。 */
export interface FileBrowserPreviewPanelProps {
    file: FileBrowserPreviewTabData;
}

/** 自定义文本编辑页签的稳定入口数据。 */
export interface FileBrowserEditorTabData extends FileBrowserFileRequest {
    name: string;
}

/** 网络文本页签的稳定入口数据；网络资源不伪装成授权本地根。 */
export interface FileBrowserNetworkTabData {
    uri: string;
    name: string;
}
