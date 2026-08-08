<template>
    <section class="sforge-file-gallery" aria-label="文件资源画廊" :data-layout-mode="layoutMode"
        :aria-busy="loading || loadingMore || rootsLoading">
        <header class="sforge-file-gallery__header">
            <div class="sforge-file-gallery__topline">
                <div class="sforge-file-gallery__history" aria-label="目录导航">
                    <button type="button" class="block__icon ariaLabel" aria-label="返回上一级目录"
                        :disabled="!canGoBack" @click="navigateHistory(-1)">
                        <svg><use href="#iconLeft" /></svg>
                    </button>
                    <button type="button" class="block__icon ariaLabel" aria-label="前进到下一级目录"
                        :disabled="!canGoForward" @click="navigateHistory(1)">
                        <svg><use href="#iconRight" /></svg>
                    </button>
                </div>
                <div class="block__logo sforge-file-gallery__title">
                    <svg class="block__logoicon"><use href="#iconAssets" /></svg>
                    <span>{{ file.name }}</span>
                </div>
                <span class="fn__flex-1" />
                <label class="sforge-file-gallery__zoom">
                    <span>卡片</span>
                    <input v-model.number="columnWidth" class="b3-slider" type="range" min="140" max="360" step="10"
                        aria-label="卡片宽度" />
                    <output>{{ columnWidth }}px</output>
                </label>
                <div class="sforge-file-gallery__view-modes" role="group" aria-label="布局模式">
                    <button v-for="mode in galleryViewModes" :key="mode.value" type="button"
                        class="block__icon ariaLabel"
                        :class="{'block__icon--active': layoutMode === mode.value}"
                        :aria-label="mode.label" :aria-pressed="layoutMode === mode.value"
                        @click="layoutMode = mode.value">
                        <svg><use :href="mode.icon" /></svg>
                    </button>
                </div>
                <button type="button" class="block__icon ariaLabel" aria-label="重新查询"
                    :disabled="loading" @click="() => runScopedSearch()">
                    <svg :class="{'fn__rotate': loading}"><use href="#iconRefresh" /></svg>
                </button>
            </div>
            <div class="sforge-file-gallery__viewline">
                <span class="sforge-file-gallery__result-count" aria-live="polite">
                    已加载 {{ loadedCount }} / {{ totalCount }} 个文件
                </span>
                <span class="fn__flex-1" />
                <label class="sforge-file-gallery__paths">
                    <input v-model="showPaths" type="checkbox" aria-label="显示路径" />
                    <span>显示路径</span>
                </label>
                <label class="sforge-file-gallery__attribute-control">
                    <span>显示属性</span>
                    <select v-model="selectedAttributes" class="b3-select" multiple aria-label="显示属性">
                        <option v-for="attribute in galleryAttributes" :key="attribute.key" :value="attribute.key">
                            {{ attribute.label }}
                        </option>
                    </select>
                </label>
            </div>
        </header>

        <FileBrowserGalleryScope v-if="!isGlobalResult" :root="scopeRoot" :path="scopePath"
            :entries="scopeEntries" :include-subfolders="includeSubfolders"
            :selected-subfolder-paths="selectedSubfolderPaths" :loading="scopeLoading" :error="scopeError"
            @navigate="navigateScope" @toggle-recursive="toggleRecursive"
            @toggle-subfolder="toggleSubfolder" @refresh="refreshScope" />

        <FileBrowserSearchPanel :key="searchPanelKey" :roots="roots" :loading="loading" :error="error" :scope="scope"
            :available-extensions="availableExtensions" :initial-request="initialSearchRequest"
            @search="runSearch" @clear="clearSearch" />

        <main class="sforge-file-gallery__content">
            <div v-if="layoutMode === 'table' && galleryAssets.length > 0" class="sforge-file-gallery-table-header"
                role="row" aria-label="表格列标题">
                <span role="columnheader">预览</span>
                <span role="columnheader">名称</span>
                <span role="columnheader">路径</span>
                <span role="columnheader">标签</span>
                <span role="columnheader">尺寸</span>
                <span role="columnheader">大小</span>
                <span role="columnheader">类型</span>
            </div>
            <VirtualMasonryGrid v-if="galleryAssets.length > 0" :key="layoutMode" ref="galleryGrid" :items="galleryAssets"
                :column-width="columnWidth" :gap="12" id-key="key" :item-height="estimateItemHeight"
                :mode="layoutMode === 'table' ? 'list' : layoutMode" :managed-by-provider="true"
                @load-more="loadNextPage">
                <template #default="{item}">
                    <FileBrowserGalleryTableRow v-if="layoutMode === 'table'" :asset="item"
                        :thumbnail-url="thumbnailUrl(item)" :selected="selectedKey === item.key"
                        @select="selectAsset" @open="openAsset" />
                    <FileBrowserGalleryCard v-else :asset="item" :thumbnail-url="thumbnailUrl(item)"
                        :selected="selectedKey === item.key" :show-path="showPaths"
                        :display-attributes="selectedAttributes"
                        @select="selectAsset" @open="openAsset" />
                </template>
            </VirtualMasonryGrid>
            <div v-else-if="loading || rootsLoading" class="sforge-file-gallery__state">
                <svg class="fn__rotate"><use href="#iconRefresh" /></svg>
                <span>正在读取资源</span>
            </div>
            <div v-else-if="rootsError || error" class="sforge-file-gallery__state sforge-file-gallery__state--error">
                <span>{{ rootsError || error }}</span>
                <button type="button" class="b3-button b3-button--text" @click="() => runScopedSearch()">重试</button>
            </div>
            <div v-else class="sforge-file-gallery__state">
                <svg><use href="#iconAssets" /></svg>
                <span>{{ hasQuery ? "没有匹配资源" : "此目录没有可展示的资源" }}</span>
            </div>
        </main>

        <footer class="sforge-file-gallery__footer" aria-live="polite">
            <span class="sforge-file-gallery__status">
                已加载 {{ loadedCount }} / {{ totalCount }} 个文件
                <span v-if="loadingMore">（继续读取）</span>
                <span v-else-if="pageError" class="sforge-file-gallery__status-error">（{{ pageError }}）</span>
            </span>
            <button v-if="pageError" type="button" class="b3-button b3-button--text"
                @click="loadNextPage">重试</button>
            <span v-if="selectedKey" class="sforge-file-gallery__selected">已选择</span>
        </footer>
    </section>
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from "vue";
import VirtualMasonryGrid from "../../components/masonry/components/VirtualMasonryGrid.vue";
import FileBrowserSearchPanel from "./FileBrowserSearchPanel.vue";
import FileBrowserGalleryScope from "./FileBrowserGalleryScope.vue";
import FileBrowserGalleryCard from "./FileBrowserGalleryCard.vue";
import FileBrowserGalleryTableRow from "./FileBrowserGalleryTableRow.vue";
import {fileBrowserRepository} from "./FileBrowser.repository";
import {fileBrowserQueryRepository} from "./FileBrowser.query.repository";
import {useFileBrowserSearch} from "./useFileBrowserSearch";
import {createFileBrowserEntryOpener} from "./FileBrowser.open";
import {fileBrowserSelection} from "./FileBrowser.selection";
import {makeFileBrowserNodeKey} from "./FileBrowser.tree";
import {resolveAssetURL} from "../../asset/assetUrl";
import {
    FILE_BROWSER_GALLERY_ATTRIBUTES,
    FILE_BROWSER_GALLERY_DEFAULT_ATTRIBUTES,
    FILE_BROWSER_GALLERY_VIEW_MODES,
} from "./FileBrowser.gallery.constants";
import type {AppFacade} from "./dock/imports";
import type {FileBrowserEntry, FileBrowserGalleryTabData, FileBrowserRoot} from "./FileBrowser.types";
import type {
    FileBrowserAssetResult,
    FileBrowserSearchRequest,
    FileBrowserSearchResult,
} from "./FileBrowser.query.types";
import type {FileBrowserGalleryAttribute, FileBrowserGalleryViewMode} from "./FileBrowser.gallery.constants";

