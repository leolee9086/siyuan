<template>
    <section class="sforge-file-browser" aria-label="文件浏览器">
        <header class="block__icons sforge-file-browser__header">
            <div class="block__logo">
                <svg class="block__logoicon"><use href="#iconFilesRoot" /></svg>
                <span>文件浏览器</span>
            </div>
            <span class="fn__flex-1" />
            <button type="button" class="block__icon ariaLabel" aria-label="刷新文件根和已加载目录"
                :disabled="loadingRoots" @click="loadRoots">
                <svg :class="{'fn__rotate': loadingRoots}"><use href="#iconRefresh" /></svg>
            </button>
            <button type="button" class="block__icon ariaLabel" aria-label="打开当前目录资源"
                :disabled="!selectedNode || selectedNode.kind === 'file'" @click="openSelectedDirectory">
                <svg><use href="#iconAssets" /></svg>
            </button>
            <button type="button" class="block__icon ariaLabel" aria-label="全部折叠"
                :disabled="rootNodes.length === 0" @click="collapseAll">
                <svg><use href="#iconContract" /></svg>
            </button>
        </header>

        <div class="sforge-file-browser__toolbar">
            <select class="b3-select" :value="sortBy" aria-label="排序字段" @change="handleSortChange">
                <option value="name">名称</option>
                <option value="updated">修改时间</option>
                <option value="size">大小</option>
                <option value="extension">类型</option>
            </select>
            <button type="button" class="block__icon block__icon--show ariaLabel"
                :aria-label="sortDirection === 'asc' ? '升序，点击切换降序' : '降序，点击切换升序'"
                @click="toggleSortDirection">
                <svg><use :href="sortDirection === 'asc' ? '#iconUp' : '#iconDown'" /></svg>
            </button>
            <span class="sforge-file-browser__root-count">{{ rootSummary }}</span>
        </div>

        <main class="sforge-file-browser__content">
            <div v-if="loadingRoots && rootNodes.length === 0" class="sforge-file-browser__state">
                <svg class="fn__rotate"><use href="#iconRefresh" /></svg>
                <span>正在读取</span>
            </div>
            <div v-else-if="rootsError && rootNodes.length === 0"
                class="sforge-file-browser__state sforge-file-browser__state--error">
                <span>{{ rootsError }}</span>
                <button type="button" class="b3-button b3-button--text" @click="loadRoots">重试</button>
            </div>
            <div v-else-if="rootNodes.length === 0" class="sforge-file-browser__state">
                <svg><use href="#iconFilesRoot" /></svg>
                <span>没有可用文件根</span>
            </div>
            <FileBrowserTree v-else :root-nodes="rootNodes" :selected-keys="selectedKeySet"
                :focused-key="focusedKey" :opening-key="openingKey"
                @activate="handleNodeActivate" @toggle="toggleNode" @open="openNode"
                @retry="refreshNode" @load-more="loadMoreNode" @menu="handleNodeMenu"
                @keydown="handleNodeKeydown" @restore-expanded="restoreExpanded" />
        </main>
        <footer v-if="selectedNode" class="sforge-file-browser__footer">
            <span class="sforge-file-browser__selection" :title="selectedNodeAbsolutePath">
                {{ selectedNodeAbsolutePath }}
            </span>
            <span v-if="selectedNode.kind !== 'file'" class="sforge-file-browser__selection-count">
                {{ selectedNode.directoryCount }} 目录 / {{ selectedNode.fileCount }} 文件
            </span>
            <span v-if="selectedKeys.length > 1" class="sforge-file-browser__selection-count">
                已选择 {{ selectedKeys.length }} 项
            </span>
        </footer>
        <p v-if="rootsError && rootNodes.length > 0" class="sforge-file-browser__error">{{ rootsError }}</p>
        <p v-if="openError" class="sforge-file-browser__error">{{ openError }}</p>
    </section>
</template>

