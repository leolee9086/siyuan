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
            <button v-if="selectedActionableNodes.length > 1" type="button"
                class="block__icon block__icon--show ariaLabel" aria-label="删除已选择项目"
                :disabled="batchDeleting" @click="deleteSelectedNodes">
                <svg :class="{'fn__rotate': batchDeleting}"><use href="#iconTrashcan" /></svg>
            </button>
            <button v-if="selectedTransferableNodes.length > 1" type="button"
                class="block__icon block__icon--show ariaLabel" aria-label="复制已选择项目到目录"
                :disabled="batchCopying" @click="copySelectedNodes">
                <svg :class="{'fn__rotate': batchCopying}"><use href="#iconCopy" /></svg>
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
                @keydown="handleNodeKeydown" @restore-expanded="restoreExpanded" @drop="handleNodeDrop" />
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
        <p v-if="operationError" class="sforge-file-browser__error">{{ operationError }}</p>
    </section>
</template>

<script setup lang="ts">
/** 用途：Vue 生命周期、派生状态和 DOM 焦点恢复；使用范围：Dock 挂载和树键盘交互。 */
import {computed, nextTick, onBeforeUnmount, onMounted, ref} from "vue";
/** 用途：文件浏览器独立树控制器；使用范围：本面板唯一状态入口。 */
import {useFileBrowser} from "./useFileBrowser";
/** 用途：文件树组合组件；使用范围：常驻多根递归树和树级交互。 */
import FileBrowserTree from "./FileBrowserTree.vue";
/** 用途：排序字段守卫；使用范围：DOM 选择值边界。 */
import {isFileBrowserSortField} from "./FileBrowser.guards";
/** 用途：默认仓储与应用绑定打开端口；使用范围：真实 Dock 控制器组合。 */
import {fileBrowserRepository} from "./FileBrowser.repository";
import {createFileBrowserDirectoryOpener, createFileBrowserEntryOpener} from "./FileBrowser.open";
import {fileBrowserOperationsRepository} from "./FileBrowser.operations.repository";
import {
    requestFileBrowserBatchDestination,
    requestFileBrowserCopyDestination,
    requestFileBrowserConfirmation,
    requestFileBrowserText,
} from "./FileBrowser.operations.dialog";
import {fileBrowserSelection} from "./FileBrowser.selection";
/** 用途：应用全局菜单；使用范围：树节点上下文菜单。 */
import {showFileBrowserTreeNodeMenu} from "./FileBrowser.menu";
import {
    canCreateFileBrowserAgentDirectory,
    createFileBrowserAgentDirectoryTask,
    createFileBrowserAgentFileTask,
} from "./FileBrowserAgentActions";
/** 用途：拖放数据解析；使用范围：树移动入口。 */
import {FILE_BROWSER_DRAG_MIME, parseFileBrowserDragData} from "./FileBrowser.drag";
/** 用途：树节点查找和容器判断；使用范围：操作完成后的精确刷新。 */
import {findFileBrowserTreeNode, getFileBrowserCapabilitiesForPath, isFileBrowserContainer, makeFileBrowserNodeKey} from "./FileBrowser.tree";
/** 用途：标准消息提示和 HTML 转义；使用范围：操作成功/失败反馈。 */
import {showMessage} from "../../dialog/message";
import {escapeHtml} from "../../util/DOM/escape";
/** 用途：应用宿主与树节点类型；使用范围：组件参数和事件。 */
import type {AppFacade} from "./dock/imports";
import type {
    FileBrowserBatchOperationResult,
    FileBrowserTreeNode as TreeNode,
} from "./FileBrowser.types";

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
const operationError = ref("");
const movingKey = ref("");
const batchDeleting = ref(false);
const batchCopying = ref(false);

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
    showFileBrowserTreeNodeMenu(payload.event, payload.node, {
        open: openNode,
        canCreateAgentTask: node => node.kind === "file" ||
            canCreateFileBrowserAgentDirectory(node.root, node.path),
        createAgentTask: createAgentTaskFromNode,
        refresh: refreshNode,
        createFile: createFile,
        createDirectory: createDirectory,
        rename: renameNode,
        copy: copyNode,
        delete: deleteNode,
    });
}

