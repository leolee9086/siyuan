<template>
    <li class="sforge-file-tree__node-shell" role="none">
        <div :id="node.domID" role="treeitem" class="b3-list-item sforge-file-tree__row"
            :class="rowClasses" :style="rowStyle" :tabindex="focused ? 0 : -1"
            :draggable="draggable"
            :aria-selected="selected" :aria-level="level" :aria-posinset="position"
            :aria-setsize="setSize" :aria-expanded="container ? node.expanded : undefined"
            :aria-busy="node.loadState === 'loading' || node.loadingMore" :title="nodeTitle"
            @click.stop="emit('activate', {event: $event, node})" @dblclick.stop="emit('open', node)"
            @contextmenu.prevent.stop="emit('menu', {event: $event, node})"
            @keydown="emit('keydown', {event: $event, node})"
            @dragstart.stop="emit('dragstart', {event: $event, node})"
            @dragend.stop="emit('dragend', {event: $event, node})"
            @dragenter.stop="emit('dragenter', {event: $event, node})"
            @dragover.stop="emit('dragover', {event: $event, node})"
            @dragleave.stop="emit('dragleave', {event: $event, node})"
            @drop.stop="emit('drop', {event: $event, node})">
            <button type="button" class="b3-list-item__toggle b3-list-item__toggle--hl sforge-file-tree__toggle"
                :class="{'fn__hidden': !container}" :aria-label="node.expanded ? '折叠' : '展开'"
                :disabled="localNode?.root.exists === false" @click.stop="emit('toggle', node)">
                <svg class="b3-list-item__arrow" :class="{'b3-list-item__arrow--open': node.expanded}">
                    <use href="#iconRight" />
                </svg>
            </button>
            <svg class="b3-list-item__graphic sforge-file-tree__icon"
                :class="{'fn__rotate': node.loadState === 'loading' && node.children.length === 0}">
                <use :href="nodeIcon" />
            </svg>
            <span class="b3-list-item__text sforge-file-tree__copy">
                <span class="sforge-file-tree__name">{{ node.name }}</span>
                <span v-if="localNode?.kind === 'root'" class="sforge-file-tree__path">{{ localNode.root.path }}</span>
                <span v-if="localNode?.kind === 'root' && (localNode.root.mounts?.length || localNode.root.sources?.length)"
                    class="sforge-file-tree__mounts">
                    {{ formatFileBrowserSources(localNode.root) }}
                </span>
            </span>
            <span v-if="localNode?.kind === 'root'" class="sforge-file-tree__permission">
                {{ formatFileBrowserPermission(localNode.root.permission) }}
            </span>
            <span v-if="showCounts" class="sforge-file-tree__counts" :aria-label="countLabel">
                <span><svg><use href="#iconFolder" /></svg>{{ node.directoryCount }}</span>
                <span><svg><use href="#iconFile" /></svg>{{ node.fileCount }}</span>
            </span>
            <span v-if="localNode?.entry?.isSymlink" class="b3-list-item__action sforge-file-tree__symlink"
                aria-label="符号链接"><svg><use href="#iconLink" /></svg></span>
            <button type="button" class="b3-list-item__action sforge-file-tree__menu" aria-label="更多"
                @click.stop="emit('menu', {event: $event, node})">
                <svg><use href="#iconMore" /></svg>
            </button>
        </div>

        <ul v-if="container && node.expanded" role="group" class="sforge-file-tree__children"
            :style="childGuideStyle">
            <FileBrowserTreeNode v-for="(child, index) in node.children" :key="child.key" :node="child"
                :position="index + 1" :set-size="node.children.length" :level="level + 1"
                :selected-keys="selectedKeys" :focused-key="focusedKey" :opening-key="openingKey"
                :dragging-key="draggingKey" :drag-over-key="dragOverKey"
                @activate="emit('activate', $event)" @toggle="emit('toggle', $event)"
                @open="emit('open', $event)" @menu="emit('menu', $event)"
                @keydown="emit('keydown', $event)" @retry="emit('retry', $event)"
                @load-more="emit('loadMore', $event)" @dragstart="emit('dragstart', $event)"
                @dragend="emit('dragend', $event)" @dragenter="emit('dragenter', $event)"
                @dragover="emit('dragover', $event)" @dragleave="emit('dragleave', $event)"
                @drop="emit('drop', $event)" />
            <li v-if="node.loadState === 'loading' && node.children.length === 0"
                class="sforge-file-tree__inline-state" role="none">
                <svg class="fn__rotate"><use href="#iconRefresh" /></svg><span>正在读取</span>
            </li>
            <li v-else-if="node.loadState === 'error'" class="sforge-file-tree__inline-state sforge-file-tree__inline-state--error"
                role="none">
                <span :title="node.error">{{ node.error }}</span>
                <button type="button" class="b3-button b3-button--text" @click.stop="emit('retry', node)">重试</button>
            </li>
            <li v-else-if="node.loadState === 'loaded' && node.children.length === 0"
                class="sforge-file-tree__inline-state" role="none">空目录</li>
            <li v-if="node.hasMore" class="sforge-file-tree__inline-state" role="none">
                <button type="button" class="b3-button b3-button--text" :disabled="node.loadingMore"
                    @click.stop="emit('loadMore', node)">
                    <svg v-if="node.loadingMore" class="fn__rotate"><use href="#iconRefresh" /></svg>
                    <span>{{ node.loadingMore ? "正在读取" : `加载更多 (${node.children.length}/${node.total})` }}</span>
                </button>
            </li>
        </ul>
    </li>
