<template>
    <div class="asset-card" :class="{ 'asset-card--selected': isSelected }" @click="handleClick">
        <div class="asset-card__image">
            <img v-if="isImage && !thumbnailError && !imageError" :src="thumbnailUrl" :alt="item.hName" loading="lazy"
                @load="onImageLoad" @error="onImageError" />
            <div v-else-if="isImage" class="asset-card__image-error" role="alert">
                {{ thumbnailError || imageError || "缩略图加载失败" }}
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
import {getAssetIconHref, isAssetThumbnail} from "./AssetCard.utils";
import type { AssetItem } from "./AssetCard.types";
import { resolveAssetURL } from "../assetUrl";

const props = defineProps<{
    item: AssetItem;
    isSelected?: boolean;
}>();

const emit = defineEmits<{
    (e: "select", item: AssetItem): void;
    (e: "heightChange", height: number): void;
}>();

const imageHeight = ref(0);
const imageError = ref("");
const thumbnailUrl = ref("");
const thumbnailError = ref("");

const isImage = computed(() => isAssetThumbnail(props.item.path));
const iconHref = computed(() => getAssetIconHref(props.item.path));

function resolveThumbnailUrl(value: string | undefined) {
    thumbnailError.value = "";
    imageError.value = "";
    try {
        if (!value?.trim()) {
            throw new Error("缩略图地址为空");
        }
        thumbnailUrl.value = resolveAssetURL(value);
    } catch (error) {
        thumbnailUrl.value = "";
        thumbnailError.value = error instanceof Error ? error.message : String(error);
    }
}

watch(() => props.item.thumbnailUrl, resolveThumbnailUrl, {immediate: true});
watch(() => props.item.path, () => {
    imageError.value = "";
});

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
    imageError.value = "缩略图加载失败";
};

/** 点击卡片 */
const handleClick = () => {
    emit("select", props.item);
};
</script>