interface GalleryAsset extends FileBrowserAssetResult {
    key: string;
}

const GALLERY_PAGE_SIZE = 200;

const props = defineProps<{
    app: AppFacade;
    file: FileBrowserGalleryTabData;
}>();

const roots = ref<FileBrowserRoot[]>([]);
const rootsLoading = ref(false);
const rootsError = ref("");
const scopePath = ref(props.file.path);
const scopeHistory = ref([scopePath.value]);
const scopeHistoryIndex = ref(0);
const scopeEntries = ref<FileBrowserEntry[]>([]);
const scopeLoading = ref(false);
const scopeError = ref("");
const includeSubfolders = ref(true);
const selectedSubfolderPaths = ref<string[]>([]);
let scopeRevision = 0;
const selectedKey = ref("");
const columnWidth = ref(typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 220);
const galleryViewModes = FILE_BROWSER_GALLERY_VIEW_MODES;
const layoutMode = ref<FileBrowserGalleryViewMode>("masonry");
const showPaths = ref(true);
const selectedAttributes = ref<FileBrowserGalleryAttribute[]>([...FILE_BROWSER_GALLERY_DEFAULT_ATTRIBUTES]);
const galleryGrid = ref<InstanceType<typeof VirtualMasonryGrid> | null>(null);
const loadedAssets = ref<GalleryAsset[]>([]);
const totalCount = ref(0);
const nextOffset = ref(0);
const loadingMore = ref(false);
const pageError = ref("");
const exhausted = ref(false);
let pageRevision = 0;
let activePageRequest: FileBrowserSearchRequest | undefined;
const search = useFileBrowserSearch(fileBrowserQueryRepository);
const {result, loading, error} = search;
const openEntry = createFileBrowserEntryOpener(props.app, fileBrowserRepository);

