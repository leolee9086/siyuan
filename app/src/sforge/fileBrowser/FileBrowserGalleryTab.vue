<template>
    <section ref="galleryRoot" class="sforge-file-gallery" aria-label="文件资源画廊" v-bind="galleryRootAttributes"
        :aria-busy="loading || loadingMore || rootsLoading">
        <header class="sforge-file-gallery__header">
            <div class="sforge-file-gallery__topline">
                <div class="sforge-file-gallery__history" aria-label="目录导航">
                    <button type="button" class="block__icon block__icon--show ariaLabel" aria-label="返回上一级目录"
                        :disabled="!canGoBack" @click="navigateHistory(-1)">
                        <svg><use href="#iconLeft" /></svg>
                    </button>
                    <button type="button" class="block__icon block__icon--show ariaLabel" aria-label="前进到下一级目录"
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
                        class="block__icon block__icon--show ariaLabel" :class="{'block__icon--active': layoutMode === mode.value}"
                        :aria-label="mode.label" :title="mode.label" :aria-pressed="layoutMode === mode.value"
                        @click="layoutMode = mode.value">
                        <svg aria-hidden="true"><use :href="mode.icon" /></svg>
                    </button>
                </div>
                <button type="button" class="block__icon block__icon--show ariaLabel" aria-label="重新查询"
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
                <div class="sforge-file-gallery__attribute-control">
                    <span>显示属性</span>
                    <FileBrowserMultiSelect v-model="selectedAttributes" :options="galleryAttributeKeys"
                        :option-labels="galleryAttributeLabels" placeholder="属性" ariaLabel="显示属性" />
                </div>
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

        <main ref="galleryContent" class="sforge-file-gallery__content" @mousedown.left="startMarquee"
            @dragover.prevent="handleGalleryDragOver" @drop.prevent="handleGalleryDrop">
            <div v-if="galleryContentState.kind === 'ready'" key="gallery-ready"
                class="sforge-file-gallery__ready-surface">
                <div v-if="layoutMode === 'table'" class="sforge-file-gallery-table-header"
                    role="row" aria-label="表格列标题">
                    <span role="columnheader">预览</span>
                    <span role="columnheader">名称</span>
                    <span role="columnheader">路径</span>
                    <span role="columnheader">标签</span>
                    <span role="columnheader">尺寸</span>
                    <span role="columnheader">大小</span>
                    <span role="columnheader">类型</span>
                </div>
                <VirtualMasonryGrid :key="layoutMode" ref="galleryGrid" :items="galleryAssets"
                    :column-width="effectiveColumnWidth" :gap="12" id-key="key" :item-height="estimateItemHeight"
                    :mode="layoutMode === 'table' ? 'list' : layoutMode" :managed-by-provider="true"
                    @load-more="loadNextPage">
                    <template #default="{item, index}">
                        <FileBrowserGalleryTableRow v-if="layoutMode === 'table'" :asset="item"
                            :index="index" :drag-items="dragItemsFor(item)" :thumbnail-url="thumbnailUrl(item)"
                            :selected="isAssetSelected(item)" @select-with-event="selectAsset" @open="openAsset"
                            @keydown="handleAssetKeydown" @menu="openGalleryMenu" />
                        <FileBrowserGalleryCard v-else :asset="item" :thumbnail-url="thumbnailUrl(item)"
                            :index="index" :drag-items="dragItemsFor(item)" :selected="isAssetSelected(item)"
                            :show-path="showPaths"
                            :display-attributes="selectedAttributes"
                            @select-with-event="selectAsset" @open="openAsset" @keydown="handleAssetKeydown"
                            @menu="openGalleryMenu" />
                    </template>
                </VirtualMasonryGrid>
                <div v-if="marquee.active" class="sforge-file-gallery__selection-box" :style="marqueeStyle"
                    aria-hidden="true" />
            </div>
            <div v-else-if="galleryContentState.kind === 'loading'" key="gallery-loading" class="sforge-file-gallery__state">
                <svg class="fn__rotate"><use href="#iconRefresh" /></svg>
                <span>正在读取资源</span>
            </div>
            <div v-else-if="galleryContentState.kind === 'error'" key="gallery-error"
                class="sforge-file-gallery__state sforge-file-gallery__state--error">
                <span>{{ rootsError || error || galleryResult.error }}</span>
                <button type="button" class="b3-button b3-button--text" @click="() => runScopedSearch()">重试</button>
            </div>
            <div v-else-if="galleryContentState.kind === 'empty'" key="gallery-empty"
                class="sforge-file-gallery__state">
                <svg><use href="#iconAssets" /></svg>
                <span>{{ hasQuery ? "没有匹配资源" : "此目录没有可展示的资源" }}</span>
            </div>
            <div v-else key="gallery-invalid-state"
                class="sforge-file-gallery__state sforge-file-gallery__state--error">
                <span>资源状态异常，结果未加载</span>
                <button type="button" class="b3-button b3-button--text" @click="() => runScopedSearch()">重试</button>
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
            <span v-if="selectedCount > 0" class="sforge-file-gallery__selected">已选择 {{ selectedCount }} 项</span>
        </footer>
    </section>
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from "vue";
import VirtualMasonryGrid from "../../components/masonry/components/VirtualMasonryGrid.vue";
import FileBrowserSearchPanel from "./FileBrowserSearchPanel.vue";
import FileBrowserMultiSelect from "./FileBrowserMultiSelect.vue";
import FileBrowserGalleryScope from "./FileBrowserGalleryScope.vue";
import FileBrowserGalleryCard from "./FileBrowserGalleryCard.vue";
import FileBrowserGalleryTableRow from "./FileBrowserGalleryTableRow.vue";
import {fileBrowserRepository} from "./FileBrowser.repository";
import {fileBrowserQueryRepository} from "./FileBrowser.query.repository";
import {fileBrowserOperationsRepository} from "./FileBrowser.operations.repository";
import {requestFileBrowserConfirmation} from "./FileBrowser.operations.dialog";
import {createFileBrowserDirectoryOpener, createFileBrowserEntryOpener} from "./FileBrowser.open";
import {fileBrowserSelection} from "./FileBrowser.selection";
import {FILE_BROWSER_DRAG_MIME, parseFileBrowserDragData} from "./FileBrowser.drag";
import {getFileBrowserCapabilitiesForPath, makeFileBrowserNodeKey} from "./FileBrowser.tree";
import {createFileBrowserAgentFileTask} from "./FileBrowserAgentActions";
import {
    openFileBrowserGalleryAssetContainingFolder,
    openFileBrowserGalleryAssetDefault,
    showFileBrowserGalleryItemMenu,
    showFileBrowserGalleryProperties,
} from "./FileBrowserGalleryMenu";
import {resolveAssetURL} from "../../asset/assetUrl";
import {getAssetThumbnailRequestURL} from "../../asset/assetFormat";
import {isElectron} from "../../platform";
import {showMessage} from "../../dialog/message";
import {escapeHtml} from "../../util/DOM/escape";
import {
    FILE_BROWSER_GALLERY_ATTRIBUTES,
    FILE_BROWSER_GALLERY_DEFAULT_ATTRIBUTES,
    FILE_BROWSER_GALLERY_VIEW_MODES,
} from "./FileBrowser.gallery.constants";
import type {AppFacade} from "./dock/imports";
import type {
    FileBrowserDragItem,
    FileBrowserEntry,
    FileBrowserGalleryTabData,
    FileBrowserRoot,
    FileBrowserSelectionItem,
} from "./FileBrowser.types";
import type {
    FileBrowserAssetResult,
    FileBrowserSearchRequest,
} from "./FileBrowser.query.types";
import type {FileBrowserGalleryAttribute, FileBrowserGalleryViewMode} from "./FileBrowser.gallery.constants";
import {
    appendFileBrowserGalleryPage,
    applyFileBrowserGalleryInitialPage,
    createFileBrowserGalleryResult,
    deriveFileBrowserGalleryContentState,
    type FileBrowserGalleryAsset,
    type FileBrowserGalleryResultState,
} from "./FileBrowserGalleryState";

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
const selectedCount = computed(() => {
    const visibleKeys = new Set(galleryAssets.value.map(asset => asset.key));
    return fileBrowserSelection.items.value.filter(item => visibleKeys.has(item.key)).length;
});
const galleryRoot = ref<HTMLElement | null>(null);
const galleryContent = ref<HTMLElement | null>(null);
interface MarqueeState {
    active: boolean;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    toggle: boolean;
    range: boolean;
}
const marquee = ref<MarqueeState>({active: false, startX: 0, startY: 0, endX: 0, endY: 0, toggle: false, range: false});
const marqueeStyle = computed(() => ({
    left: `${Math.min(marquee.value.startX, marquee.value.endX)}px`,
    top: `${Math.min(marquee.value.startY, marquee.value.endY)}px`,
    width: `${Math.abs(marquee.value.endX - marquee.value.startX)}px`,
    height: `${Math.abs(marquee.value.endY - marquee.value.startY)}px`,
}));
const containerWidth = ref(0);
const columnWidth = ref(220);
const galleryViewModes = FILE_BROWSER_GALLERY_VIEW_MODES;
const layoutMode = ref<FileBrowserGalleryViewMode>("masonry");
const galleryRootAttributes = computed(() => ({"data-layout-mode": layoutMode.value}));
const showPaths = ref(true);
const selectedAttributes = ref<FileBrowserGalleryAttribute[]>([...FILE_BROWSER_GALLERY_DEFAULT_ATTRIBUTES]);
const galleryGrid = ref<InstanceType<typeof VirtualMasonryGrid> | null>(null);
const effectiveColumnWidth = computed(() => {
    const availableWidth = containerWidth.value - 24;
    return availableWidth > 0 ? Math.min(columnWidth.value, availableWidth) : columnWidth.value;
});
let galleryResizeObserver: ResizeObserver | undefined;

