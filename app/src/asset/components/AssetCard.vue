<template>
    <div class="asset-card" :class="{ 'asset-card--selected': isSelected }" @click="handleClick">
        <div class="asset-card__image">
            <img v-if="isImage" :src="thumbnailUrl" :alt="item.hName" loading="lazy" @load="onImageLoad"
                @error="onImageError" />
            <div v-else class="asset-card__icon">
                <svg>
                    <use :xlink:href="iconHref"></use>
                </svg>
            </div>
        </div>
        <div class="asset-card__info" :title="item.hName">
            <span class="asset-card__name">{{ item.hName }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface AssetItem {
    hName: string;
    path: string;
}

const props = defineProps<{
    item: AssetItem;
    isSelected?: boolean;
}>();

const emit = defineEmits<{
    (e: 'select', item: AssetItem): void;
    (e: 'heightChange', height: number): void;
}>();

const imageHeight = ref(0);
const imageError = ref(false);

/** 是否为图片类型 */
const isImage = computed(() => {
    const ext = props.item.path.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
});

/** 缩略图 URL */
const thumbnailUrl = computed(() => {
    // 使用缩略图服务, 指定宽度为 360px 以适配瀑布流列宽
    return `/api/s-forge/thumbnail?path=${encodeURIComponent(props.item.path)}&size=360`;
});

/** 非图片类型的图标 */
const iconHref = computed(() => {
    const ext = props.item.path.split('.').pop()?.toLowerCase() || '';
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return '#iconVideo';
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return '#iconRecord';
    if (['pdf'].includes(ext)) return '#iconPDF';
    return '#iconFile';
});

/** 图片加载完成 */
const onImageLoad = (e: Event) => {
    const img = e.target as HTMLImageElement;
    imageHeight.value = img.naturalHeight;
    emit('heightChange', img.offsetHeight);
};

/** 图片加载失败 */
const onImageError = () => {
    imageError.value = true;
};

/** 点击卡片 */
const handleClick = () => {
    emit('select', props.item);
};
</script>

<style lang="scss" scoped>
.asset-card {
    position: relative;
    border-radius: 6px;
    overflow: hidden;
    background: var(--b3-theme-surface);
    cursor: pointer;
    border: 1px solid transparent;
    /* 预留边框位置避免抖动 */
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;

    /* 增加底部 padding 给文件名留空间 */
    display: flex;
    flex-direction: column;
}

.asset-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1;
}

.asset-card--selected {
    outline: 2px solid var(--b3-theme-primary);
}

.asset-card__image {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--b3-theme-background);
    min-height: 80px;
    /* 最小高度 */
}

.asset-card__image img {
    width: 100%;
    height: auto;
    display: block;
    object-fit: cover;
}

.asset-card__icon {
    width: 100%;
    height: 100px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.asset-card__icon svg {
    width: 48px;
    height: 48px;
    fill: var(--b3-theme-on-surface-light);
}

.asset-card__info {
    padding: 8px;
    background: var(--b3-theme-surface);
}

.asset-card__name {
    color: var(--b3-theme-on-surface);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    text-align: center;
    line-height: 1.4;
}
</style>
