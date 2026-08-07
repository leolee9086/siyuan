/** 用途：Vue 状态原语；使用范围：属性读取控制器。 */
import {ref} from "./properties/imports";
/** 用途：统一异常消息；使用范围：读取失败状态。 */
import {filePropertiesErrorText} from "./FileProperties.errors";
/** 用途：共享选择契约；使用范围：请求地址和响应竞态。 */
import type {FileBrowserSelectionStore} from "./FileBrowser.types";
/** 用途：属性仓储和单项结果；使用范围：读取状态。 */
import type {FilePropertiesItem, FilePropertiesRepository} from "./FileProperties.types";

export class FilePropertiesLoader {
    public readonly items = ref<FilePropertiesItem[]>([]);
    public readonly loading = ref(false);
    public readonly loadError = ref("");
    private revision = 0;
    private disposed = false;

    constructor(
        private readonly repository: FilePropertiesRepository,
        private readonly selection: FileBrowserSelectionStore,
    ) {
    }

    public readonly refresh = async () => {
        const revision = ++this.revision;
        const selectionRevision = this.selection.revision.value;
        const requests = this.selection.items.value.map(({rootID, path}) => ({rootID, path}));
        this.loadError.value = "";
        if (requests.length === 0) {
            this.items.value = [];
            this.loading.value = false;
            return;
        }
        this.loading.value = true;
        try {
            const result = await this.repository.inspect(requests);
            if (!this.disposed && revision === this.revision && selectionRevision === this.selection.revision.value) {
                this.items.value = result.items;
            }
        } catch (error) {
            if (!this.disposed && revision === this.revision) {
                this.loadError.value = filePropertiesErrorText(error);
            }
        } finally {
            if (revision === this.revision) {
                this.loading.value = false;
            }
        }
    };

    public dispose() {
        this.disposed = true;
        this.revision++;
    }
}