async function createAgentTaskFromNode(node: TreeNode) {
    try {
        if (node.kind === "file") {
            const stat = await fileBrowserRepository.statFile({rootID: node.rootID, path: node.path});
            await createFileBrowserAgentFileTask({
                name: node.name,
                contentURL: stat.contentURL,
                mediaType: stat.mediaType,
            });
            showMessage(`已在 Agent 面板创建附件任务：${node.name}`, 3000);
            return;
        }
        await createFileBrowserAgentDirectoryTask({
            root: node.root,
            rootID: node.rootID,
            path: node.path,
            title: node.name,
        });
        showMessage(`已在 Agent 面板创建目录任务：${node.name}`, 3000);
    } catch (reason) {
        operationError.value = reason instanceof Error ? reason.message : String(reason);
    }
}

function joinRootRelativePath(parent: string, name: string) {
    const normalizedParent = parent.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    const normalizedName = name.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    return normalizedParent ? `${normalizedParent}/${normalizedName}` : normalizedName;
}

function parentRootRelativePath(path: string) {
    const normalized = path.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    const index = normalized.lastIndexOf("/");
    return index >= 0 ? normalized.slice(0, index) : "";
}

function findRefreshTarget(rootID: string, path: string) {
    const direct = findFileBrowserTreeNode(rootNodes.value, makeFileBrowserNodeKey(rootID, path));
    if (direct) {
        return direct;
    }
    for (const rootNode of rootNodes.value) {
        const mount = rootNode.root.mounts?.find(candidate => candidate.id === rootID);
        if (!mount) {
            continue;
        }
        const displayPath = joinRootRelativePath(mount.relativePath, path);
        return findFileBrowserTreeNode(rootNodes.value, makeFileBrowserNodeKey(rootNode.rootID, displayPath));
    }
    return undefined;
}

async function refreshOperationParent(rootID: string, path: string) {
    const parentPath = parentRootRelativePath(path);
    const target = findRefreshTarget(rootID, parentPath) ?? findRefreshTarget(rootID, "");
    if (target && isFileBrowserContainer(target)) {
        await refreshNode(target);
    }
}

function operationErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function reportOperationError(error: unknown) {
    operationError.value = operationErrorMessage(error);
    showMessage(escapeHtml(operationError.value), 6000, "error", "sforgeFileBrowserOperationError");
}

function canWriteNode(node: TreeNode) {
    return node.root.exists && !node.entry?.restricted && getFileBrowserCapabilitiesForPath(node.root, node.path).write;
}

function canBrowseNode(node: TreeNode) {
    return node.root.exists && !node.entry?.restricted && getFileBrowserCapabilitiesForPath(node.root, node.path).browse;
}

const selectedActionableNodes = computed(() => fileBrowserSelection.items.value
    .map(item => findFileBrowserTreeNode(rootNodes.value, item.key))
    .filter((node): node is TreeNode => node !== undefined)
    .filter(node => node.kind !== "root" && canWriteNode(node)));

const selectedTransferableNodes = computed(() => fileBrowserSelection.items.value
    .map(item => findFileBrowserTreeNode(rootNodes.value, item.key))
    .filter((node): node is TreeNode => node !== undefined)
    .filter(node => node.kind !== "root" && canBrowseNode(node)));

async function createDirectory(node: TreeNode) {
    if (!canWriteNode(node)) {
        return;
    }
    const name = await requestFileBrowserText({title: "新建目录", label: "目录名称", placeholder: "例如：素材"});
    if (!name) {
        return;
    }
    const path = joinRootRelativePath(node.path, name);
    try {
        await fileBrowserOperationsRepository.createDirectory({rootID: node.rootID, path});
        await refreshNode(node);
        showMessage(`已创建目录：${escapeHtml(path)}`, 3000);
    } catch (error) {
        reportOperationError(error);
    }
}

async function createFile(node: TreeNode) {
    if (!canWriteNode(node)) {
        return;
    }
    const name = await requestFileBrowserText({title: "新建文件", label: "文件名称", placeholder: "例如：说明.md"});
    if (!name) {
        return;
    }
    const path = joinRootRelativePath(node.path, name);
    try {
        await fileBrowserOperationsRepository.createFile({rootID: node.rootID, path});
        await refreshNode(node);
        showMessage(`已创建文件：${escapeHtml(path)}`, 3000);
    } catch (error) {
        reportOperationError(error);
    }
}

async function renameNode(node: TreeNode) {
    if (node.kind === "root" || !canWriteNode(node)) {
        return;
    }
    const newName = await requestFileBrowserText({title: "重命名", label: "名称", value: node.name});
    if (!newName || newName === node.name) {
        return;
    }
    try {
        await fileBrowserOperationsRepository.rename({rootID: node.rootID, path: node.path, newName});
        await refreshOperationParent(node.rootID, node.path);
        showMessage(`已重命名为：${escapeHtml(newName)}`, 3000);
    } catch (error) {
        reportOperationError(error);
    }
}

