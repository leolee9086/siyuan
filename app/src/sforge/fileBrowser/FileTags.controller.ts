/** 用途：Vue 标签定义状态；使用范围：属性 Dock 标签控制器。 */
import {ref} from "./properties/imports";
/** 用途：统一异常消息；使用范围：标签定义读写失败。 */
import {filePropertiesErrorText} from "./FileProperties.errors";
/** 用途：标签定义领域契约；使用范围：快照、模式与仓储。 */
import type {
    FileTagDefinition,
    FileTagDefinitionsRepository,
    FileTagDefinitionsSnapshot,
    FileTagViewMode,
} from "./FileTags.types";

function normalizedTagColor(name: string, color: string) {
    const normalizedName = name.trim();
    const normalizedColor = color.trim().toUpperCase();
    if (!normalizedName || (normalizedColor && !/^#[0-9A-F]{6}$/.test(normalizedColor))) {
        return undefined;
    }
    return {name: normalizedName, color: normalizedColor};
}
function replaceDefinition(items: FileTagDefinition[], replacement: FileTagDefinition) {
    const key = replacement.name.toLocaleLowerCase();
    const next = items.filter(item => item.name.trim().toLocaleLowerCase() !== key);
    next.push(replacement);
    return next;
}

export class FileTagsController {
    public readonly definitions = ref<FileTagDefinitionsSnapshot>({revision: "", items: []});
    public readonly loading = ref(false);
    public readonly error = ref("");
    public readonly ready = ref(false);
    public readonly viewMode = ref<FileTagViewMode>("aggregate");
    private loadRevision = 0;
    private saveRevision = 0;
    private disposed = false;
    private updateQueue: Promise<void> = Promise.resolve();

    constructor(private readonly repository: FileTagDefinitionsRepository) {
    }

    public readonly refresh = async () => {
        const revision = ++this.loadRevision;
        this.loading.value = true;
        this.error.value = "";
        try {
            const snapshot = await this.repository.get();
            if (!this.disposed && revision === this.loadRevision) {
                this.definitions.value = snapshot;
                this.ready.value = true;
            }
        } catch (error) {
            if (!this.disposed && revision === this.loadRevision) {
                this.error.value = filePropertiesErrorText(error);
            }
        } finally {
            if (revision === this.loadRevision) {
                this.loading.value = false;
            }
        }
    };

    public readonly setColor = (name: string, color: string) => {
        const operation = this.updateQueue.then(() => this.setColorNow(name, color));
        this.updateQueue = operation.catch(() => undefined);
        return operation;
    };

    private async setColorNow(name: string, color: string) {
        const replacement = normalizedTagColor(name, color);
        if (!replacement) {
            this.error.value = "标签名称或颜色格式错误";
            return;
        }
        if (!this.ready.value) {
            await this.refresh();
            if (!this.ready.value) {
                return;
            }
        }
        await this.persistColor(replacement);
    }

    private async persistColor(replacement: FileTagDefinition) {
        const revision = ++this.saveRevision;
        const current = this.definitions.value;
        this.loading.value = true;
        this.error.value = "";
        try {
            const snapshot = await this.repository.update({
                expectedRevision: current.revision,
                items: replaceDefinition(current.items, replacement),
            });
            if (!this.disposed && revision === this.saveRevision) {
                this.definitions.value = snapshot;
            }
        } catch (error) {
            if (!this.disposed && revision === this.saveRevision) {
                this.error.value = filePropertiesErrorText(error);
            }
        } finally {
            if (revision === this.saveRevision) {
                this.loading.value = false;
            }
        }
    }

    public dispose() {
        this.disposed = true;
        this.loadRevision++;
        this.saveRevision++;
    }
}