// 结果数组、总数、分页游标和显示阶段必须作为一个提交单元更新。
// 分开维护这些 ref 会让旧卡片与空态在异步刷新窗口中同时出现。
const galleryResult = ref<FileBrowserGalleryResultState>(createFileBrowserGalleryResult());
let pageRevision = 0;
let activePageRequest: FileBrowserSearchRequest | undefined;
const openEntry = createFileBrowserEntryOpener(props.app, fileBrowserRepository);
const openDirectory = createFileBrowserDirectoryOpener(props.app);

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
const hasActiveFilters = ref(false);
const hasQuery = computed(() => hasActiveFilters.value);
const loadedCount = computed(() => galleryResult.value.assets.length);
const totalCount = computed(() => galleryResult.value.totalCount);
const loading = computed(() => galleryResult.value.phase === "loading");
const error = computed(() => galleryResult.value.error);
const loadingMore = computed(() => galleryResult.value.loadingMore);
const pageError = computed(() => galleryResult.value.pageError);
const galleryContentState = computed(() => deriveFileBrowserGalleryContentState(
    galleryResult.value,
    rootsLoading.value,
    rootsError.value,
));
const galleryAssets = computed<FileBrowserGalleryAsset[]>(() => galleryContentState.value.assets);
const galleryAttributes = FILE_BROWSER_GALLERY_ATTRIBUTES;
const galleryAttributeKeys = galleryAttributes.map(attribute => attribute.key);
const galleryAttributeLabels = Object.fromEntries(galleryAttributes.map(attribute => [attribute.key, attribute.label]));
const availableExtensions = computed(() => galleryResult.value.assets.map(asset => extensionOf(asset.name || asset.path)));

