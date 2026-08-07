/** 用途：标签定义网络仓储；使用范围：属性 Dock 和未来标签树。 */
import {fetchSyncPost} from "./repository/imports";
import {requireFileBrowserResponseData} from "./FileBrowser.repository";
import {parseFileTagCounts, parseFileTagDefinitionsSnapshot} from "./FileTags.guards";
import {filePropertiesRepository} from "./FileProperties.repository";
import type {
    FileTagCount,
    FileTagCountRequest,
    FileTagCountRepository,
    FileTagDefinitionsRepository,
    FileTagDefinitionsSnapshot,
    FileTagDefinitionsUpdate,
    FileTagMutationRepository,
} from "./FileTags.types";
import type {FileBrowserFileRequest} from "./FileBrowser.types";
import type {FilePropertiesUpdateItem} from "./FileProperties.types";

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

function uniqueRequests(requests: FileBrowserFileRequest[]) {
    const seen = new Set<string>();
    return requests.filter(request => {
        const key = `${request.rootID}\n${request.path}`;
        if (!request.rootID || !request.path || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function addUniqueTag(tags: string[], tag: string) {
    const normalized = tag.trim();
    const existing = new Set(tags.map(value => value.trim().toLocaleLowerCase()).filter(Boolean));
    return existing.has(normalized.toLocaleLowerCase()) ? tags : [...tags, normalized];
}

/** 复用属性 Dock 的批量写入契约，为标签树拖放提供窄领域端口。 */
export async function addFilesToFileTag(requests: FileBrowserFileRequest[], tag: string) {
    const normalizedTag = tag.trim();
    if (!normalizedTag) {
        throw new Error("标签名称不能为空");
    }
    const unique = uniqueRequests(requests);
    if (unique.length === 0) {
        throw new Error("拖放数据不包含已授权文件");
    }
    const failures: string[] = [];
    let updated = 0;
    for (let offset = 0; offset < unique.length; offset += 100) {
        const chunk = unique.slice(offset, offset + 100);
        const inspected = await filePropertiesRepository.inspect(chunk);
        const updates: FilePropertiesUpdateItem[] = [];
        for (const item of inspected.items) {
            if (item.error || !item.properties || !item.metadataWritable) {
                failures.push(item.error?.message ?? `${item.request.rootID}:${item.request.path} 不允许写入属性`);
                continue;
            }
            updates.push({
                request: item.request,
                revision: item.properties.revision,
                patch: {tags: addUniqueTag(item.metadata?.tags ?? [], normalizedTag)},
            });
        }
        if (updates.length === 0) {
            continue;
        }
        const result = await filePropertiesRepository.update(updates);
        updated += result.successCount;
        failures.push(...result.items.filter(item => item.error).map(item => item.error?.message).filter(Boolean) as string[]);
    }
    if (updated === 0 || failures.length > 0) {
        throw new Error(failures.length > 0 ? failures.join("；") : "没有文件被添加到标签");
    }
}

export const fileTagMutationRepository: FileTagMutationRepository = {
    add: addFilesToFileTag,
};
