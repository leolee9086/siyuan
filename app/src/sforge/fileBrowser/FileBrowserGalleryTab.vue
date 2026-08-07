<template>
    <section class="sforge-file-gallery" aria-label="文件资源瀑布流" :aria-busy="loading || rootsLoading">
        <header class="block__icons sforge-file-gallery__header">
            <div class="block__logo">
                <svg class="block__logoicon"><use href="#iconAssets" /></svg>
                <span>{{ file.name }}</span>
            </div>
            <span class="fn__flex-1" />
            <button type="button" class="block__icon ariaLabel" aria-label="重新查询"
                :disabled="loading" @click="() => runScopedSearch()">
                <svg :class="{'fn__rotate': loading}"><use href="#iconRefresh" /></svg>
            </button>
        </header>

        <div class="sforge-file-gallery__toolbar">
            <label class="sforge-file-gallery__size-control">
                <span>卡片宽度</span>
                <input v-model.number="columnWidth" class="b3-slider" type="range" min="140" max="360" step="10"
                    aria-label="卡片宽度" />
                <output>{{ columnWidth }}px</output>
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

        <FileBrowserGalleryScope v-if="!isAllRoots" :root="scopeRoot" :path="scopePath"
            :entries="scopeEntries" :include-subfolders="includeSubfolders"
            :selected-subfolder-paths="selectedSubfolderPaths" :loading="scopeLoading" :error="scopeError"
            @navigate="navigateScope" @toggle-recursive="toggleRecursive"
            @toggle-subfolder="toggleSubfolder" @refresh="refreshScope" />

        <FileBrowserSearchPanel :roots="roots" :loading="loading" :error="error" :scope="scope"
            :available-extensions="availableExtensions" :initial-request="file.query"
            @search="runSearch" @clear="clearSearch" />

        <main class="sforge-file-gallery__content">
            <VirtualMasonryGrid v-if="galleryAssets.length > 0" :items="galleryAssets" :column-width="columnWidth"
                :gap="12" id-key="key" :item-height="estimateItemHeight" :managed-by-provider="true">
                <template #default="{item}">
                    <FileBrowserGalleryCard :asset="item" :thumbnail-url="thumbnailUrl(item)"
                        :selected="selectedKey === item.key" :display-attributes="selectedAttributes"
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

        <footer class="sforge-file-gallery__footer">
            <span>{{ result.totalCount }} 个结果</span>
            <span v-if="selectedKey" class="sforge-file-gallery__selected">已选择</span>
        </footer>
    </section>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from "vue";
import VirtualMasonryGrid from "../../components/masonry/components/VirtualMasonryGrid.vue";
import FileBrowserSearchPanel from "./FileBrowserSearchPanel.vue";
import FileBrowserGalleryScope from "./FileBrowserGalleryScope.vue";
import FileBrowserGalleryCard from "./FileBrowserGalleryCard.vue";
import {fileBrowserRepository} from "./FileBrowser.repository";
import {fileBrowserQueryRepository} from "./FileBrowser.query.repository";
import {useFileBrowserSearch} from "./useFileBrowserSearch";
import {createFileBrowserEntryOpener} from "./FileBrowser.open";
import {fileBrowserSelection} from "./FileBrowser.selection";
import {makeFileBrowserNodeKey} from "./FileBrowser.tree";
import {
    FILE_BROWSER_GALLERY_ATTRIBUTES,
    FILE_BROWSER_GALLERY_DEFAULT_ATTRIBUTES,
} from "./FileBrowser.gallery.constants";
import type {AppFacade} from "./dock/imports";
import type {FileBrowserEntry, FileBrowserGalleryTabData, FileBrowserRoot} from "./FileBrowser.types";
import type {FileBrowserAssetResult, FileBrowserSearchRequest} from "./FileBrowser.query.types";
import type {FileBrowserGalleryAttribute} from "./FileBrowser.gallery.constants";

interface GalleryAsset extends FileBrowserAssetResult {
    key: string;
}

const props = defineProps<{
    app: AppFacade;
    file: FileBrowserGalleryTabData;
}>();

const roots = ref<FileBrowserRoot[]>([]);
const rootsLoading = ref(false);
const rootsError = ref("");
const scopePath = ref(props.file.path);
const scopeEntries = ref<FileBrowserEntry[]>([]);
const scopeLoading = ref(false);
const scopeError = ref("");
const includeSubfolders = ref(true);
const selectedSubfolderPaths = ref<string[]>([]);
let scopeRevision = 0;
const selectedKey = ref("");
const columnWidth = ref(typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 220);
const selectedAttributes = ref<FileBrowserGalleryAttribute[]>([...FILE_BROWSER_GALLERY_DEFAULT_ATTRIBUTES]);
const search = useFileBrowserSearch(fileBrowserQueryRepository);
const {result, loading, error} = search;
const openEntry = createFileBrowserEntryOpener(props.app, fileBrowserRepository);
const isAllRoots = computed(() => Boolean(props.file.query?.allRoots));
const scopeRoot = computed(() => roots.value.find(root => root.id === props.file.rootID));
const scope = computed(() => ({rootID: props.file.rootID, path: scopePath.value}));
const hasQuery = computed(() => result.value.totalCount > 0 || loading.value || Boolean(error.value));
const galleryAssets = computed<GalleryAsset[]>(() => result.value.assets.map(asset => ({
    ...asset,
    key: makeFileBrowserNodeKey(asset.rootID, asset.path),
})));
const galleryAttributes = FILE_BROWSER_GALLERY_ATTRIBUTES;
const availableExtensions = computed(() => result.value.assets.map(asset => extensionOf(asset.name || asset.path)));

function thumbnailUrl(asset: FileBrowserAssetResult) {
    const params = new URLSearchParams({rootID: asset.rootID, path: asset.path, size: "360"});
    return `/api/s-forge/file-browser/thumbnail?${params.toString()}`;
}

function extensionOf(path: string) {
    const dot = path.lastIndexOf(".");
    return dot >= 0 ? path.slice(dot).toLowerCase() : "";
}

function estimateItemHeight(asset: GalleryAsset, width = columnWidth.value) {
    const ratio = asset.width > 0 && asset.height > 0 ? asset.height / asset.width : 0.75;
    return Math.max(150, Math.round(width * Math.min(Math.max(ratio, 0.55), 1.8)) + 92);
}

function scopedRequest(request: FileBrowserSearchRequest): FileBrowserSearchRequest {
    const next = {...request, limit: request.limit ?? 200, offset: request.offset ?? 0};
    if (next.allRoots || isAllRoots.value) {
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
    void search.search(scopedRequest(request));
}

function runScopedSearch(includeInitialQuery = true) {
    const request: FileBrowserSearchRequest = includeInitialQuery && props.file.query ?
        {...props.file.query, orderBy: props.file.query.orderBy ?? "updated"} : {orderBy: "updated"};
    runSearch(request);
}

function clearSearch() {
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
    if (isAllRoots.value) {
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
    scopePath.value = path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    selectedSubfolderPaths.value = [];
    void loadScope().then(() => runScopedSearch(false));
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