function cloneSearchRequest(request: FileBrowserSearchRequest | undefined) {
    if (!request) {
        return undefined;
    }
    const result: FileBrowserSearchRequest = {...request};
    if (request.rootIDs) {
        result.rootIDs = [...request.rootIDs];
    }
    if (request.pathPrefixes) {
        result.pathPrefixes = [...request.pathPrefixes];
    }
    if (request.tags) {
        result.tags = [...request.tags];
    }
    if (request.exts) {
        result.exts = [...request.exts];
    }
    if (request.palette) {
        result.palette = {...request.palette};
        if (request.palette.color) {
            result.palette.color = [...request.palette.color] as [number, number, number];
        }
    }
    return result;
}

function normalizeSearchRequest(request: FileBrowserSearchRequest | undefined) {
    const result = cloneSearchRequest(request);
    if (!result) {
        return undefined;
    }
    if (!result.keyword?.trim()) {
        delete result.keyword;
    }
    for (const key of ["rootIDs", "pathPrefixes", "tags", "exts"] as const) {
        const values = result[key];
        if (!values) {
            continue;
        }
        const cleaned = values.map(value => value.trim()).filter(Boolean);
        if (cleaned.length === 0) {
            delete result[key];
            continue;
        }
        result[key] = cleaned;
    }
    if (!result.tags || result.tags.length === 0) {
        delete result.matchAllTags;
    }
    return result;
}

/**
 * 页签数据只描述稳定的资源来源，不保存画廊运行期筛选。
 *
 * SACAssetsManager 的本地画廊把关键词、扩展名和显示条件都放在组件状态中；
 * 这里保留标签/调色板这类打开入口本身的来源条件，同时丢弃旧版本曾写入
 * 布局的 `.tmp`、关键词、尺寸和分页状态，避免重建页签时把瞬时筛选当成
 * 永久条件。
 */
function normalizeGallerySourceRequest(request: FileBrowserSearchRequest | undefined) {
    const normalized = normalizeSearchRequest(request);
    if (!normalized) {
        return undefined;
    }
    const source: FileBrowserSearchRequest = {
        orderBy: normalized.orderBy ?? "updated",
    };
    if (normalized.allRoots) {
        source.allRoots = true;
    }
    if (normalized.rootIDs && normalized.rootIDs.length > 0) {
        source.rootIDs = [...normalized.rootIDs];
    }
    if (normalized.tags && normalized.tags.length > 0) {
        source.tags = [...normalized.tags];
        if (normalized.matchAllTags !== undefined) {
            source.matchAllTags = normalized.matchAllTags;
        }
    }
    if (normalized.palette) {
        source.palette = {...normalized.palette};
        if (normalized.palette.color) {
            source.palette.color = [...normalized.palette.color] as [number, number, number];
        }
    }
    return source;
}

