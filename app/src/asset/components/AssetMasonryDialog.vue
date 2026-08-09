<template>
    <div class="asset-masonry-dialog">
        <!-- 左侧：搜索和瀑布流网格 -->
        <div class="asset-masonry-dialog__left">
            <!-- 搜索栏 -->
            <div class="asset-masonry-dialog__search">
                <input ref="searchInputRef" v-model="searchKey" class="b3-text-field fn__flex-1"
                    :placeholder="i18n.search || '搜索...'" @input="debouncedSearch" @compositionend="handleSearch" />
            </div>

            <!-- 过滤按钮 -->
            <div class="asset-masonry-dialog__filters">
                <button data-type="filter-type" class="b3-button b3-button--outline b3-button--small"
                    @click="showTypeFilter">
                    Type ▼
                </button>
                <button data-type="filter-size" class="b3-button b3-button--outline b3-button--small"
                    @click="showSizeFilter">
                    Size ▼
                </button>
                <button data-type="filter-rating" class="b3-button b3-button--outline b3-button--small"
                    @click="showRatingFilter">
                    Rating ▼
                </button>
            </div>

            <!-- 瀑布流网格 -->
            <div class="asset-masonry-dialog__grid" ref="gridContainerRef">
                <VirtualMasonryGrid v-if="assets.length > 0" :items="assets" :column-width="columnWidth" :gap="12"
                    id-key="path" :item-height="estimateItemHeight" :managed-by-provider="true">
                    <template #default="{ item }">
                        <AssetCard :item="item" :is-selected="selectedAsset?.path === item.path"
                            @select="handleSelect" />
                    </template>
                </VirtualMasonryGrid>
                <div v-else-if="isLoading" class="asset-masonry-dialog__loading">
                    <img src="/stage/loading-pure.svg" style="width: 64px; height: 64px;" />
                </div>
                <div v-else-if="searchError" class="asset-masonry-dialog__error" role="alert">
                    <span>{{ searchError }}</span>
                    <button type="button" class="b3-button b3-button--text" @click="searchAssets">重试</button>
                </div>
                <div v-else class="asset-masonry-dialog__empty">
                    {{ i18n.emptyContent || '暂无内容' }}
                </div>
            </div>
            <div v-if="searchError && assets.length > 0" class="asset-masonry-dialog__error" role="alert">
                <span>{{ searchError }}</span>
                <button type="button" class="b3-button b3-button--text" @click="searchAssets">重试</button>
            </div>
        </div>

    </div>

</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import VirtualMasonryGrid from "../../components/masonry/components/VirtualMasonryGrid.vue";
import AssetCard from "./AssetCard.vue";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { 搜索素材元数据, type SearchAssetMetaParams } from "../../data/kernelAPI/sforgeAssetMeta";
import { pathPosix } from "../../util/file/pathName";
import type {AssetItem} from "./AssetCard.types";
import {ASSET_IMAGE_EXTENSIONS, getAssetThumbnailUrl, isAssetImage} from "./AssetCard.utils";

interface AssetMeta {
    width?: number;
    height?: number;
    fileSize?: number;
    star?: number;
    palettes?: { color: number[] }[];
}

const props = defineProps<{
    onSelect?: (url: string, name: string) => void;
    onCancel?: () => void;
}>();

const emit = defineEmits<{
    (e: "select", url: string, name: string): void;
    (e: "cancel"): void;
}>();

// 状态
const searchKey = ref("");
const assets = ref<AssetItem[]>([]);
const selectedAsset = ref<AssetItem | null>(null);
const isLoading = ref(true);
const searchError = ref("");
const currentFilters = ref<SearchAssetMetaParams>({
    limit: 200,
    offset: 0,
});
const searchInputRef = ref<HTMLInputElement | null>(null);
const gridContainerRef = ref<HTMLElement | null>(null);

// 计算属性
const isMobileDevice = computed(() => {
    return window.innerWidth < 768;
});

const columnWidth = computed(() => {
    return isMobileDevice.value ? 120 : 180;
});

// i18n
const i18n = computed(() => {
    return (window as any).siyuan?.languages || {};
});

