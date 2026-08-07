/** 用途：Vue 状态原语；使用范围：元数据写入控制器。 */
import {ref} from "./properties/imports";
import type {Ref} from "./properties/imports";
/** 用途：统一异常消息；使用范围：写入失败状态。 */
import {filePropertiesErrorText} from "./FileProperties.errors";
/** 用途：根内地址和选择 revision；使用范围：定向更新与竞态。 */
import type {FileBrowserFileRequest, FileBrowserSelectionStore} from "./FileBrowser.types";
/** 用途：属性写入领域类型；使用范围：批量补丁和结果合并。 */
import type {
    FilePropertiesItem,
    FilePropertiesMetadataPatch,
    FilePropertiesRepository,
    FilePropertiesUpdateItem,
    FilePropertiesUpdateResultItem,
} from "./FileProperties.types";

type PatchFactory = (item: FilePropertiesItem) => FilePropertiesMetadataPatch | undefined;

function addressKey(request: FileBrowserFileRequest) {
    return JSON.stringify([request.rootID, request.path]);
}
function uniqueTags(tags: string[]) {
    const values = new Map<string, string>();
    for (const raw of tags) {
        const tag = raw.trim();
        if (tag) {
            values.set(tag.toLocaleLowerCase(), tag);
        }
    }
    return [...values.values()].sort((left, right) => left.localeCompare(right));
}

function mergeUpdatedItem(item: FilePropertiesItem, updated: FilePropertiesUpdateResultItem | undefined) {
    if (!updated) {
        return item;
    }
    const next: FilePropertiesItem = {...item, metadataPersisted: updated.metadata ? true : item.metadataPersisted};
    delete next.metadataError;
    if (updated.properties) {
        next.properties = updated.properties;
    }
    if (updated.metadata) {
        next.metadata = updated.metadata;
    }
    if (updated.error) {
        next.metadataError = updated.error;
    }
    return next;
}

export class FilePropertiesUpdater {
    public readonly saving = ref(false);
    public readonly saveError = ref("");
    private revision = 0;
    private disposed = false;

    constructor(
        private readonly repository: FilePropertiesRepository,
        private readonly selection: FileBrowserSelectionStore,
        private readonly items: Ref<FilePropertiesItem[]>,
    ) {
    }

    public readonly update = async (updates: FilePropertiesUpdateItem[]) => {
        if (updates.length === 0) {
            this.saveError.value = "当前选择没有可修改的元数据";
            return;
        }
        const revision = ++this.revision;
        const selectionRevision = this.selection.revision.value;
        this.saving.value = true;
        this.saveError.value = "";
        try {
            const result = await this.repository.update(updates);
            if (this.disposed || revision !== this.revision || selectionRevision !== this.selection.revision.value) {
                return;
            }
            const responseByAddress = new Map(result.items.map(item => [addressKey(item.request), item]));
            this.items.value = this.items.value.map(item => mergeUpdatedItem(item, responseByAddress.get(addressKey(item.request))));
            this.saveError.value = result.items.filter(item => item.error).map(item => item.error?.message).filter(Boolean).join("；");
        } catch (error) {
            if (!this.disposed && revision === this.revision) {
                this.saveError.value = filePropertiesErrorText(error);
            }
        } finally {
            if (revision === this.revision) {
                this.saving.value = false;
            }
        }
    };

    private updatesFor(patchFor: PatchFactory) {
        return this.items.value.flatMap<FilePropertiesUpdateItem>(item => {
            const patch = patchFor(item);
            if (!patch || !item.properties || !item.metadata || !item.metadataWritable || item.error) {
                return [];
            }
            return [{request: item.request, revision: item.properties.revision, patch}];
        });
    }

    public readonly applyPatch = (patch: FilePropertiesMetadataPatch) => this.update(this.updatesFor(() => patch));

    public readonly addTag = (tag: string, request?: FileBrowserFileRequest) => this.update(this.updatesFor(item => {
        if (request && addressKey(request) !== addressKey(item.request)) {
            return undefined;
        }
        return {tags: uniqueTags([...(item.metadata?.tags ?? []), tag])};
    }));

    public readonly removeTag = (tag: string, request?: FileBrowserFileRequest) => this.update(this.updatesFor(item => {
        if (request && addressKey(request) !== addressKey(item.request)) {
            return undefined;
        }
        const normalized = tag.toLocaleLowerCase();
        return {tags: (item.metadata?.tags ?? []).filter(value => value.toLocaleLowerCase() !== normalized)};
    }));

    public dispose() {
        this.disposed = true;
        this.revision++;
    }
}