<script setup lang="ts">
/** 用途：Vue 生命周期、派生状态和 DOM 焦点恢复；使用范围：Dock 挂载和树键盘交互。 */
import {computed, nextTick, onBeforeUnmount, onMounted} from "vue";
/** 用途：文件浏览器独立树控制器；使用范围：本面板唯一状态入口。 */
import {useFileBrowser} from "./useFileBrowser";
/** 用途：文件树组合组件；使用范围：常驻多根递归树和树级交互。 */
import FileBrowserTree from "./FileBrowserTree.vue";
/** 用途：排序字段守卫；使用范围：DOM 选择值边界。 */
import {isFileBrowserSortField} from "./FileBrowser.guards";
/** 用途：默认仓储与应用绑定打开端口；使用范围：真实 Dock 控制器组合。 */
import {fileBrowserRepository} from "./FileBrowser.repository";
import {createFileBrowserDirectoryOpener, createFileBrowserEntryOpener} from "./FileBrowser.open";
/** 用途：应用全局菜单；使用范围：树节点上下文菜单。 */
import {showFileBrowserTreeNodeMenu} from "./FileBrowser.menu";
/** 用途：应用宿主与树节点类型；使用范围：组件参数和事件。 */
import type {AppFacade} from "./dock/imports";
import type {FileBrowserTreeNode as TreeNode} from "./FileBrowser.types";

const props = defineProps<{
    app: AppFacade;
}>();
const openEntry = createFileBrowserEntryOpener(props.app, fileBrowserRepository);
const openDirectory = createFileBrowserDirectoryOpener(props.app);
const browser = useFileBrowser(fileBrowserRepository, openEntry, undefined, openDirectory);
const {
    roots, rootNodes, selectedKeys, focusedKey, selectedNode, loadingRoots, rootsError,
    openingKey, openError, sortBy, sortDirection, loadRoots, activateNode, toggleNode,
    openNode, refreshNode, loadMoreNode, collapseAll, setSort, toggleSortDirection, restoreExpanded,
    handleKey, dispose,
} = browser;

const selectedKeySet = computed<ReadonlySet<string>>(() => new Set(selectedKeys.value));

const rootSummary = computed(() => {
    const displayCount = roots.value.length;
    const boundCount = roots.value.reduce((total, root) => {
        const directBindings = root.kind === "workspace" ? 0 : (root.sources?.length ?? 0);
        return total + 1 + directBindings + (root.mounts?.length ?? 0);
    }, 0);
    return boundCount === displayCount
        ? `${displayCount} 个文件根`
        : `${displayCount} 个展示根 · ${boundCount} 个绑定位置`;
});

const selectedNodeAbsolutePath = computed(() => {
    const node = selectedNode.value;
    if (!node?.root) {
        return "";
    }
    if (!node.path) {
        return node.root.path;
    }
    const separator = node.root.path.includes("\\") ? "\\" : "/";
    return `${node.root.path}${separator}${node.path.replaceAll("/", separator)}`;
});

function handleSortChange(event: Event) {
    const target = event.target;
    if (target instanceof HTMLSelectElement && isFileBrowserSortField(target.value)) {
        void setSort(target.value);
    }
}

function handleNodeMenu(payload: {event: MouseEvent; node: TreeNode}) {
    browser.selectNode(payload.node);
    showFileBrowserTreeNodeMenu(payload.event, payload.node, {open: openNode, refresh: refreshNode});
}

function handleNodeActivate(payload: {event: MouseEvent; node: TreeNode}) {
    void activateNode(payload.node, {
        toggle: payload.event.ctrlKey || payload.event.metaKey,
        range: payload.event.shiftKey,
    });
}

function openSelectedDirectory() {
    const node = selectedNode.value;
    if (node && node.kind !== "file") {
        void openNode(node);
    }
}

async function handleNodeKeydown(payload: {event: KeyboardEvent; node: TreeNode}) {
    const supported = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "];
    if (!supported.includes(payload.event.key)) {
        return;
    }
    payload.event.preventDefault();
    payload.event.stopPropagation();
    const target = await handleKey(payload.node, payload.event.key);
    if (target) {
        await nextTick();
        document.getElementById(target.domID)?.focus();
    }
}

onMounted(() => void loadRoots());
onBeforeUnmount(() => {
    dispose();
});
</script>

<style scoped lang="scss" src="./FileBrowserPanel.scss"></style>