// 只有没有目录路径的全根结果页签才接受布局恢复的 query；目录页签即使被旧布局
// 恢复出历史 query，也必须继续以自身的 root/path 作为唯一范围。
const isGlobalResult = props.file.path.trim() === "" &&
    (props.file.scope === "global" || Boolean(props.file.query?.allRoots));
// 目录页签只保存 root/path。旧版本曾把筛选 query 写进目录页签，启动时直接丢弃，
// 这样布局序列化也不会继续携带已经失效的 .tmp、关键词或标签条件。
if (!isGlobalResult && props.file.query) {
    delete props.file.query;
}
// 页签来源只在创建/布局恢复时读取一次；currentQuery 是画廊组件内的运行期筛选，
// 不再回写 custom.data，因而关闭并重建页签时不会恢复上一次的 `.tmp` 条件。
const sourceQuery = isGlobalResult ? normalizeGallerySourceRequest(props.file.query) ?? {
    allRoots: true,
    orderBy: "updated" as const,
} : undefined;
if (isGlobalResult) {
    if (sourceQuery) {
        props.file.query = sourceQuery;
    } else if (props.file.query) {
        delete props.file.query;
    }
}
const currentQuery = ref<FileBrowserSearchRequest | undefined>(cloneSearchRequest(sourceQuery));
// 目录页签只携带地址；查询数据属于标签/全根结果页签，不能把旧的目录筛选带入新范围。
const initialSearchRequest = computed(() => currentQuery.value);
const scopeRoot = computed(() => {
    const direct = roots.value.find(root => root.id === props.file.rootID);
    if (direct) {
        return direct;
    }
    for (const root of roots.value) {
        const mount = root.mounts?.find(candidate => candidate.id === props.file.rootID);
        if (mount) {
            return {...mount};
        }
    }
    return undefined;
});
const scope = computed(() => ({rootID: props.file.rootID, path: scopePath.value}));
const canGoBack = computed(() => scopeHistoryIndex.value > 0);
const canGoForward = computed(() => scopeHistoryIndex.value < scopeHistory.value.length - 1);
// 目录切换必须创建一份空表单，不能依赖旧表单的异步 watch 是否及时触发。
const searchPanelKey = computed(() => `${props.file.rootID}:${scopePath.value}:${isGlobalResult ? "global" : "directory"}`);
const hasQuery = computed(() => result.value.totalCount > 0 || loading.value || Boolean(error.value));
const loadedCount = computed(() => loadedAssets.value.length);
const galleryAssets = computed<GalleryAsset[]>(() => loadedAssets.value);
const galleryAttributes = FILE_BROWSER_GALLERY_ATTRIBUTES;
const availableExtensions = computed(() => loadedAssets.value.map(asset => extensionOf(asset.name || asset.path)));

function toGalleryAssets(assets: FileBrowserAssetResult[]) {
    return assets.map(asset => ({
        ...asset,
        key: makeFileBrowserNodeKey(asset.rootID, asset.path),
    }));
}

function applyInitialPage(next: FileBrowserSearchResult) {
    const sourceLimit = activePageRequest?.limit ?? GALLERY_PAGE_SIZE;
    const sourceOffset = activePageRequest?.offset ?? 0;
    loadedAssets.value = toGalleryAssets(next.assets);
    totalCount.value = next.totalCount;
    nextOffset.value = sourceOffset + Math.max(sourceLimit, next.assets.length);
    exhausted.value = next.assets.length === 0 || loadedAssets.value.length >= next.totalCount;
    pageError.value = "";
}

watch(result, applyInitialPage, {flush: "post"});

// 查询结果和卡片尺寸都可能在网格已经挂载后变化；在 DOM 提交后要求现有布局引擎
// 重新计算，避免只更新卡片数据而留下旧的列坐标或旧的可见范围。
watch([galleryAssets, columnWidth], () => {
    void nextTick(() => galleryGrid.value?.refreshLayout());
}, {flush: "post"});