function operationRoots() {
    const result: TreeNode["root"][] = [];
    for (const root of roots.value) {
        result.push(root);
        for (const mount of root.mounts ?? []) {
            result.push({
                id: mount.id, kind: mount.kind, label: mount.label, path: mount.path,
                permission: mount.permission, capabilities: mount.capabilities,
                ...(mount.sources ? {sources: mount.sources} : {}), exists: mount.exists,
            });
        }
    }
    return result;
}

function suggestCopyPath(node: TreeNode) {
    const parent = parentRootRelativePath(node.path);
    const dot = node.kind === "file" ? node.name.lastIndexOf(".") : -1;
    const base = dot > 0 ? node.name.slice(0, dot) : node.name;
    const extension = dot > 0 ? node.name.slice(dot) : "";
    return joinRootRelativePath(parent, `${base} - copy${extension}`);
}

async function copyNode(node: TreeNode) {
    if (node.kind === "root" || !node.root.exists || node.entry?.restricted) {
        return;
    }
    const destination = await requestFileBrowserCopyDestination(operationRoots(), node.rootID, suggestCopyPath(node));
    if (!destination) {
        return;
    }
    try {
        const result = await fileBrowserOperationsRepository.copy({
            sourceRootID: node.rootID,
            sourcePath: node.path,
            destinationRootID: destination.rootID,
            destinationPath: destination.path,
        });
        await refreshOperationParent(destination.rootID, destination.path);
        showMessage(`已复制：${escapeHtml(destination.path)}（${result.copiedFileCount ?? 0} 个文件）`, 3000);
    } catch (error) {
        reportOperationError(error);
    }
}

async function copySelectedNodes() {
    const nodes = selectedTransferableNodes.value;
    if (nodes.length < 2 || batchCopying.value) {
        return;
    }
    const first = nodes[0]!;
    const destination = await requestFileBrowserBatchDestination(
        operationRoots(), first.rootID, parentRootRelativePath(first.path),
    );
    if (!destination) {
        return;
    }
    operationError.value = "";
    batchCopying.value = true;
    try {
        const result = await fileBrowserOperationsRepository.copyBatch({
            items: nodes.map(node => ({rootID: node.rootID, path: node.path})),
            destinationRootID: destination.rootID,
            destinationPath: destination.path,
        });
        const target = findRefreshTarget(destination.rootID, destination.path);
        if (target && isFileBrowserContainer(target)) {
            await refreshNode(target);
        }
        reportBatchTransferResult(result, "复制", "sforgeFileBrowserBatchCopyError");
    } catch (error) {
        reportOperationError(error);
    } finally {
        batchCopying.value = false;
    }
}

function reportBatchTransferResult(
    result: FileBrowserBatchOperationResult,
    operation: string,
    messageKey: string,
) {
    if (result.failureCount > 0) {
        const failures = result.items.filter(item => item.error).map(item =>
            `${item.request.path}: ${item.error?.message ?? `批量${operation}失败`}`,
        );
        operationError.value = failures.join("；");
        showMessage(escapeHtml(operationError.value), 6000, "error", messageKey);
        return;
    }
    showMessage(`已${operation} ${result.successCount} 项`, 3000);
}

async function deleteNode(node: TreeNode) {
    if (node.kind === "root" || !canWriteNode(node)) {
        return;
    }
    const kind = node.kind === "directory" ? "目录及其全部内容" : "文件";
    const confirmed = await requestFileBrowserConfirmation(
        "删除文件",
        `确定删除${kind} <b>${escapeHtml(node.name)}</b> 吗？此操作不可撤销。`,
    );
    if (!confirmed) {
        return;
    }
    operationError.value = "";
    try {
        const result = await fileBrowserOperationsRepository.delete({rootID: node.rootID, path: node.path});
        fileBrowserSelection.removeSubtree(node.rootID, node.path);
        await refreshOperationParent(node.rootID, node.path);
        showMessage(`已删除：${escapeHtml(node.path)}（${(result.removedFileCount ?? 0)} 个文件）`, 3000);
    } catch (error) {
        reportOperationError(error);
    }
}

