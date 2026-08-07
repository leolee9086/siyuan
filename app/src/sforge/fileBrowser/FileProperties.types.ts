/** 用途：文件浏览基础地址和物理类型；使用范围：属性 Dock API 契约。 */
import type {
    FileBrowserEntry,
    FileBrowserFileRequest,
    FileBrowserPreviewKind,
    FileBrowserRoot,
} from "./FileBrowser.types";

/** 图片调色板索引记录。 */
export interface FilePropertiesPalette {
    color: [number, number, number];
    ratio: number;
    h: number;
    s: number;
    l: number;
}

/** 工作空间主数据中的标签、星级、注释、来源和媒体属性。 */
export interface FilePropertiesMetadata {
    rootID: string;
    path: string;
    name: string;
    tags: string[];
    star: number;
    annotation: string;
    boundBlockId: string;
    source: string;
    sourceId: string;
    importTime: number;
    width?: number;
    height?: number;
    fileSize?: number;
    palettes?: FilePropertiesPalette[];
}

/** 已授权文件或目录的物理属性。 */
export interface FilePropertiesPhysical {
    root: FileBrowserRoot;
    entry: FileBrowserEntry;
    mediaType?: string;
    previewKind: FileBrowserPreviewKind;
    contentURL?: string;
    revision: string;
    created?: number;
    width?: number;
    height?: number;
    readOnly: boolean;
}

/** 批量属性读取的稳定单项错误。 */
export interface FilePropertiesFailure {
    code: string;
    message: string;
}

/** 一个选择项的物理属性和私有元数据。 */
export interface FilePropertiesItem {
    request: FileBrowserFileRequest;
    properties?: FilePropertiesPhysical;
    metadata?: FilePropertiesMetadata;
    metadataPersisted: boolean;
    metadataWritable: boolean;
    error?: FilePropertiesFailure;
    metadataError?: FilePropertiesFailure;
}

/** 批量属性读取响应。 */
export interface FilePropertiesInspectResult {
    items: FilePropertiesItem[];
    successCount: number;
    failureCount: number;
    metadataFailureCount: number;
}

/** 可部分修改的私有元数据字段。 */
export interface FilePropertiesMetadataPatch {
    tags?: string[];
    star?: number;
    annotation?: string;
    boundBlockID?: string;
    source?: string;
    sourceID?: string;
}

/** 单项元数据修改请求。 */
export interface FilePropertiesUpdateItem {
    request: FileBrowserFileRequest;
    revision?: string;
    patch: FilePropertiesMetadataPatch;
}

/** 单项元数据修改结果。 */
export interface FilePropertiesUpdateResultItem {
    request: FileBrowserFileRequest;
    properties?: FilePropertiesPhysical;
    metadata?: FilePropertiesMetadata;
    error?: FilePropertiesFailure;
}

/** 批量元数据修改响应。 */
export interface FilePropertiesUpdateResult {
    items: FilePropertiesUpdateResultItem[];
    successCount: number;
    failureCount: number;
}

/** 属性 Dock 唯一后端仓储端口。 */
export interface FilePropertiesRepository {
    inspect(items: FileBrowserFileRequest[]): Promise<FilePropertiesInspectResult>;
    update(items: FilePropertiesUpdateItem[]): Promise<FilePropertiesUpdateResult>;
}