function setPageError(message: string) {
    galleryResult.value = {...galleryResult.value, pageError: message};
}

// 查询结果和卡片尺寸都可能在网格已经挂载后变化；在 DOM 提交后要求现有布局引擎
// 重新计算，避免只更新卡片数据而留下旧的列坐标或旧的可见范围。
watch([galleryAssets, effectiveColumnWidth], () => {
    void nextTick(() => galleryGrid.value?.refreshLayout());
}, {flush: "post"});

async function loadNextPage() {
    if (galleryResult.value.loadingMore || galleryResult.value.exhausted || !activePageRequest ||
        loadedCount.value >= totalCount.value) {
        return;
    }
    const revision = pageRevision;
    const request: FileBrowserSearchRequest = {
        ...cloneSearchRequest(activePageRequest),
        limit: GALLERY_PAGE_SIZE,
        offset: galleryResult.value.nextOffset,
    };
    galleryResult.value = {...galleryResult.value, loadingMore: true, pageError: ""};
    try {
        const page = await fileBrowserQueryRepository.search(request);
        if (revision !== pageRevision) {
            return;
        }
        galleryResult.value = appendFileBrowserGalleryPage(
            galleryResult.value,
            page,
            GALLERY_PAGE_SIZE,
            asset => makeFileBrowserNodeKey(asset.rootID, asset.path),
        );
    } catch (reason) {
        if (revision === pageRevision) {
            galleryResult.value = {
                ...galleryResult.value,
                loadingMore: false,
                pageError: reason instanceof Error ? reason.message : String(reason),
            };
        }
    } finally {
        if (revision === pageRevision && galleryResult.value.loadingMore) {
            galleryResult.value = {...galleryResult.value, loadingMore: false};
        }
    }
}

