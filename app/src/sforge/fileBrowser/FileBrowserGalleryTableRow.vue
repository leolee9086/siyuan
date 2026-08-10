<template>
    <article class="sforge-file-gallery-table-row" :class="{'sforge-file-gallery-table-row--selected': selected}"
        :data-file-key="assetKey" :data-gallery-index="index" :aria-selected="selected"
        role="row" tabindex="0" draggable="true" @click="handleSelect" @dblclick.stop="emit('open', asset)"
        @keydown.stop="handleKeydown" @dragstart.stop="handleDragStart"
        @contextmenu.stop.prevent="emit('menu', asset, $event)">
        <div class="sforge-file-gallery-table-row__preview" role="cell">
            <img v-if="isImage && !thumbnailError && !imageError" :src="thumbnailUrl" :alt="assetName" loading="lazy"
                @error="imageError = true" />
            <span v-else-if="isImage" class="sforge-file-gallery-table-row__image-error" role="alert">
                {{ thumbnailError || "缩略图加载失败" }}
            </span>
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
import {getAssetIconHref, isAssetThumbnail} from "../../asset/assetFormat";
import {resolveAssetURL} from "../../asset/assetUrl";
import type {FileBrowserAssetResult} from "./FileBrowser.query.types";
import {FILE_BROWSER_DRAG_MIME} from "./FileBrowser.drag";
import type {FileBrowserDragItem} from "./FileBrowser.types";

const props = defineProps<{
    asset: FileBrowserAssetResult;
    thumbnailUrl: string;
    selected?: boolean;
    index?: number;
    dragItems?: readonly FileBrowserDragItem[];
}>();

const emit = defineEmits<{
    select: [asset: FileBrowserAssetResult];
    "select-with-event": [asset: FileBrowserAssetResult, event: MouseEvent];
    open: [asset: FileBrowserAssetResult];
    menu: [asset: FileBrowserAssetResult, event: MouseEvent];
    keydown: [asset: FileBrowserAssetResult, event: KeyboardEvent];
}>();

const assetName = computed(() => props.asset.name || props.asset.path.split("/").at(-1) || props.asset.path);
const assetKey = computed(() => JSON.stringify([props.asset.rootID, props.asset.path]));
const isImage = computed(() => isAssetThumbnail(props.asset.path));
const thumbnailUrl = ref("");
const thumbnailError = ref("");
const iconHref = computed(() => getAssetIconHref(props.asset.path));
const imageError = ref(false);

function setThumbnailUrl(value: string) {
    thumbnailUrl.value = "";
    thumbnailError.value = "";
    imageError.value = false;
    try {
        if (!value.trim()) {
            throw new Error("缩略图地址为空");
        }
        thumbnailUrl.value = resolveAssetURL(value);
    } catch (reason) {
        thumbnailError.value = reason instanceof Error ? reason.message : String(reason);
    }
}

watch(() => props.thumbnailUrl, setThumbnailUrl, {immediate: true});
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

function handleSelect(event: MouseEvent) {
    if (event.button === 0) {
        emit("select", props.asset);
        emit("select-with-event", props.asset, event);
    }
}

function handleKeydown(event: KeyboardEvent) {
    emit("keydown", props.asset, event);
}

function handleDragStart(event: DragEvent) {
    if (!event.dataTransfer) {
        return;
    }
    event.dataTransfer.effectAllowed = "move";
    const item: FileBrowserDragItem = {
        rootID: props.asset.rootID, path: props.asset.path, kind: "file", name: assetName.value,
    };
    const items = props.dragItems && props.dragItems.length > 0 ? [...props.dragItems] : [item];
    const first = items.find(candidate => candidate.rootID === item.rootID && candidate.path === item.path) ?? items[0]!;
    event.dataTransfer.setData(FILE_BROWSER_DRAG_MIME, JSON.stringify(
        items.length > 1 ? {...first, items} : first,
    ));
    event.dataTransfer.setData("text/plain", props.asset.path);
}
</script>

<style scoped lang="scss">
.sforge-file-gallery-table-row {
    display: grid;
    width: 100%;
    height: 56px;
    box-sizing: border-box;
    align-items: center;
    padding: 4px 8px;
    border-bottom: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    grid-template-columns: var(--sforge-file-table-columns);
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

.sforge-file-gallery-table-row__image-error {
    padding: 4px;
    color: var(--b3-theme-error);
    font-size: 10px;
    line-height: 1.2;
    text-align: center;
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

@container file-gallery (max-width: 900px) {
    .sforge-file-gallery-table-row {
        grid-template-columns: var(--sforge-file-table-columns);
    }

    .sforge-file-gallery-table-row__value:nth-last-child(-n + 2) {
        display: none;
    }
}
</style>
