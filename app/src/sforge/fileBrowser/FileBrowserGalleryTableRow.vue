<template>
    <article class="sforge-file-gallery-table-row" :class="{'sforge-file-gallery-table-row--selected': selected}"
        role="row" tabindex="0" @click="emit('select', asset)" @dblclick.stop="emit('open', asset)"
        @keydown.enter.stop="emit('open', asset)">
        <div class="sforge-file-gallery-table-row__preview" role="cell">
            <img v-if="isImage && !imageError" :src="thumbnailUrl" :alt="assetName" loading="lazy"
                @error="imageError = true" />
            <svg v-else-if="isImage" aria-hidden="true"><use href="#iconImage" /></svg>
            <svg v-else aria-hidden="true"><use :href="iconHref" /></svg>
        </div>
        <span class="sforge-file-gallery-table-row__name" role="cell" :title="assetName">{{ assetName }}</span>
        <span class="sforge-file-gallery-table-row__path" role="cell" :title="asset.path">{{ asset.path }}</span>
        <span class="sforge-file-gallery-table-row__tags" role="cell">
            <span v-for="tag in asset.tags.slice(0, 3)" :key="tag" class="b3-chip b3-chip--middle">{{ tag }}</span>
            <span v-if="asset.tags.length > 3" class="sforge-file-gallery-table-row__more">+{{ asset.tags.length - 3 }}</span>
        </span>
        <span class="sforge-file-gallery-table-row__value" role="cell">{{ dimensions }}</span>
        <span class="sforge-file-gallery-table-row__value" role="cell">{{ formatBytes(asset.fileSize) }}</span>
        <span class="sforge-file-gallery-table-row__value" role="cell">{{ extension }}</span>
    </article>
</template>

<script setup lang="ts">
import {computed, ref, watch} from "vue";
import {isAssetImage, getAssetIconHref} from "../../asset/components/AssetCard.utils";
import {resolveAssetURL} from "../../asset/assetUrl";
import type {FileBrowserAssetResult} from "./FileBrowser.query.types";

const props = defineProps<{
    asset: FileBrowserAssetResult;
    thumbnailUrl: string;
    selected?: boolean;
}>();

const emit = defineEmits<{
    select: [asset: FileBrowserAssetResult];
    open: [asset: FileBrowserAssetResult];
}>();

const assetName = computed(() => props.asset.name || props.asset.path.split("/").at(-1) || props.asset.path);
const isImage = computed(() => isAssetImage(props.asset.path));
const thumbnailUrl = computed(() => resolveAssetURL(props.thumbnailUrl));
const iconHref = computed(() => getAssetIconHref(props.asset.path));
const imageError = ref(false);

watch(thumbnailUrl, () => {
    imageError.value = false;
});
const dimensions = computed(() => props.asset.width > 0 && props.asset.height > 0 ?
    `${props.asset.width} x ${props.asset.height}` : "-");
const extension = computed(() => {
    const dot = props.asset.path.lastIndexOf(".");
    return dot >= 0 ? props.asset.path.slice(dot).toLowerCase() : "-";
});

function formatBytes(value: number) {
    if (!Number.isFinite(value) || value < 0) {
        return "-";
    }
    if (value < 1024) {
        return `${value} B`;
    }
    if (value < 1024 * 1024) {
        return `${Math.round(value / 1024)} KB`;
    }
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<style scoped lang="scss">
.sforge-file-gallery-table-row {
    display: grid;
    width: 100%;
    height: 56px;
    align-items: center;
    padding: 4px 8px;
    border-bottom: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    grid-template-columns: 48px minmax(130px, 1.2fr) minmax(150px, 2fr) minmax(120px, 1.2fr) 110px 90px 70px;
    gap: 8px;
    color: var(--b3-theme-on-background);
    cursor: pointer;
}

.sforge-file-gallery-table-row:hover,
.sforge-file-gallery-table-row:focus-visible,
.sforge-file-gallery-table-row--selected {
    background: var(--b3-list-hover);
    outline: none;
}

.sforge-file-gallery-table-row__preview {
    display: flex;
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 3px;
    background: var(--b3-theme-surface);
}

.sforge-file-gallery-table-row__preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.sforge-file-gallery-table-row__preview svg {
    width: 24px;
    height: 24px;
    fill: var(--b3-theme-on-surface);
}

.sforge-file-gallery-table-row__name,
.sforge-file-gallery-table-row__path,
.sforge-file-gallery-table-row__value {
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sforge-file-gallery-table-row__path,
.sforge-file-gallery-table-row__value {
    color: var(--b3-theme-on-surface);
    font-size: 11px;
}

.sforge-file-gallery-table-row__tags {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 3px;
    overflow: hidden;
}

.sforge-file-gallery-table-row__tags .b3-chip {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sforge-file-gallery-table-row__more {
    flex: none;
    color: var(--b3-theme-on-surface);
    font-size: 11px;
}

@media (max-width: 900px) {
    .sforge-file-gallery-table-row {
        grid-template-columns: 48px minmax(120px, 1fr) minmax(100px, 1.2fr) minmax(100px, 1fr) 80px;
    }

    .sforge-file-gallery-table-row__value:nth-last-child(-n + 2) {
        display: none;
    }
}
</style>
