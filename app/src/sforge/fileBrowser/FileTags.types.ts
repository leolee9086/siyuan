/** 用途：标签定义与展示领域类型；使用范围：属性 Dock、标签树和结果查询共享模型。 */
import type {FileBrowserFileRequest} from "./FileBrowser.types";

export interface FileTagDefinition {
    name: string;
    color: string;
}

export interface FileTagDefinitionsSnapshot {
    revision: string;
    items: FileTagDefinition[];
}

export interface FileTagDefinitionsUpdate {
    expectedRevision?: string;
    items: FileTagDefinition[];
}

export type FileTagViewMode = "aggregate" | "per-file";

export interface FileTagPresentation {
    name: string;
    count: number;
    color: string;
    foreground: string;
    configured: boolean;
}

export interface FileTagTreeNode extends FileTagPresentation {
    tag: string;
    children: FileTagTreeNode[];
}

export interface FileTagFilePresentation {
    request: FileBrowserFileRequest;
    name: string;
    tags: FileTagPresentation[];
}

export interface FileTagSearchPort {
    openTagResults(tag: string): void | Promise<void>;
}

export interface FileTagCount {
    name: string;
    count: number;
}

export interface FileTagCountRequest {
    rootIDs?: string[];
    allRoots?: boolean;
}

export interface FileTagCountRepository {
    list(request: FileTagCountRequest): Promise<FileTagCount[]>;
}

export interface FileTagDefinitionsRepository {
    get(): Promise<FileTagDefinitionsSnapshot>;
    update(update: FileTagDefinitionsUpdate): Promise<FileTagDefinitionsSnapshot>;
}