function thumbnailUrl(asset: FileBrowserAssetResult) {
    return resolveAssetURL(getAssetThumbnailRequestURL(asset.path, 360, asset.rootID));
}

function extensionOf(path: string) {
    const dot = path.lastIndexOf(".");
    return dot >= 0 ? path.slice(dot).toLowerCase() : "";
}

function estimateItemHeight(asset: FileBrowserGalleryAsset, width = effectiveColumnWidth.value) {
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
    hasActiveFilters.value = Boolean(scoped.keyword?.trim() || scoped.tags?.length || scoped.exts?.length ||
        scoped.palette || scoped.minWidth || scoped.maxWidth || scoped.minHeight || scoped.maxHeight ||
        scoped.minSize || scoped.maxSize || scoped.minStar || scoped.maxStar);
    currentQuery.value = isGlobalResult ? cloneSearchRequest(scoped) : undefined;
    pageRevision += 1;
    const pageRequest: FileBrowserSearchRequest = {...scoped, limit: GALLERY_PAGE_SIZE, offset: 0};
    activePageRequest = pageRequest;
    galleryResult.value = createFileBrowserGalleryResult();
    const revision = pageRevision;
    void fileBrowserQueryRepository.search(pageRequest).then(next => {
        if (revision !== pageRevision) {
            return;
        }
        galleryResult.value = applyFileBrowserGalleryInitialPage(
            next,
            pageRequest,
            GALLERY_PAGE_SIZE,
            asset => makeFileBrowserNodeKey(asset.rootID, asset.path),
        );
    }).catch(reason => {
        if (revision !== pageRevision) {
            return;
        }
        galleryResult.value = {
            ...galleryResult.value,
            phase: "error",
            error: reason instanceof Error ? reason.message : String(reason),
            pageError: "",
        };
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
    hasActiveFilters.value = false;
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
    const nextPath = scopeHistory.value[nextIndex];
    if (nextPath === undefined) {
        return;
    }
    scopeHistoryIndex.value = nextIndex;
    setScopePath(nextPath, false);
}

function selectionItemForAsset(asset: FileBrowserAssetResult): FileBrowserSelectionItem {
    return {
        key: makeFileBrowserNodeKey(asset.rootID, asset.path),
        rootID: asset.rootID,
        path: asset.path,
        kind: "file",
        name: asset.name,
    };
}

function gallerySelectionItems() {
    return galleryAssets.value.map(selectionItemForAsset);
}

function isAssetSelected(asset: FileBrowserGalleryAsset) {
    return fileBrowserSelection.items.value.some(item => item.key === asset.key);
}

function selectAsset(asset: FileBrowserAssetResult, event?: MouseEvent | KeyboardEvent) {
    const item = selectionItemForAsset(asset);
    const toggle = Boolean(event?.ctrlKey || event?.metaKey);
    const range = Boolean(event?.shiftKey);
    fileBrowserSelection.selectAddress(item, gallerySelectionItems(), {toggle, range});
}

function dragItemsFor(asset: FileBrowserGalleryAsset): readonly FileBrowserDragItem[] {
    const visibleKeys = new Set(galleryAssets.value.map(item => item.key));
    const selected = fileBrowserSelection.items.value.filter(item => visibleKeys.has(item.key) && item.kind === "file");
    const current = selectionItemForAsset(asset);
    const source = selected.length > 1 && selected.some(item => item.key === current.key) ? selected : [current];
    return source.map(item => ({
        rootID: item.rootID, path: item.path, kind: "file" as const, name: item.name,
    }));
}

function galleryColumnCount() {
    if (layoutMode.value === "list" || layoutMode.value === "table" || containerWidth.value <= 0) {
        return 1;
    }
    const available = Math.max(1, containerWidth.value - 24);
    return Math.max(1, Math.floor((available + 12) / (effectiveColumnWidth.value + 12)));
}

function focusGalleryAsset(index: number) {
    const target = galleryContent.value?.querySelector<HTMLElement>(`[data-gallery-index="${index}"]`);
    target?.focus();
}

function handleAssetKeydown(asset: FileBrowserAssetResult, event: KeyboardEvent) {
    const index = galleryAssets.value.findIndex(item => item.key === makeFileBrowserNodeKey(asset.rootID, asset.path));
    if (index < 0) {
        return;
    }
    if (event.key === "Escape") {
        event.preventDefault();
        fileBrowserSelection.clear();
        return;
    }
    if (event.key === "Enter") {
        event.preventDefault();
        void openAsset(asset);
        return;
    }
    const columnCount = galleryColumnCount();
    let nextIndex = index;
    if (event.key === "ArrowLeft") {
        nextIndex = Math.max(0, index - 1);
    } else if (event.key === "ArrowRight") {
        nextIndex = Math.min(galleryAssets.value.length - 1, index + 1);
    } else if (event.key === "ArrowUp") {
        nextIndex = Math.max(0, index - columnCount);
    } else if (event.key === "ArrowDown") {
        nextIndex = Math.min(galleryAssets.value.length - 1, index + columnCount);
    } else {
        return;
    }
    event.preventDefault();
    const target = galleryAssets.value[nextIndex];
    if (!target) {
        return;
    }
    selectAsset(target, event);
    focusGalleryAsset(nextIndex);
}

function isMarqueeExcludedTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest(
        "article, button, input, select, textarea, .sforge-file-search, .sforge-file-gallery-scope, .sforge-file-gallery__header, .sforge-file-gallery__footer",
    ));
}

