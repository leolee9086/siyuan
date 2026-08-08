<template>
    <div class="asset-card" :class="{ 'asset-card--selected': isSelected }" @click="handleClick">
        <div class="asset-card__image" :class="{'asset-card__image--loading': isImage && !imageLoaded}">
            <img v-if="isImage" :src="imageSource" :alt="item.hName" loading="lazy"
                :class="{'asset-card__image-placeholder': imageError}" @load="onImageLoad" @error="onImageError" />
            <div v-if="isImage && imageError" class="asset-card__image-fallback" role="img" aria-label="图片预览不可用">
                <svg aria-hidden="true"><use href="#iconImage" /></svg>
            </div>
            <div v-if="!isImage" class="asset-card__icon">
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
import { computed, ref, watch } from "vue";
import { isAssetImage, getAssetThumbnailUrl, getAssetIconHref } from "./AssetCard.utils";
import type { AssetItem } from "./AssetCard.types";
import { EMPTY_IMAGE_DATA_URL, resolveAssetURL } from "../assetUrl";

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
const imageLoaded = ref(false);

const isImage = computed(() => isAssetImage(props.item.path));
const thumbnailUrl = computed(() => resolveAssetURL(props.item.thumbnailUrl ?? getAssetThumbnailUrl(props.item.path)));
const imageSource = computed(() => imageError.value ? EMPTY_IMAGE_DATA_URL : thumbnailUrl.value);
const iconHref = computed(() => getAssetIconHref(props.item.path));

watch(thumbnailUrl, () => {
    imageError.value = false;
    imageLoaded.value = false;
});

/** 图片加载完成 */
const onImageLoad = (e: Event) => {
    if (!(e.target instanceof HTMLImageElement)) {
        return;
    }
    const img = e.target;
    imageHeight.value = img.naturalHeight;
    imageLoaded.value = true;
    emit("heightChange", img.offsetHeight);
};

/** 图片加载失败 */
const onImageError = () => {
    imageError.value = true;
    imageLoaded.value = false;
};

/** 点击卡片 */
const handleClick = () => {
    emit("select", props.item);
};
</script>
