<template>
    <article class="sforge-file-gallery-card" :class="{'sforge-file-gallery-card--selected': selected}"
        :data-file-key="assetKey" :data-gallery-index="index" :aria-selected="selected" tabindex="0"
        draggable="true" @click.stop="handleSelect" @keydown.stop="handleKeydown"
        @dragstart.stop="handleDragStart" @dblclick.stop="emit('open', asset)"
        @contextmenu.stop.prevent="emit('menu', asset, $event)">
        <AssetCard :item="cardItem" :is-selected="selected" />
        <div class="sforge-file-gallery-card__meta">
            <span v-if="showPath" class="sforge-file-gallery-card__path" :title="asset.path">{{ assetName }}</span>
            <dl v-if="displayAttributes.length > 0" class="sforge-file-gallery-card__attributes">
                <template v-for="attribute in displayAttributes" :key="attribute">
                    <dt>{{ getFileBrowserGalleryAttributeLabel(attribute) }}</dt>
                    <dd :title="getFileBrowserGalleryAttributeValue(asset, attribute)">
                        {{ getFileBrowserGalleryAttributeValue(asset, attribute) || "-" }}
                    </dd>
                </template>
            </dl>
            <span v-if="asset.tags.length > 0" class="sforge-file-gallery-card__tags">
                <span v-for="tag in asset.tags.slice(0, 4)" :key="tag" class="b3-chip b3-chip--middle">{{ tag }}</span>
            </span>
            <span v-if="asset.palettes?.length || asset.star > 0" class="sforge-file-gallery-card__signals">
                <span v-if="asset.palettes?.length" class="sforge-file-gallery-card__palette" aria-label="调色板">
                    <span v-for="(palette, index) in asset.palettes.slice(0, 5)" :key="index"
                        class="sforge-file-gallery-card__swatch" :style="{backgroundColor: rgb(palette.color)}"
                        :title="rgb(palette.color)" />
                </span>
                <span v-if="asset.star > 0" class="sforge-file-gallery-card__star" :aria-label="`${asset.star} 星`">
                    {{ "★".repeat(asset.star) }}
                </span>
            </span>
        </div>
    </article>
</template>

<script setup lang="ts">
import {computed} from "vue";
import AssetCard from "../../asset/components/AssetCard.vue";
import {getFileBrowserGalleryAttributeLabel, getFileBrowserGalleryAttributeValue} from "./FileBrowser.gallery.presentation";
import {FILE_BROWSER_GALLERY_DEFAULT_ATTRIBUTES} from "./FileBrowser.gallery.constants";
import type {AssetItem} from "../../asset/components/AssetCard.types";
import type {FileBrowserGalleryAttribute} from "./FileBrowser.gallery.constants";
import type {FileBrowserAssetResult} from "./FileBrowser.query.types";
import {FILE_BROWSER_DRAG_MIME} from "./FileBrowser.drag";
import type {FileBrowserDragItem} from "./FileBrowser.types";

const props = defineProps<{
    asset: FileBrowserAssetResult;
    thumbnailUrl: string;
    selected?: boolean;
    index?: number;
    dragItems?: readonly FileBrowserDragItem[];
    showPath?: boolean;
    displayAttributes?: readonly FileBrowserGalleryAttribute[];
}>();

const emit = defineEmits<{
    select: [asset: FileBrowserAssetResult];
    "select-with-event": [asset: FileBrowserAssetResult, event: MouseEvent];
    open: [asset: FileBrowserAssetResult];
    menu: [asset: FileBrowserAssetResult, event: MouseEvent];
    keydown: [asset: FileBrowserAssetResult, event: KeyboardEvent];
}>();

const assetName = computed(() => props.asset.name || props.asset.path.split("/").at(-1) || props.asset.path);
const displayAttributes = computed(() => props.displayAttributes ?? FILE_BROWSER_GALLERY_DEFAULT_ATTRIBUTES);
const showPath = computed(() => props.showPath !== false);
const assetKey = computed(() => JSON.stringify([props.asset.rootID, props.asset.path]));
const cardItem = computed<AssetItem>(() => ({
    hName: assetName.value,
    path: props.asset.path,
    thumbnailUrl: props.thumbnailUrl,
}));

function rgb(color: [number, number, number]) {
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
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

function handleSelect(event: MouseEvent) {
    if (event.button === 0) {
        emit("select", props.asset);
        emit("select-with-event", props.asset, event);
    }
}

function handleKeydown(event: KeyboardEvent) {
    emit("keydown", props.asset, event);
}
</script>

<style scoped lang="scss">
.sforge-file-gallery-card {
    display: flex;
    height: 100%;
    min-width: 0;
    flex-direction: column;
    border: 1px solid transparent;
}

.sforge-file-gallery-card--selected {
    border-color: var(--b3-theme-primary);
}

.sforge-file-gallery-card :deep(.asset-card) {
    flex: none;
}

.sforge-file-gallery-card__meta {
    display: flex;
    min-width: 0;
    padding: 5px 7px 7px;
    flex-direction: column;
    gap: 4px;
    background: var(--b3-theme-background-light);
}

.sforge-file-gallery-card__path {
    overflow: hidden;
    color: var(--b3-theme-on-background);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sforge-file-gallery-card__attributes {
    display: grid;
    min-width: 0;
    margin: 0;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 6px;
    row-gap: 2px;
    font-size: 10px;
}

.sforge-file-gallery-card__attributes dt {
    color: var(--b3-theme-on-surface);
}

.sforge-file-gallery-card__attributes dd {
    overflow: hidden;
    margin: 0;
    color: var(--b3-theme-on-background);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sforge-file-gallery-card__tags {
    display: flex;
    overflow: hidden;
    flex-wrap: wrap;
    gap: 3px;
}

.sforge-file-gallery-card__tags .b3-chip {
    max-width: 100%;
    min-height: 18px;
    overflow: hidden;
    padding: 1px 4px;
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sforge-file-gallery-card__signals {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
}

.sforge-file-gallery-card__palette {
    display: flex;
    gap: 2px;
}

.sforge-file-gallery-card__swatch {
    width: 12px;
    height: 12px;
    border: 1px solid var(--b3-border-color);
    border-radius: 2px;
}

.sforge-file-gallery-card__star {
    color: var(--b3-theme-warning);
    font-size: 11px;
    white-space: nowrap;
}
</style>