function updateMarquee(event: MouseEvent) {
    if (!marquee.value.active) {
        return;
    }
    marquee.value.endX = event.clientX;
    marquee.value.endY = event.clientY;
}

function finishMarquee() {
    if (!marquee.value.active) {
        return;
    }
    const current = marquee.value;
    const minX = Math.min(current.startX, current.endX);
    const maxX = Math.max(current.startX, current.endX);
    const minY = Math.min(current.startY, current.endY);
    const maxY = Math.max(current.startY, current.endY);
    const hits: FileBrowserSelectionItem[] = [];
    if (maxX - minX >= 4 || maxY - minY >= 4) {
        const elements = galleryContent.value?.querySelectorAll<HTMLElement>("[data-file-key]") ?? [];
        const keyByElement = new Map<string, FileBrowserSelectionItem>(gallerySelectionItems().map(item => [item.key, item]));
        elements.forEach(element => {
            const key = element.dataset.fileKey;
            const item = key ? keyByElement.get(key) : undefined;
            if (!item) {
                return;
            }
            const rect = element.getBoundingClientRect();
            if (rect.right >= minX && rect.left <= maxX && rect.bottom >= minY && rect.top <= maxY) {
                hits.push(item);
            }
        });
    }
    fileBrowserSelection.selectAddresses(hits, gallerySelectionItems(), {
        toggle: current.toggle,
        range: current.range,
    });
    marquee.value.active = false;
    window.removeEventListener("mousemove", updateMarquee);
    window.removeEventListener("mouseup", finishMarquee);
}

