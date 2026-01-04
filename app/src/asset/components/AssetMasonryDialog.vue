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
                <div v-else class="asset-masonry-dialog__empty">
                    {{ i18n.emptyContent || '暂无内容' }}
                </div>
            </div>
        </div>

        <!-- 右侧：预览面板（仅桌面端） -->
        <div v-if="!isMobileDevice" class="asset-masonry-dialog__preview">
            <div class="asset-masonry-dialog__preview-image">
                <img v-if="selectedAsset && isImageAsset(selectedAsset)" :src="getAssetUrl(selectedAsset.path)"
                    :alt="selectedAsset.hName" />
                <div v-else-if="selectedAsset" class="asset-masonry-dialog__preview-icon">
                    <svg style="width: 64px; height: 64px;">
                        <use xlink:href="#iconFile"></use>
                    </svg>
                </div>
                <div v-else class="asset-masonry-dialog__preview-placeholder">
                    选择一个素材预览
                </div>
            </div>
            <div v-if="selectedAsset" class="asset-masonry-dialog__preview-info">
                <div class="asset-masonry-dialog__preview-name">{{ selectedAsset.hName }}</div>
                <div v-if="assetMeta" class="asset-masonry-dialog__preview-meta">
                    <div v-if="assetMeta.width && assetMeta.height">
                        尺寸: {{ assetMeta.width }} × {{ assetMeta.height }}
                    </div>
                    <div v-if="assetMeta.fileSize">
                        大小: {{ formatFileSize(assetMeta.fileSize) }}
                    </div>
                    <div v-if="assetMeta.star > 0">
                        评分: {{ '★'.repeat(assetMeta.star) }}
                    </div>
                    <div v-if="assetMeta.palettes?.length" class="asset-masonry-dialog__palette">
                        <div v-for="(palette, idx) in assetMeta.palettes" :key="idx"
                            class="asset-masonry-dialog__palette-item"
                            :style="{ background: `rgb(${palette.color[0]}, ${palette.color[1]}, ${palette.color[2]})` }">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import VirtualMasonryGrid from '../../components/masonry/components/VirtualMasonryGrid.vue';
import AssetCard from './AssetCard.vue';

interface AssetItem {
    hName: string;
    path: string;
}

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
    (e: 'select', url: string, name: string): void;
    (e: 'cancel'): void;
}>();

// 状态
const searchKey = ref('');
const assets = ref<AssetItem[]>([]);
const selectedAsset = ref<AssetItem | null>(null);
const assetMeta = ref<AssetMeta | null>(null);
const isLoading = ref(true);
const currentExts = ref<string[]>([]);
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
    const ext = item.path.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
        return Math.round(colWidth * 0.75); // 4:3 比例
    }
    return 120; // 非图片固定高度
};

/** 判断是否为图片类型 */
const isImageAsset = (item: AssetItem) => {
    const ext = item.path.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
};

/** 获取素材 URL */
const getAssetUrl = (path: string) => {
    return path.startsWith('assets/') ? `/${path}` : path;
};

/** 格式化文件大小 */
const formatFileSize = (bytes: number) => {
    const kb = bytes / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
};

/** 搜索素材 */
const searchAssets = async () => {
    isLoading.value = true;
    try {
        const response = await fetch('/api/search/searchAsset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                k: searchKey.value,
                exts: currentExts.value
            })
        });
        const result = await response.json();
        assets.value = result.data || [];
    } catch (error) {
        console.error('搜索素材失败:', error);
        assets.value = [];
    } finally {
        isLoading.value = false;
    }
};

/** 防抖搜索 */
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSearch = () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(searchAssets, 300);
};

/** 处理搜索（组合输入结束） */
const handleSearch = () => {
    searchAssets();
};

/** 选择素材 */
const handleSelect = (item: AssetItem) => {
    selectedAsset.value = item;
    loadAssetMeta(item.path);

    // 双击或单击后插入
    if (props.onSelect) {
        props.onSelect(item.path, item.hName);
    } else {
        emit('select', item.path, item.hName);
    }
};

/** 加载素材元数据 */
const loadAssetMeta = async (path: string) => {
    try {
        const response = await fetch('/api/s-forge/asset-meta/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        const result = await response.json();
        if (result.code === 0 && result.data) {
            assetMeta.value = result.data;
        } else {
            assetMeta.value = null;
        }
    } catch (error) {
        console.error('加载素材元数据失败:', error);
        assetMeta.value = null;
    }
};

/** 显示类型过滤菜单 */
const showTypeFilter = (e: MouseEvent) => {
    // TODO: 使用 Menu 组件显示过滤选项
    console.log('显示类型过滤菜单');
};

/** 显示尺寸过滤菜单 */
const showSizeFilter = (e: MouseEvent) => {
    console.log('显示尺寸过滤菜单');
};

/** 显示评分过滤菜单 */
const showRatingFilter = (e: MouseEvent) => {
    console.log('显示评分过滤菜单');
};

// 初始化
onMounted(() => {
    searchAssets();
    searchInputRef.value?.focus();
});
</script>

<style lang="scss" scoped>
.asset-masonry-dialog {
    display: flex;
    height: 100%;
    gap: 0;
}

.asset-masonry-dialog__left {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
}

.asset-masonry-dialog__search {
    padding: 8px;
    display: flex;
    gap: 8px;
}

.asset-masonry-dialog__filters {
    padding: 0 8px 8px 8px;
    display: flex;
    gap: 4px;
}

.asset-masonry-dialog__grid {
    flex: 1;
    overflow: hidden;
    position: relative;
}

.asset-masonry-dialog__loading,
.asset-masonry-dialog__empty {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: var(--b3-theme-on-surface-light);
}

.asset-masonry-dialog__preview {
    width: 300px;
    border-left: 1px solid var(--b3-border-color);
    display: flex;
    flex-direction: column;
    padding: 8px;
    overflow: auto;
}

.asset-masonry-dialog__preview-image {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
}

.asset-masonry-dialog__preview-image img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
}

.asset-masonry-dialog__preview-icon,
.asset-masonry-dialog__preview-placeholder {
    color: var(--b3-theme-on-surface-light);
    text-align: center;
}

.asset-masonry-dialog__preview-info {
    padding-top: 8px;
    border-top: 1px solid var(--b3-border-color);
    margin-top: 8px;
}

.asset-masonry-dialog__preview-name {
    font-weight: 500;
    word-break: break-all;
    margin-bottom: 8px;
}

.asset-masonry-dialog__preview-meta {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.asset-masonry-dialog__palette {
    display: flex;
    gap: 2px;
    flex-wrap: wrap;
    margin-top: 4px;
}

.asset-masonry-dialog__palette-item {
    width: 24px;
    height: 24px;
    border-radius: 2px;
}
</style>