async function deleteSelectedNodes() {
    const nodes = selectedActionableNodes.value;
    if (nodes.length < 2 || batchDeleting.value) {
        return;
    }
    const confirmed = await requestFileBrowserConfirmation(
        "批量删除文件",
        `确定删除已选择的 ${nodes.length} 项吗？目录及其全部内容也会被删除，此操作不可撤销。`,
    );
    if (!confirmed) {
        return;
    }
    operationError.value = "";
    batchDeleting.value = true;
    try {
        const result = await fileBrowserOperationsRepository.deleteBatch({
            items: nodes.map(node => ({rootID: node.rootID, path: node.path})),
        });
        const refreshTargets = new Map<string, TreeNode>();
        for (const item of result.items) {
            if (!item.result) {
                continue;
            }
            fileBrowserSelection.removeSubtree(item.request.rootID, item.request.path);
            addRefreshTarget(refreshTargets, item.request.rootID, parentRootRelativePath(item.request.path));
        }
        for (const target of refreshTargets.values()) {
            await refreshNode(target);
        }
        if (result.failureCount > 0) {
            const failures = result.items.filter(item => item.error).map(item =>
                `${item.request.path}: ${item.error?.message ?? "批量删除失败"}`,
            );
            operationError.value = failures.join("；");
            showMessage(escapeHtml(operationError.value), 6000, "error", "sforgeFileBrowserBatchDeleteError");
        } else {
            showMessage(`已删除 ${result.successCount} 项`, 3000);
        }
    } catch (error) {
        reportOperationError(error);
    } finally {
        batchDeleting.value = false;
    }
}

function addRefreshTarget(targets: Map<string, TreeNode>, rootID: string, path: string) {
    const node = findRefreshTarget(rootID, path);
    if (node && isFileBrowserContainer(node)) {
        targets.set(node.key, node);
    }
}

async function handleNodeDrop(payload: {event: DragEvent; node: TreeNode; target: TreeNode}) {
    if (movingKey.value) {
        return;
    }
    const source = parseFileBrowserDragData(payload.event.dataTransfer?.getData(FILE_BROWSER_DRAG_MIME));
    const target = payload.target;
    const sources = source?.items ?? (source ? [source] : []);
    if (!source || sources.length === 0 || !isFileBrowserContainer(target) || !target.root.exists || target.entry?.restricted ||
        !getFileBrowserCapabilitiesForPath(target.root, target.path).write) {
        reportOperationError(new Error("拖放来源或目标目录不具备移动条件"));
        return;
    }
    for (const item of sources) {
        if (item.rootID === target.rootID && item.kind === "directory" &&
            (target.path === item.path || target.path.startsWith(`${item.path}/`))) {
            reportOperationError(new Error("源目录与目标目录存在重叠"));
            return;
        }
    }
    operationError.value = "";
    movingKey.value = sources.map(item => `${item.rootID}:${item.path}`).join("\n");
    try {
        if (sources.length === 1) {
            const [item] = sources;
            const destinationPath = joinRootRelativePath(target.path, item!.name);
            await fileBrowserOperationsRepository.move({
                sourceRootID: item!.rootID,
                sourcePath: item!.path,
                destinationRootID: target.rootID,
                destinationPath,
            });
            const refreshTargets = new Map<string, TreeNode>();
            addRefreshTarget(refreshTargets, item!.rootID, parentRootRelativePath(item!.path));
            refreshTargets.set(target.key, target);
            for (const refreshTarget of refreshTargets.values()) {
                await refreshNode(refreshTarget);
            }
            const movedNode = findRefreshTarget(target.rootID, destinationPath);
            if (movedNode) {
                browser.selectNode(movedNode);
            }
            showMessage(`已移动：${escapeHtml(destinationPath)}`, 3000);
            return;
        }
        const result = await fileBrowserOperationsRepository.moveBatch({
            items: sources.map(item => ({rootID: item.rootID, path: item.path})),
            destinationRootID: target.rootID,
            destinationPath: target.path,
        });
        const refreshTargets = new Map<string, TreeNode>();
        for (const item of result.items) {
            if (item.result) {
                fileBrowserSelection.removeSubtree(item.request.rootID, item.request.path);
                addRefreshTarget(refreshTargets, item.request.rootID, parentRootRelativePath(item.request.path));
            }
        }
        refreshTargets.set(target.key, target);
        for (const refreshTarget of refreshTargets.values()) {
            await refreshNode(refreshTarget);
        }
        reportBatchTransferResult(result, "移动", "sforgeFileBrowserBatchMoveError");
    } catch (error) {
        reportOperationError(error);
    } finally {
        movingKey.value = "";
    }
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
