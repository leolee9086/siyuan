/** 用途：查询请求竞态控制；使用范围：文件 Dock 搜索表单和结果列表。 */
import {computed, ref} from "vue";
import {fileBrowserQueryRepository} from "./FileBrowser.query.repository";
import type {
    FileBrowserQueryRepository,
    FileBrowserSearchRequest,
    FileBrowserSearchResult,
} from "./FileBrowser.query.types";

/** 创建一个只接受最新响应的查询控制器，避免快速筛选时旧结果覆盖新结果。 */
export function useFileBrowserSearch(repository: FileBrowserQueryRepository = fileBrowserQueryRepository) {
    const result = ref<FileBrowserSearchResult>({assets: [], totalCount: 0, pageCount: 0});
    const loading = ref(false);
    const error = ref("");
    const revision = ref(0);
    let disposed = false;

    async function search(request: FileBrowserSearchRequest) {
        const current = ++revision.value;
        loading.value = true;
        error.value = "";
        try {
            const next = await repository.search(request);
            if (!disposed && current === revision.value) {
                result.value = next;
            }
            return next;
        } catch (reason) {
            if (!disposed && current === revision.value) {
                error.value = reason instanceof Error ? reason.message : String(reason);
            }
            return undefined;
        } finally {
            if (!disposed && current === revision.value) {
                loading.value = false;
            }
        }
    }

    function clear() {
        ++revision.value;
        result.value = {assets: [], totalCount: 0, pageCount: 0};
        error.value = "";
        loading.value = false;
    }

    function dispose() {
        disposed = true;
        ++revision.value;
    }

    return {
        result: computed(() => result.value),
        loading: computed(() => loading.value),
        error: computed(() => error.value),
        search,
        clear,
        dispose,
    };
}