/** 估算素材卡片高度 */
const estimateItemHeight = (item: AssetItem, colWidth: number) => {
    // 对于图片，假设平均宽高比为 4:3
    // 对于非图片，返回固定高度
    const ext = item.path.split(".").pop()?.toLowerCase() || "";
    if (isAssetImage(item.path)) {
        return Math.round(colWidth * 0.75); // 4:3 比例
    }
    return 120; // 非图片固定高度
};

/** 搜索素材 */
/** 搜索素材 */
const searchAssets = async () => {
    isLoading.value = true;
    searchError.value = "";
    try {
        const params: SearchAssetMetaParams = {
            ...currentFilters.value,
            keyword: searchKey.value,
        };

        const result = await 搜索素材元数据(params);

        if (!result || !Array.isArray(result.assets)) {
            throw new Error("素材检索响应缺少 assets 数组");
        }
        assets.value = result.assets.map(meta => ({
            path: meta.path,
            hName: meta.name || pathPosix().basename(meta.path),
            thumbnailUrl: getAssetThumbnailUrl(meta.path),
        }));
    } catch (error) {
        console.error("搜索素材失败:", error);
        searchError.value = error instanceof Error ? error.message : String(error);
    } finally {
        isLoading.value = false;
    }
};

/** 防抖搜索 */
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSearch = () => {
    if (searchTimeout) {
clearTimeout(searchTimeout);
}
    searchTimeout = setTimeout(searchAssets, 300);
};

/** 处理搜索（组合输入结束） */
const handleSearch = () => {
    searchAssets();
};

/** 选择素材 */
const handleSelect = (item: AssetItem) => {
    selectedAsset.value = item;

    // 双击或单击后插入
    if (props.onSelect) {
        props.onSelect(item.path, item.hName);
    } else {
        emit("select", item.path, item.hName);
    }
};

/** 显示类型过滤菜单 */
const showTypeFilter = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const menu = getSiyuanGlobalMenus().menu;
    menu.remove();
    const updateType = (label: string, exts?: string[]) => {
        currentFilters.value.exts = exts;
        handleSearch();
    };

    menu.addItem({
        label: i18n.value.all || "全部",
        click: () => updateType(i18n.value.all || "全部")
    });
    menu.addItem({
        label: i18n.value.image || "图片",
        click: () => updateType(i18n.value.image || "图片", ASSET_IMAGE_EXTENSIONS.map(ext => `.${ext}`))
    });
    menu.addItem({
        label: "音视频",
        click: () => updateType("音视频", [".mp3", ".wav", ".ogg", ".mp4", ".webm", ".mov"])
    });
    menu.addItem({
        label: i18n.value.doc || "文档",
        click: () => updateType(i18n.value.doc || "文档", [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"])
    });

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    menu.popup({ x: rect.left, y: rect.bottom, isLeft: true });
};

/** 显示尺寸过滤菜单 */
const showSizeFilter = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const menu = getSiyuanGlobalMenus().menu;
    menu.remove();
    const updateSize = (min?: number, max?: number) => {
        currentFilters.value.minSize = min;
        currentFilters.value.maxSize = max;
        handleSearch();
    };

    menu.addItem({ label: "全部", click: () => updateSize() });
    menu.addItem({ label: "< 1MB", click: () => updateSize(undefined, 1024 * 1024) });
    menu.addItem({ label: "1MB - 10MB", click: () => updateSize(1024 * 1024, 10 * 1024 * 1024) });
    menu.addItem({ label: "> 10MB", click: () => updateSize(10 * 1024 * 1024) });

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    menu.popup({ x: rect.left, y: rect.bottom, isLeft: true });
};

/** 显示评分过滤菜单 */
const showRatingFilter = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const menu = getSiyuanGlobalMenus().menu;
    menu.remove();
    const updateRating = (min?: number) => {
        currentFilters.value.minStar = min;
        handleSearch();
    };

    menu.addItem({ label: "全部", click: () => updateRating() });
    menu.addItem({ label: "★★★★★", click: () => updateRating(5) });
    menu.addItem({ label: "≥ ★★★★", click: () => updateRating(4) });
    menu.addItem({ label: "≥ ★★★", click: () => updateRating(3) });

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    menu.popup({ x: rect.left, y: rect.bottom, isLeft: true });
};

// 初始化
onMounted(() => {
    searchAssets();
    searchInputRef.value?.focus();
});
</script>
