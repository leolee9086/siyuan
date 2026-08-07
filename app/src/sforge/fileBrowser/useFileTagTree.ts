/** 用途：标签树刷新竞态与组合状态；使用范围：文件浏览 Dock 的标签侧栏。 */
import {computed, ref} from "vue";
import {fileTagCountRepository, fileTagDefinitionsRepository} from "./FileTags.repository";
import {createFileTagTreeNodes} from "./FileTags.presentation";
import type {
    FileTagCountRepository,
    FileTagDefinitionsRepository,
    FileTagDefinitionsSnapshot,
    FileTagTreeNode,
} from "./FileTags.types";

export function useFileTagTree(
    countRepository: FileTagCountRepository = fileTagCountRepository,
    definitionsRepository: FileTagDefinitionsRepository = fileTagDefinitionsRepository,
) {
    const nodes = ref<FileTagTreeNode[]>([]);
    const loading = ref(false);
    const error = ref("");
    const definitions = ref<FileTagDefinitionsSnapshot>({revision: "", items: []});
    const revision = ref(0);
    const expanded = ref<Set<string>>(new Set());
    let disposed = false;

    async function refresh() {
        const current = ++revision.value;
        loading.value = true;
        error.value = "";
        try {
            const [counts, snapshot] = await Promise.all([
                countRepository.list({allRoots: true}),
                definitionsRepository.get(),
            ]);
            if (!disposed && current === revision.value) {
                definitions.value = snapshot;
                nodes.value = createFileTagTreeNodes(counts, snapshot.items);
            }
        } catch (reason) {
            if (!disposed && current === revision.value) {
                error.value = reason instanceof Error ? reason.message : String(reason);
            }
        } finally {
            if (!disposed && current === revision.value) {
                loading.value = false;
            }
        }
    }

    function toggle(tag: string) {
        const next = new Set(expanded.value);
        if (next.has(tag)) {
            next.delete(tag);
        } else {
            next.add(tag);
        }
        expanded.value = next;
    }

    function dispose() {
        disposed = true;
        ++revision.value;
    }

    const hasTags = computed(() => nodes.value.length > 0);
    return {nodes, definitions, loading, error, expanded, hasTags, refresh, toggle, dispose};
}