function startMarquee(event: MouseEvent) {
    if (event.button !== 0 || isMarqueeExcludedTarget(event.target)) {
        return;
    }
    marquee.value = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        endX: event.clientX,
        endY: event.clientY,
        toggle: event.ctrlKey || event.metaKey,
        range: event.shiftKey,
    };
    window.addEventListener("mousemove", updateMarquee);
    window.addEventListener("mouseup", finishMarquee);
}

function handleGalleryDragOver(event: DragEvent) {
    if (isGlobalResult || !scopeRoot.value || !getFileBrowserCapabilitiesForPath(scopeRoot.value, scopePath.value).write) {
        return;
    }
    if (event.dataTransfer?.types.includes(FILE_BROWSER_DRAG_MIME)) {
        event.dataTransfer.dropEffect = "move";
    }
}

async function handleGalleryDrop(event: DragEvent) {
    const source = parseFileBrowserDragData(event.dataTransfer?.getData(FILE_BROWSER_DRAG_MIME));
    if (!source) {
        return;
    }
    if (isGlobalResult) {
        setPageError("全局资源结果没有唯一的目录目标，请从目录页签执行移动");
        return;
    }
    const targetRoot = scopeRoot.value;
    if (!targetRoot || !targetRoot.exists || !getFileBrowserCapabilitiesForPath(targetRoot, scopePath.value).write) {
        setPageError("当前目录不可写，无法接收拖放项目");
        return;
    }
    const sources = source.items ?? [source];
    let dropError = "";
    try {
        if (sources.length === 1) {
            const item = sources[0]!;
            await fileBrowserOperationsRepository.move({
                sourceRootID: item.rootID,
                sourcePath: item.path,
                destinationRootID: props.file.rootID,
                destinationPath: `${scopePath.value ? `${scopePath.value}/` : ""}${basename(item.path)}`,
            });
            fileBrowserSelection.removeSubtree(item.rootID, item.path);
            showMessage(`已移动：${escapeHtml(item.name)}`, 3000);
        } else {
            const result = await fileBrowserOperationsRepository.moveBatch({
                items: sources.map(item => ({rootID: item.rootID, path: item.path})),
                destinationRootID: props.file.rootID,
                destinationPath: scopePath.value,
            });
            const failures = result.items.filter(item => item.error);
            result.items.filter(item => !item.error).forEach(item => fileBrowserSelection.removeSubtree(
                item.request.rootID, item.request.path,
            ));
            if (failures.length > 0) {
                dropError = `部分项目移动失败：${failures.map(item => item.error?.message ?? "未知错误").join("；")}`;
            } else {
                showMessage(`已移动 ${result.successCount} 项`, 3000);
            }
        }
        await loadScope();
        runScopedSearch(false);
        if (dropError) {
            setPageError(dropError);
        }
    } catch (reason) {
        setPageError(reason instanceof Error ? reason.message : String(reason));
    }
}

function resolveAssetRoot(asset: FileBrowserAssetResult) {
    const direct = roots.value.find(root => root.id === asset.rootID);
    if (direct) {
        return direct;
    }
    for (const root of roots.value) {
        const mount = root.mounts?.find(candidate => candidate.id === asset.rootID);
        if (mount) {
            return {...mount};
        }
    }
    return undefined;
}

function parentRelativePath(path: string) {
    const normalized = path.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    const index = normalized.lastIndexOf("/");
    return index >= 0 ? normalized.slice(0, index) : "";
}

function basename(path: string) {
    const normalized = path.trim().replaceAll("\\", "/");
    return normalized.split("/").at(-1) || normalized;
}

