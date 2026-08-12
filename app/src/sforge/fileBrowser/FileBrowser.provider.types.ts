/** 用途：外部文件 provider 的公开地址和仓储契约；使用范围：文件树与画廊数据边界。 */
import type {
    FileBrowserFileRequest,
    FileBrowserPreviewKind,
    FileBrowserSortDirection,
    FileBrowserSortField,
} from "./FileBrowser.core.types";

export type FileBrowserProviderID = "windows-smb-mount" | "synology-file-station" | "s3" | "webdav" | string;

export type FileBrowserProviderKind = "catalog" | "object-store" | "file-share" | "local" | string;

export type FileBrowserProviderSessionMode = "none" | "automatic" | "configured";

export type FileBrowserProviderSessionFieldTarget = "endpoint" | "credential" | "option";

export type FileBrowserProviderSessionFieldInput = "text" | "password" | "url" | "checkbox";

export interface FileBrowserProviderSessionField {
    target: FileBrowserProviderSessionFieldTarget;
    key: string;
    label: string;
    input: FileBrowserProviderSessionFieldInput;
    required?: boolean;
    requiredWith?: string[];
    placeholder?: string;
    defaultValue?: string;
    autocomplete?: string;
}

export interface FileBrowserProviderSessionConfig {
    fields: FileBrowserProviderSessionField[];
    readOnly?: boolean;
    endpointTransport?: "https-or-confirmed-private-http";
}

export interface FileBrowserProviderDescriptor {
    id: FileBrowserProviderID;
    displayName: string;
    kind: FileBrowserProviderKind;
    sessionMode: FileBrowserProviderSessionMode;
    sessionLabel?: string;
    sessionConfig?: FileBrowserProviderSessionConfig;
    capabilities: string[];
}

/** Provider 在当前 session 中返回的展示元数据；它不是设备身份或树层级。 */
export interface FileBrowserProviderSource {
    name: string;
    kind: string;
    metadata?: Record<string, string>;
}

export interface FileBrowserProviderAlias {
    kind: string;
    label: string;
}

/** provider 资源根的稳定公开地址；不包含盘符、UNC、DSM 路径或 object key。 */
export interface FileBrowserProviderResourceAddress {
    kind: "provider-resource";
    provider: FileBrowserProviderID;
    session: string;
    resource: string;
}

/** provider 条目地址；token 由 Kernel 发放并绑定 session/resource。 */
export interface FileBrowserProviderEntryAddress {
    kind: "provider-entry";
    provider: FileBrowserProviderID;
    session: string;
    resource: string;
    token: string;
}

export interface FileBrowserProviderSessionAddress {
    kind: "provider-session";
    provider: FileBrowserProviderID;
    session: string;
}

export interface FileBrowserLocalAddress extends FileBrowserFileRequest {
    kind: "local";
}

export type FileBrowserAddress = FileBrowserLocalAddress | FileBrowserProviderResourceAddress |
    FileBrowserProviderEntryAddress;

export interface FileBrowserProviderResource {
    id: string;
    name: string;
    kind: string;
    readOnly: boolean;
    capabilities: string[];
    source: FileBrowserProviderSource;
    address: FileBrowserProviderResourceAddress;
    aliases?: FileBrowserProviderAlias[];
}

export interface FileBrowserProviderResourcePage {
    resources: FileBrowserProviderResource[];
    total?: number;
    limit: number;
    nextCursor?: string;
    hasMore: boolean;
}

export interface FileBrowserProviderSession {
    address: FileBrowserProviderSessionAddress;
    label: string;
    readOnly: boolean;
    descriptor: FileBrowserProviderDescriptor;
}

export interface FileBrowserProviderSessionOpenRequest {
    provider: FileBrowserProviderID;
    endpoint?: string;
    credentialRef?: string;
    credentials?: Record<string, unknown>;
    options?: Record<string, unknown>;
    readOnly?: boolean;
    /** 只确认当前 session 使用未加密 HTTP；不构成 provider 或设备身份。 */
    insecureHTTPConfirmed?: boolean;
}

export interface FileBrowserProviderPageRequest {
    cursor?: string;
    limit: number;
}

export interface FileBrowserProviderRevision {
    etag?: string;
    versionID?: string;
    modifiedAt?: string;
    size?: number;
}

/** provider 条目不携带本地 root/path 地址，路径只由 Kernel opaque token 表示。 */
export interface FileBrowserProviderEntry {
    id: string;
    name: string;
    kind: "file" | "directory" | "object" | "bucket";
    isDir: boolean;
    size: number;
    modified: number;
    created: number;
    extension?: string;
    mediaType?: string;
    revision: FileBrowserProviderRevision;
    metadata?: Record<string, string>;
    address: FileBrowserProviderEntryAddress;
    previewKind: FileBrowserPreviewKind;
    contentURL?: string;
}

export interface FileBrowserProviderDirectoryPage {
    parent: FileBrowserProviderResourceAddress | FileBrowserProviderEntryAddress;
    entries: FileBrowserProviderEntry[];
    total: number;
    totalKnown: boolean;
    limit: number;
    nextCursor?: string;
    hasMore: boolean;
}

export interface FileBrowserProviderEntryStat extends FileBrowserProviderEntry {
    revisionValue: string;
}

export interface FileBrowserProviderListRequest {
    parent: FileBrowserProviderResourceAddress | FileBrowserProviderEntryAddress;
    page: FileBrowserProviderPageRequest;
    sortBy: FileBrowserSortField;
    sortDirection: FileBrowserSortDirection;
    directoriesFirst: boolean;
}

/** 外部 provider session/resource 仓储与本地文件仓储保持显式分离。 */
export interface FileBrowserProviderRepository {
    listProviders(): Promise<FileBrowserProviderDescriptor[]>;
    openSession(request: FileBrowserProviderSessionOpenRequest): Promise<FileBrowserProviderSession>;
    closeSession(address: FileBrowserProviderSessionAddress): Promise<void>;
    listResources(
        session: FileBrowserProviderSessionAddress,
        page: FileBrowserProviderPageRequest,
    ): Promise<FileBrowserProviderResourcePage>;
    listDirectory(request: FileBrowserProviderListRequest): Promise<FileBrowserProviderDirectoryPage>;
    statEntry(address: FileBrowserProviderEntryAddress): Promise<FileBrowserProviderEntryStat>;
}
