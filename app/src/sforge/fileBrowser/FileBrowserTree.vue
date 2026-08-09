<template>
    <ul class="b3-list b3-list--background sforge-file-tree" role="tree"
        aria-label="工作空间和 Agent 任务目录" aria-multiselectable="true" tabindex="-1">
        <FileBrowserTreeNode v-for="(node, index) in rootNodes" :key="node.key" :node="node"
            :position="index + 1" :set-size="rootNodes.length" :level="1"
            :selected-keys="selectedKeys" :focused-key="focusedKey" :opening-key="openingKey"
            :dragging-key="draggingKey" :drag-over-key="dragOverKey"
            @activate="emit('activate', $event)" @toggle="emit('toggle', $event)"
            @open="emit('open', $event)" @retry="emit('retry', $event)"
            @load-more="emit('loadMore', $event)" @menu="emit('menu', $event)"
            @keydown="emit('keydown', $event)" @dragstart="handleDragStart"
            @dragend="handleDragEnd" @dragenter="handleDragEnter" @dragover="handleDragOver"
            @dragleave="handleDragLeave" @drop="handleDrop" />
    </ul>
</template>

<script setup lang="ts">
/** 用途：文件树组合边界；使用范围：根列表、递归节点和树级拖拽状态。 */
import {onBeforeUnmount, ref, watch} from "vue";
/** 用途：树容器判断、父节点查找和稳定节点状态；使用范围：拖放目标解析。 */
import {isFileBrowserContainer} from "./FileBrowser.tree";
/** 用途：递归节点视图；使用范围：所有工作空间/Agent 根和后代节点。 */
import FileBrowserTreeNode from "./FileBrowserTreeNode.vue";
/** 用途：拖放 MIME 契约；使用范围：树节点移动入口。 */
import {FILE_BROWSER_DRAG_MIME} from "./FileBrowser.drag";
/** 用途：树节点契约；使用范围：组件参数和事件。 */
import type {FileBrowserTreeNode as TreeNode} from "./FileBrowser.types";

const props = withDefaults(defineProps<{
    rootNodes: TreeNode[];
    selectedKeys: ReadonlySet<string>;
    focusedKey: string;
    openingKey: string;
    persistKey?: string;
}>(), {
    persistKey: "sforge:file-browser:tree",
});

const emit = defineEmits<{
    activate: [payload: {event: MouseEvent; node: TreeNode}];
    toggle: [node: TreeNode];
    open: [node: TreeNode];
    retry: [node: TreeNode];
    loadMore: [node: TreeNode];
    menu: [payload: {event: MouseEvent; node: TreeNode}];
    keydown: [payload: {event: KeyboardEvent; node: TreeNode}];
    dragstart: [payload: {event: DragEvent; node: TreeNode}];
    dragend: [payload: {event: DragEvent; node: TreeNode}];
    dragenter: [payload: {event: DragEvent; node: TreeNode}];
    dragover: [payload: {event: DragEvent; node: TreeNode}];
    dragleave: [payload: {event: DragEvent; node: TreeNode}];
    drop: [payload: {event: DragEvent; node: TreeNode; target: TreeNode}];
    restoreExpanded: [keys: string[]];
}>();

const draggingKey = ref("");
const dragOverKey = ref("");
let expandTimer: ReturnType<typeof setTimeout> | undefined;
let restored = false;
const persistedKeys = readPersistedKeys();

function readPersistedKeys() {
    if (!props.persistKey || typeof window === "undefined") {
        return [];
    }
    try {
        const value = window.localStorage.getItem(props.persistKey);
        const parsed: unknown = value ? JSON.parse(value) : [];
        return Array.isArray(parsed) && parsed.every(item => typeof item === "string") ? parsed : [];
    } catch {
        return [];
    }
}

function collectExpandedKeys(nodes: TreeNode[]) {
    const keys: string[] = [];
    const pending = [...nodes];
    for (let index = 0; index < pending.length; index++) {
        const node = pending[index];
        if (!node) {
            continue;
        }
        if (node.expanded) {
            keys.push(node.key);
        }
        pending.push(...node.children);
    }
    return keys;
}

function persistExpandedKeys() {
    if (!restored || !props.persistKey || typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(props.persistKey, JSON.stringify(collectExpandedKeys(props.rootNodes)));
    } catch {
        // 隐私模式或宿主禁用 storage 时，树仍保持正常交互。
    }
}

function restoreWhenRootsExist(nodes: TreeNode[]) {
    if (restored || nodes.length === 0 || nodes.some(node => node.loadState === "loading")) {
        return;
    }
    restored = true;
    if (persistedKeys.length > 0) {
        emit("restoreExpanded", persistedKeys);
    }
}

function clearExpandTimer() {
    if (expandTimer) {
        clearTimeout(expandTimer);
        expandTimer = undefined;
    }
}

function resolveDropTarget(node: TreeNode) {
    return isFileBrowserContainer(node) ? node : undefined;
}

function handleDragStart(payload: {event: DragEvent; node: TreeNode}) {
    const {event, node} = payload;
    if (node.kind === "root" || node.root.exists === false || !event.dataTransfer) {
        return;
    }
    draggingKey.value = node.key;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(FILE_BROWSER_DRAG_MIME, JSON.stringify({
        rootID: node.rootID, path: node.path, kind: node.kind, name: node.name,
    }));
    event.dataTransfer.setData("text/plain", node.path);
    emit("dragstart", payload);
}

function handleDragEnd(payload: {event: DragEvent; node: TreeNode}) {
    clearExpandTimer();
    draggingKey.value = "";
    dragOverKey.value = "";
    emit("dragend", payload);
}

function handleDragEnter(payload: {event: DragEvent; node: TreeNode}) {
    const {node} = payload;
    const target = resolveDropTarget(node);
    if (!target || target.root.exists === false) {
        return;
    }
    dragOverKey.value = target.key;
    clearExpandTimer();
    if (isFileBrowserContainer(target) && !target.expanded) {
        expandTimer = setTimeout(() => {
            expandTimer = undefined;
            emit("toggle", target);
        }, 500);
    }
    emit("dragenter", payload);
}

function handleDragOver(payload: {event: DragEvent; node: TreeNode}) {
    const target = resolveDropTarget(payload.node);
    if (target && payload.event.dataTransfer) {
        payload.event.preventDefault();
        payload.event.dataTransfer.dropEffect = "move";
        dragOverKey.value = target.key;
    }
    emit("dragover", payload);
}

function handleDragLeave(payload: {event: DragEvent; node: TreeNode}) {
    const target = resolveDropTarget(payload.node);
    if (!target || dragOverKey.value === target.key) {
        dragOverKey.value = "";
    }
    clearExpandTimer();
    emit("dragleave", payload);
}

function handleDrop(payload: {event: DragEvent; node: TreeNode}) {
    const target = resolveDropTarget(payload.node);
    if (!target) {
        return;
    }
    payload.event.preventDefault();
    clearExpandTimer();
    dragOverKey.value = "";
    emit("drop", {...payload, target});
}

watch(() => props.rootNodes, nodes => {
    restoreWhenRootsExist(nodes);
    persistExpandedKeys();
}, {deep: true, immediate: true});

onBeforeUnmount(() => {
    clearExpandTimer();
    persistExpandedKeys();
});
</script>
