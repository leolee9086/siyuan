/** 用途：标签定义网络仓储；使用范围：属性 Dock 和未来标签树。 */
import {fetchSyncPost} from "./repository/imports";
import {requireFileBrowserResponseData} from "./FileBrowser.repository";
import {parseFileTagCounts, parseFileTagDefinitionsSnapshot} from "./FileTags.guards";
import type {
    FileTagCount,
    FileTagCountRequest,
    FileTagCountRepository,
    FileTagDefinitionsRepository,
    FileTagDefinitionsSnapshot,
    FileTagDefinitionsUpdate,
} from "./FileTags.types";

const GET_ENDPOINT = "/api/s-forge/file-browser/tag-definitions";
const UPDATE_ENDPOINT = "/api/s-forge/file-browser/tag-definitions/set";
const COUNTS_ENDPOINT = "/api/s-forge/file-browser/tags";

export async function getFileTagDefinitions(): Promise<FileTagDefinitionsSnapshot> {
    const response = await fetchSyncPost(GET_ENDPOINT, {});
    return parseFileTagDefinitionsSnapshot(requireFileBrowserResponseData(response, "读取标签定义"));
}

export async function updateFileTagDefinitions(update: FileTagDefinitionsUpdate): Promise<FileTagDefinitionsSnapshot> {
    const response = await fetchSyncPost(UPDATE_ENDPOINT, update);
    return parseFileTagDefinitionsSnapshot(requireFileBrowserResponseData(response, "更新标签定义"));
}

export async function listFileTagCounts(request: FileTagCountRequest): Promise<FileTagCount[]> {
    const response = await fetchSyncPost(COUNTS_ENDPOINT, request);
    return parseFileTagCounts(requireFileBrowserResponseData(response, "读取标签计数"));
}

export const fileTagDefinitionsRepository: FileTagDefinitionsRepository = {
    get: getFileTagDefinitions,
    update: updateFileTagDefinitions,
};

export const fileTagCountRepository: FileTagCountRepository = {
    list: listFileTagCounts,
};