</template>

<script setup lang="ts">
/** 用途：Vue 派生状态；使用范围：单个递归节点表现。 */
import {computed} from "vue";
/** 用途：权限显示；使用范围：常驻根节点。 */
import {formatFileBrowserPermission, formatFileBrowserSources, formatFileBrowserUpdated} from "./FileBrowser.presentation";
/** 用途：节点容器守卫；使用范围：折叠和 ARIA 状态。 */
import {isFileBrowserContainer, isLocalFileBrowserTreeNode} from "./FileBrowser.tree";
/** 用途：递归树节点类型；使用范围：组件参数和事件。 */
import type {FileBrowserTreeNode} from "./FileBrowser.types";

defineOptions({name: "FileBrowserTreeNode"});

const props = defineProps<{
    node: FileBrowserTreeNode;
    position: number;
    setSize: number;
    level: number;
    selectedKeys: ReadonlySet<string>;
    focusedKey: string;
    openingKey: string;
    draggingKey: string;
    dragOverKey: string;
}>();

const emit = defineEmits<{
    activate: [payload: {event: MouseEvent; node: FileBrowserTreeNode}];
    toggle: [node: FileBrowserTreeNode];
    open: [node: FileBrowserTreeNode];
    retry: [node: FileBrowserTreeNode];
    loadMore: [node: FileBrowserTreeNode];
    menu: [payload: {event: MouseEvent; node: FileBrowserTreeNode}];
    keydown: [payload: {event: KeyboardEvent; node: FileBrowserTreeNode}];
    dragstart: [payload: {event: DragEvent; node: FileBrowserTreeNode}];
    dragend: [payload: {event: DragEvent; node: FileBrowserTreeNode}];
    dragenter: [payload: {event: DragEvent; node: FileBrowserTreeNode}];
    dragover: [payload: {event: DragEvent; node: FileBrowserTreeNode}];
    dragleave: [payload: {event: DragEvent; node: FileBrowserTreeNode}];
    drop: [payload: {event: DragEvent; node: FileBrowserTreeNode}];
}>();

const container = computed(() => isFileBrowserContainer(props.node));
const localNode = computed(() => isLocalFileBrowserTreeNode(props.node) ? props.node : undefined);
const selected = computed(() => props.selectedKeys.has(props.node.key));
const focused = computed(() => props.focusedKey === props.node.key);
const draggable = computed(() => Boolean(localNode.value && localNode.value.kind !== "root" &&
    localNode.value.root.exists && !localNode.value.entry?.restricted));
const showCounts = computed(() => container.value && (
    props.node.loadState === "loaded" || localNode.value?.entry?.childCountKnown === true));
const countLabel = computed(() => `${props.node.directoryCount} 个目录，${props.node.fileCount} 个文件`);
const rowStyle = computed(() => ({"--sforge-file-tree-depth": String(props.node.depth)}));
const childGuideStyle = computed(() => ({"--sforge-file-tree-guide-depth": String(props.node.depth + 1)}));
const rowClasses = computed(() => ({
    "b3-list-item--focus": selected.value,
    "sforge-file-tree__row--root": props.node.kind === "root",
    "sforge-file-tree__row--hidden": localNode.value?.entry?.hidden,
    "sforge-file-tree__row--restricted": localNode.value?.entry?.restricted || localNode.value?.root.exists === false,
    "sforge-file-tree__row--opening": props.openingKey === props.node.key,
    "sforge-file-tree__row--dragging": props.draggingKey === props.node.key,
    "sforge-file-tree__row--dragover": props.dragOverKey === props.node.key,
}));
const nodeIcon = computed(() => {
    if (props.node.loadState === "loading" && props.node.children.length === 0) {
        return "#iconRefresh";
    }
    if (localNode.value?.entry?.restricted || localNode.value?.root.exists === false) {
        return "#iconLock";
    }
    if (props.node.kind === "root") {
        return "#iconFilesRoot";
    }
    return props.node.kind === "directory" ? "#iconFolder" : "#iconFile";
});
const nodeTitle = computed(() => {
    if (localNode.value?.kind === "root") {
        const root = localNode.value.root;
        const mounts = root.mounts?.map(mount => `${mount.label}: ${mount.path}`).join("\n") ?? "";
        return mounts ? `${root.path}\n\n已归并绑定:\n${mounts}` : root.path;
    }
    if (localNode.value) {
        const updated = formatFileBrowserUpdated(localNode.value.entry?.updated ?? 0);
        return updated ? `${localNode.value.path}\n${updated}` : localNode.value.path;
    }
    if (props.node.domain === "provider") {
        if (props.node.kind === "provider-resource") {
            return `${props.node.descriptor.displayName}\n${props.node.resource.name}`;
        }
        if (props.node.kind === "directory" || props.node.kind === "file") {
            return `${props.node.descriptor.displayName}\n${props.node.providerEntry.name}`;
        }
    }
    return props.node.name;
});
</script>

<style scoped lang="scss" src="./FileBrowserTreeNode.scss"></style>