async function loadNextPage() {
    if (loadingMore.value || exhausted.value || !activePageRequest || loadedCount.value >= totalCount.value) {
        return;
    }
    const revision = pageRevision;
    const request: FileBrowserSearchRequest = {
        ...cloneSearchRequest(activePageRequest),
        limit: GALLERY_PAGE_SIZE,
        offset: nextOffset.value,
    };
    loadingMore.value = true;
    pageError.value = "";
    try {
        const page = await fileBrowserQueryRepository.search(request);
        if (revision !== pageRevision) {
            return;
        }
        const existing = new Map(loadedAssets.value.map(asset => [asset.key, asset]));
        for (const asset of toGalleryAssets(page.assets)) {
            existing.set(asset.key, asset);
        }
        loadedAssets.value = [...existing.values()];
        totalCount.value = page.totalCount;
        nextOffset.value += GALLERY_PAGE_SIZE;
        exhausted.value = page.assets.length === 0 || loadedAssets.value.length >= page.totalCount ||
            nextOffset.value >= page.totalCount;
    } catch (reason) {
        if (revision === pageRevision) {
            pageError.value = reason instanceof Error ? reason.message : String(reason);
        }
    } finally {
        if (revision === pageRevision) {
            loadingMore.value = false;
        }
    }
}

function thumbnailUrl(asset: FileBrowserAssetResult) {
    const params = new URLSearchParams({rootID: asset.rootID, path: asset.path, size: "360"});
    return resolveAssetURL(`/api/s-forge/file-browser/thumbnail?${params.toString()}`);
}

function extensionOf(path: string) {
    const dot = path.lastIndexOf(".");
    return dot >= 0 ? path.slice(dot).toLowerCase() : "";
}

function estimateItemHeight(asset: GalleryAsset, width = columnWidth.value) {
    if (layoutMode.value === "table") {
        return 56;
    }
    const ratio = asset.width > 0 && asset.height > 0 ? asset.height / asset.width : 0.75;
    return Math.max(150, Math.round(width * Math.min(Math.max(ratio, 0.55), 1.8)) + 92);
}

function scopedRequest(request: FileBrowserSearchRequest): FileBrowserSearchRequest {
    const next = {...request, limit: request.limit ?? 200, offset: request.offset ?? 0};
    if (isGlobalResult) {
        if (next.allRoots || (next.rootIDs && next.rootIDs.length > 0)) {
            return next;
        }
        // 清空全根结果页签的表单时，表单请求不再携带 allRoots；恢复页签原有
        // 的全根范围，但不恢复已经清掉的标签、扩展名或颜色条件。
        next.allRoots = true;
        return next;
    }
    if (!next.rootIDs || next.rootIDs.length === 0) {
        next.rootIDs = [props.file.rootID];
    }
    next.pathPrefix = scopePath.value;
    if (!includeSubfolders.value) {
        next.recursive = false;
        delete next.pathPrefixes;
    } else {
        const childPaths = scopeEntries.value.filter(entry => entry.isDir).map(entry => entry.path);
        const selected = new Set(selectedSubfolderPaths.value);
        if (childPaths.length > 0 && selected.size < childPaths.length) {
            next.recursive = false;
            next.pathPrefixes = childPaths.filter(path => selected.has(path));
        } else {
            next.recursive = true;
            delete next.pathPrefixes;
        }
    }
    return next;
}

function runSearch(request: FileBrowserSearchRequest) {
    const scoped = normalizeSearchRequest(scopedRequest(request)) ?? {orderBy: "updated"};
    currentQuery.value = isGlobalResult ? cloneSearchRequest(scoped) : undefined;
    pageRevision += 1;
    activePageRequest = {...scoped, limit: GALLERY_PAGE_SIZE, offset: 0};
    loadedAssets.value = [];
    totalCount.value = 0;
    nextOffset.value = 0;
    loadingMore.value = false;
    exhausted.value = false;
    pageError.value = "";
    const revision = pageRevision;
    void search.search(activePageRequest).then(next => {
        if (next && revision === pageRevision) {
            applyInitialPage(next);
        }
    });
}

function runScopedSearch(includeInitialQuery = true) {
    const query = initialSearchRequest.value;
    const request: FileBrowserSearchRequest = includeInitialQuery && query ?
        (cloneSearchRequest(query) ?? {}) : {orderBy: "updated"};
    if (includeInitialQuery && query) {
        request.orderBy = query.orderBy ?? "updated";
    }
    runSearch(request);
}

