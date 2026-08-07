<template>
    <section class="sforge-file-tag-tree" aria-label="文件标签树" :aria-busy="loading || actionBusy">
        <header class="block__icons sforge-file-tag-tree__header">
            <div class="block__logo">
                <svg class="block__logoicon"><use href="#iconTags" /></svg>
                <span>标签</span>
            </div>
            <span class="fn__flex-1" />
            <button type="button" class="block__icon ariaLabel" aria-label="刷新标签"
                :disabled="loading" @click="refresh">
                <svg :class="{'fn__rotate': loading}"><use href="#iconRefresh" /></svg>
            </button>
            <button type="button" class="block__icon ariaLabel" aria-label="折叠全部标签"
                :disabled="expanded.size === 0 || folded" @click="collapseAll">
                <svg><use href="#iconContract" /></svg>
            </button>
            <button type="button" class="block__icon ariaLabel" :aria-label="folded ? '展开标签' : '最小化标签'"
                :aria-expanded="!folded" @click="folded = !folded">
                <svg><use :href="folded ? '#iconRight' : '#iconUp'" /></svg>
            </button>
        </header>
        <template v-if="!folded">
            <div v-if="error" class="sforge-file-tag-tree__state sforge-file-tag-tree__state--error">
                <span>{{ error }}</span>
                <button type="button" class="b3-button b3-button--text" @click="refresh">重试</button>
            </div>
            <div v-else-if="loading && !hasTags" class="sforge-file-tag-tree__state">
                <svg class="fn__rotate"><use href="#iconRefresh" /></svg><span>正在读取标签</span>
            </div>
            <div v-else-if="!hasTags" class="sforge-file-tag-tree__state">没有已索引标签</div>
            <ul v-else class="b3-list b3-list--background sforge-file-tag-tree__list" role="tree">
                <FileTagTreeNode v-for="node in nodes" :key="node.tag" :node="node" :expanded-keys="expanded"
                    :level="1" @toggle="toggle" @open="emit('open-tag', $event)"
                    @open-notes="emit('open-notes', $event)" @drop="handleDrop" @delete="handleDelete" />
            </ul>
            <p v-if="actionError" class="sforge-file-tag-tree__state sforge-file-tag-tree__state--error">
                {{ actionError }}
            </p>
        </template>
    </section>
</template>

<script setup lang="ts">
/** 用途：标签树刷新与根节点交互；使用范围：文件浏览 Dock 侧栏。 */
import {onBeforeUnmount, onMounted, ref} from "vue";
import FileTagTreeNode from "./FileTagTreeNode.vue";
import {useFileTagTree} from "./useFileTagTree";
import {
    fileTagCountRepository,
    fileTagDefinitionsRepository,
    fileTagMutationRepository,
} from "./FileTags.repository";
import type {
    FileTagCountRepository,
    FileTagDefinitionsRepository,
    FileTagMutationRepository,
    FileTagTreeNode as TagNode,
} from "./FileTags.types";

const props = defineProps<{
    countRepository?: FileTagCountRepository;
    definitionsRepository?: FileTagDefinitionsRepository;
    mutationRepository?: FileTagMutationRepository;
    eventBus?: unknown;
    confirmDelete?: (tag: TagNode) => boolean | Promise<boolean>;
}>();

const emit = defineEmits<{
    "open-tag": [tag: string];
    "open-notes": [tag: string];
}>();

const tree = useFileTagTree(
    props.countRepository ?? fileTagCountRepository,
    props.definitionsRepository ?? fileTagDefinitionsRepository,
);
const {nodes, definitions, loading, error, expanded, hasTags, refresh, toggle, dispose} = tree;
const mutationRepository = props.mutationRepository ?? fileTagMutationRepository;
const folded = ref(false);
const actionBusy = ref(false);
const actionError = ref("");
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let unbindEventBus: (() => void) | undefined;

function collapseAll() {
    expanded.value = new Set();
}

function parseDroppedRequest(event: DragEvent) {
    const raw = event.dataTransfer?.getData("application/x-sforge-file");
    if (!raw) {
        return undefined;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || typeof parsed.rootID !== "string" || typeof parsed.path !== "string" ||
            parsed.kind !== "file" || !parsed.rootID.trim() || !parsed.path.trim()) {
            return undefined;
        }
        return {rootID: parsed.rootID, path: parsed.path};
    } catch {
        return undefined;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

async function handleDrop(payload: {tag: string; event: DragEvent}) {
    const request = parseDroppedRequest(payload.event);
    if (!request) {
        actionError.value = "只接受文件树或资源瀑布流中的已授权文件";
        return;
    }
    actionBusy.value = true;
    actionError.value = "";
    try {
        await mutationRepository.add([request], payload.tag);
        await refresh();
    } catch (reason) {
        actionError.value = reason instanceof Error ? reason.message : String(reason);
        // 批量写入允许部分成功；失败也要重新读取计数，避免树继续显示旧索引。
        await refresh();
    } finally {
        actionBusy.value = false;
    }
}

function findNode(tag: string, candidates: TagNode[] = nodes.value): TagNode | undefined {
    for (const node of candidates) {
        if (node.tag.toLocaleLowerCase() === tag.toLocaleLowerCase()) {
            return node;
        }
        const child = findNode(tag, node.children);
        if (child) {
            return child;
        }
    }
    return undefined;
}

async function handleDelete(tag: string) {
    const node = findNode(tag);
    if (!node || !node.removed) {
        return;
    }
    if (props.confirmDelete && !(await props.confirmDelete(node))) {
        return;
    }
    const repository = props.definitionsRepository ?? fileTagDefinitionsRepository;
    const normalized = tag.trim().toLocaleLowerCase();
    const items = definitions.value.items.filter(item => item.name.trim().toLocaleLowerCase() !== normalized);
    actionBusy.value = true;
    actionError.value = "";
    try {
        await repository.update({expectedRevision: definitions.value.revision, items});
        await refresh();
    } catch (reason) {
        actionError.value = reason instanceof Error ? reason.message : String(reason);
    } finally {
        actionBusy.value = false;
    }
}

function scheduleRefresh() {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        void refresh();
    }, 120);
}

function bindEventBus(value: unknown) {
    if (!isRecord(value) || typeof value.on !== "function" || typeof value.off !== "function") {
        return undefined;
    }
    const bus = value as {
        on: (type: "ws-main", listener: (event: CustomEvent<{cmd?: string}>) => unknown) => void;
        off: (type: "ws-main", listener: (event: CustomEvent<{cmd?: string}>) => unknown) => void;
    };
    const listener = (event: CustomEvent<{cmd?: string}>) => {
        if (event.detail?.cmd === "transactions") {
            scheduleRefresh();
        }
    };
    bus.on("ws-main", listener);
    return () => bus.off("ws-main", listener);
}

onMounted(() => {
    void refresh();
    unbindEventBus = bindEventBus(props.eventBus);
});
onBeforeUnmount(() => {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
    }
    unbindEventBus?.();
    dispose();
});
</script>

<style scoped lang="scss" src="./FileTagTree.scss"></style>