async function openSourceNote(asset: FileBrowserAssetResult) {
    const blockID = asset.boundBlockId.trim();
    if (!blockID) {
        return;
    }
    await props.app.openBlock({id: blockID, action: ["cb-get-focus"]});
}

async function deleteAsset(asset: FileBrowserAssetResult) {
    const root = resolveAssetRoot(asset);
    if (!root || !root.exists || !getFileBrowserCapabilitiesForPath(root, asset.path).write) {
        setPageError("资源根当前不可写");
        return;
    }
    const confirmed = await requestFileBrowserConfirmation(
        "删除文件",
        `确定将 <b>${escapeHtml(asset.name || basename(asset.path))}</b> 移动到回收站吗？此操作不可撤销。`,
    );
    if (!confirmed) {
        return;
    }
    try {
        const result = await fileBrowserOperationsRepository.delete({rootID: asset.rootID, path: asset.path});
        fileBrowserSelection.removeSubtree(asset.rootID, asset.path);
        const removedCount = Math.max(1, result.removedFileCount ?? 1);
        const assets = galleryResult.value.assets.filter(item =>
            item.key !== makeFileBrowserNodeKey(asset.rootID, asset.path));
        const nextTotalCount = Math.max(0, galleryResult.value.totalCount - removedCount);
        const nextOffset = Math.max(assets.length, galleryResult.value.nextOffset - removedCount);
        galleryResult.value = {
            ...galleryResult.value,
            phase: assets.length > 0 ? "ready" : "empty",
            assets,
            totalCount: nextTotalCount,
            nextOffset,
            exhausted: assets.length >= nextTotalCount,
            pageError: "",
        };
        showMessage(`已删除：${escapeHtml(asset.path)}`, 3000);
    } catch (reason) {
        setPageError(reason instanceof Error ? reason.message : String(reason));
    }
}

function openGalleryMenu(asset: FileBrowserAssetResult, event: MouseEvent) {
    const root = resolveAssetRoot(asset);
    if (!root) {
        setPageError("资源根不存在");
        return;
    }
    selectAsset(asset);
    showFileBrowserGalleryItemMenu(event, asset, root, thumbnailUrl(asset), {
        open: openAsset,
        createAgentTask: async item => {
            try {
                const stat = await fileBrowserRepository.statFile({rootID: item.rootID, path: item.path});
                await createFileBrowserAgentFileTask({
                    name: item.name,
                    contentURL: stat.contentURL,
                    mediaType: stat.mediaType,
                });
                showMessage(`已在 Agent 面板创建附件任务：${item.name}`, 3000);
            } catch (reason) {
                setPageError(reason instanceof Error ? reason.message : String(reason));
            }
        },
        openSourceNote,
        ...(isElectron ? {
            openDefault: openFileBrowserGalleryAssetDefault,
            openContainingFolder: openFileBrowserGalleryAssetContainingFolder,
        } : {}),
        openDirectory: async item => openDirectory(item.rootID, parentRelativePath(item.path),
            basename(parentRelativePath(item.path)) || root.label),
        openProperties: item => showFileBrowserGalleryProperties(item, () => selectAsset(item)),
        delete: deleteAsset,
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

function observeGalleryContainer() {
    if (!galleryRoot.value || typeof ResizeObserver === "undefined") {
        return;
    }
    galleryResizeObserver = new ResizeObserver(([entry]) => {
        const width = entry?.contentRect.width ?? 0;
        if (Number.isFinite(width) && width !== containerWidth.value) {
            containerWidth.value = Math.max(0, width);
        }
    });
    galleryResizeObserver.observe(galleryRoot.value);
}

onMounted(async () => {
    observeGalleryContainer();
    await loadRoots();
    await loadScope();
    runScopedSearch();
});

onBeforeUnmount(() => {
    galleryResizeObserver?.disconnect();
    galleryResizeObserver = undefined;
    window.removeEventListener("mousemove", updateMarquee);
    window.removeEventListener("mouseup", finishMarquee);
});
</script>

<style scoped lang="scss" src="./FileBrowserGalleryTab.scss"></style>