function clearSearch() {
    const clearedQuery = isGlobalResult ? {
        allRoots: true,
        orderBy: currentQuery.value?.orderBy ?? "updated",
    } : undefined;
    currentQuery.value = clearedQuery;
    search.clear();
    runScopedSearch(false);
}

function childDirectoryPaths() {
    return scopeEntries.value.filter(entry => entry.isDir).map(entry => entry.path);
}

function selectAllSubfolders() {
    selectedSubfolderPaths.value = childDirectoryPaths();
}

async function loadScope() {
    if (isGlobalResult) {
        return;
    }
    const revision = ++scopeRevision;
    scopeLoading.value = true;
    scopeError.value = "";
    try {
        const page = await fileBrowserRepository.listDirectory({
            rootID: props.file.rootID,
            path: scopePath.value,
            offset: 0,
            limit: 2000,
            sortBy: "name",
            sortDirection: "asc",
            directoriesFirst: true,
            includeChildCounts: true,
        });
        if (revision !== scopeRevision) {
            return;
        }
        scopeEntries.value = page.entries;
        if (includeSubfolders.value) {
            selectAllSubfolders();
        }
    } catch (reason) {
        if (revision === scopeRevision) {
            scopeError.value = reason instanceof Error ? reason.message : String(reason);
            scopeEntries.value = [];
            selectedSubfolderPaths.value = [];
        }
    } finally {
        if (revision === scopeRevision) {
            scopeLoading.value = false;
        }
    }
}

function navigateScope(path: string) {
    setScopePath(path);
}

function toggleRecursive(enabled: boolean) {
    includeSubfolders.value = enabled;
    if (enabled) {
        selectAllSubfolders();
    } else {
        selectedSubfolderPaths.value = [];
    }
    runScopedSearch(false);
}

function toggleSubfolder(path: string) {
    const selected = new Set(selectedSubfolderPaths.value);
    if (selected.has(path)) {
        selected.delete(path);
    } else {
        selected.add(path);
    }
    selectedSubfolderPaths.value = childDirectoryPaths().filter(childPath => selected.has(childPath));
    runScopedSearch(false);
}

function refreshScope() {
    void loadScope().then(() => runScopedSearch(false));
}

function normalizeScopePath(path: string) {
    return path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function setScopePath(path: string, pushHistory = true) {
    const normalized = normalizeScopePath(path);
    if (normalized === scopePath.value && pushHistory) {
        return;
    }
    if (pushHistory) {
        const nextHistory = scopeHistory.value.slice(0, scopeHistoryIndex.value + 1);
        if (nextHistory.at(-1) !== normalized) {
            nextHistory.push(normalized);
        }
        scopeHistory.value = nextHistory;
        scopeHistoryIndex.value = nextHistory.length - 1;
    }
    scopePath.value = normalized;
    selectedSubfolderPaths.value = [];
    void loadScope().then(() => runScopedSearch(false));
}

function navigateHistory(delta: number) {
    const nextIndex = scopeHistoryIndex.value + delta;
    if (nextIndex < 0 || nextIndex >= scopeHistory.value.length) {
        return;
    }
    scopeHistoryIndex.value = nextIndex;
    setScopePath(scopeHistory.value[nextIndex], false);
}

function selectAsset(asset: FileBrowserAssetResult) {
    selectedKey.value = makeFileBrowserNodeKey(asset.rootID, asset.path);
    fileBrowserSelection.replaceAddress({
        key: selectedKey.value, rootID: asset.rootID, path: asset.path, kind: "file", name: asset.name,
    });
}

async function openAsset(asset: FileBrowserAssetResult) {
    selectAsset(asset);
    const stat = await fileBrowserRepository.statFile({rootID: asset.rootID, path: asset.path});
    await openEntry(asset.rootID, stat.entry);
}

async function loadRoots() {
    rootsLoading.value = true;
    rootsError.value = "";
    try {
        roots.value = await fileBrowserRepository.listRoots();
    } catch (reason) {
        rootsError.value = reason instanceof Error ? reason.message : String(reason);
    } finally {
        rootsLoading.value = false;
    }
}

onMounted(async () => {
    await loadRoots();
    await loadScope();
    runScopedSearch();
});

onBeforeUnmount(() => search.dispose());
</script>

<style scoped lang="scss" src="./FileBrowserGalleryTab.scss"></style>
