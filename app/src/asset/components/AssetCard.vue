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
import { computed, ref } from "vue";
import { isAssetImage, getAssetThumbnailUrl, getAssetIconHref } from "./AssetCard.utils";
import type { AssetItem } from "./AssetCard.types";

const props = defineProps<{
    item: AssetItem;
    isSelected?: boolean;
}>();

const emit = defineEmits<{
    (e: "select", item: AssetItem): void;
    (e: "heightChange", height: number): void;
}>();

const imageHeight = ref(0);
const imageError = ref(false);

const isImage = computed(() => isAssetImage(props.item.path));
const thumbnailUrl = computed(() => props.item.thumbnailUrl ?? getAssetThumbnailUrl(props.item.path));
const iconHref = computed(() => getAssetIconHref(props.item.path));

/** 图片加载完成 */
const onImageLoad = (e: Event) => {
    if (!(e.target instanceof HTMLImageElement)) {
        return;
    }
    const img = e.target;
    imageHeight.value = img.naturalHeight;
    emit("heightChange", img.offsetHeight);
};

/** 图片加载失败 */
const onImageError = () => {
    imageError.value = true;
};

/** 点击卡片 */
const handleClick = () => {
    emit("select", props.item);
};
</script>
