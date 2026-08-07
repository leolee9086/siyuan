<template>
    <section class="sforge-file-properties" aria-label="文件属性" :aria-busy="loading || saving">
        <header class="block__icons sforge-file-properties__header">
            <div class="block__logo">
                <svg class="block__logoicon"><use href="#iconInfo" /></svg>
                <span>文件属性</span>
            </div>
            <span class="fn__flex-1" />
            <button type="button" class="block__icon ariaLabel" aria-label="刷新文件属性"
                :disabled="loading || selectionItems.length === 0" @click="refresh">
                <svg :class="{'fn__rotate': loading}"><use href="#iconRefresh" /></svg>
            </button>
            <button type="button" class="block__icon ariaLabel" aria-label="清除选择"
                :disabled="selectionItems.length === 0" @click="clearSelection">
                <svg><use href="#iconClose" /></svg>
            </button>
        </header>

        <main class="sforge-file-properties__content">
            <div v-if="loading && items.length === 0" class="sforge-file-properties__state">
                <svg class="fn__rotate"><use href="#iconRefresh" /></svg>
                <span>正在读取</span>
            </div>
            <div v-else-if="loadError" class="sforge-file-properties__state sforge-file-properties__state--error">
                <span>{{ loadError }}</span>
                <button type="button" class="b3-button b3-button--text" @click="refresh">重试</button>
            </div>
            <div v-else-if="selectionItems.length === 0" class="sforge-file-properties__state">
                <svg><use href="#iconInfo" /></svg>
                <span>未选择文件或目录</span>
            </div>
            <template v-else>
                <section class="sforge-file-properties__preview" aria-label="预览" @wheel="handlePreviewWheel">
                    <button v-if="imageItems.length > 1" type="button" class="block__icon ariaLabel"
                        aria-label="上一张" @click="showPreviousImage">
                        <svg><use href="#iconLeft" /></svg>
                    </button>
                    <div class="sforge-file-properties__preview-frame">
                        <img v-if="currentImage" :src="currentImage.properties?.contentURL" :alt="currentImage.properties?.entry.name">
                        <svg v-else class="sforge-file-properties__file-icon"><use href="#iconFile" /></svg>
                    </div>
                    <button v-if="imageItems.length > 1" type="button" class="block__icon ariaLabel"
                        aria-label="下一张" @click="showNextImage">
                        <svg><use href="#iconRight" /></svg>
                    </button>
                    <span v-if="imageItems.length > 1" class="sforge-file-properties__counter">
                        {{ imageIndex + 1 }}/{{ imageItems.length }}
                    </span>
                </section>

                <section class="sforge-file-properties__identity">
                    <strong :title="identityTitle">{{ nameLabel }}</strong>
                    <span>{{ formatLabel }} · {{ selectionItems.length }} 项</span>
                </section>

                <section class="sforge-file-properties__section">
                    <label class="sforge-file-properties__label" for="sforge-file-properties-annotation">注释</label>
                    <textarea id="sforge-file-properties-annotation" v-model="annotationDraft" rows="3"
                        :placeholder="annotation.mixed ? '多项注释不同' : '添加注释'" @blur="saveAnnotation" />
                </section>

                <FilePropertiesTagSection :aggregate-tags="aggregateTags" :file-tags="fileTags"
                    :mode="tagViewMode" :loading="tagDefinitionsLoading" :saving="saving"
                    :error="tagDefinitionsError" @update:mode="updateTagViewMode"
                    @add="addTag" @remove="removeTag" @color="setTagColor" />

                <section class="sforge-file-properties__section">
                    <div class="sforge-file-properties__label">评分</div>
                    <div class="sforge-file-properties__rating" role="radiogroup" aria-label="评分">
                        <button v-for="value in 5" :key="value" type="button" class="ariaLabel"
                            :class="{'sforge-file-properties__rating--active': star !== undefined && star >= value}"
                            :aria-label="`${value} 星`" :aria-checked="star !== undefined && star >= value" role="radio"
                            @click="setStar(value)">
                            <svg><use href="#iconStar" /></svg>
                        </button>
                        <button type="button" class="block__icon ariaLabel" aria-label="清除评分" @click="setStar(0)">
                            <svg><use href="#iconCloseRound" /></svg>
                        </button>
                    </div>
                </section>

                <dl class="sforge-file-properties__facts">
                    <div><dt>所在目录</dt><dd :title="folderTitle">{{ folderLabel }}</dd></div>
                    <div><dt>格式</dt><dd>{{ formatLabel }}</dd></div>
                    <div><dt>尺寸</dt><dd>{{ dimensionsLabel }}</dd></div>
                    <div><dt>文件大小</dt><dd>{{ sizeLabel }}</dd></div>
                    <div><dt>修改日期</dt><dd>{{ updatedLabel }}</dd></div>
                    <div><dt>创建日期</dt><dd>{{ createdLabel }}</dd></div>
                </dl>

                <p v-if="saveError" class="sforge-file-properties__error">{{ saveError }}</p>
                <p v-if="metadataError" class="sforge-file-properties__error">{{ metadataError }}</p>
            </template>
        </main>
    </section>
</template>

<script setup lang="ts">
/** 用途：生命周期、派生值和轮播状态；使用范围：属性 Dock。 */
import {computed, onBeforeUnmount, onMounted, ref, watch} from "vue";
/** 用途：共享属性读取/编辑控制器；使用范围：本组件唯一业务入口。 */
import {useFileProperties} from "./useFileProperties";
/** 用途：应用级选择清理；使用范围：清除按钮。 */
import {fileBrowserSelection} from "./FileBrowser.selection";
/** 用途：声明式标签子面板；使用范围：标签模式、逐文件动作和颜色。 */
import FilePropertiesTagSection from "./FilePropertiesTagSection.vue";
/** 用途：属性记录类型；使用范围：图片和聚合派生。 */
import type {FilePropertiesItem, FilePropertiesRepository} from "./FileProperties.types";
/** 用途：共享选择注入边界；使用范围：生产面板和交互测试。 */
import type {FileBrowserSelectionStore} from "./FileBrowser.types";
/** 用途：标签定义仓储注入边界；使用范围：生产面板和交互测试。 */
import type {FileTagDefinitionsRepository, FileTagViewMode} from "./FileTags.types";

const props = defineProps<{
    repository?: FilePropertiesRepository;
    selection?: FileBrowserSelectionStore;
    tagRepository?: FileTagDefinitionsRepository;
}>();
const controller = useFileProperties(props.repository, props.selection, props.tagRepository);
const {
    items, loading, loadError, saving, saveError, availableItems, aggregateTags, fileTags, star, annotation,
    tagDefinitionsLoading, tagDefinitionsError, tagViewMode, selectionItems, refresh, applyPatch,
    addTag, removeTag, refreshTagDefinitions, setTagColor, dispose,
} = controller;
const imageIndex = ref(0);
const annotationDraft = ref("");

const imageItems = computed(() => availableItems.value.filter(item => item.properties?.previewKind === "image"));
const currentImage = computed(() => imageItems.value[imageIndex.value] ?? imageItems.value[0]);
const nameLabel = computed(() => {
    const names = availableItems.value.map(item => item.properties?.entry.name).filter((name): name is string => Boolean(name));
    if (names.length === 0) {
        return "无选择";
    }
    return names.length <= 3 ? names.join(", ") : `${names[0]} 等 ${names.length} 个文件`;
});
const formatLabel = computed(() => {
    const formats = new Set(availableItems.value.map(item => item.properties?.entry.extension?.toUpperCase()).filter(Boolean));
    return formats.size === 1 ? [...formats][0] : formats.size > 1 ? "多种" : "目录";
});
const folderValues = computed(() => availableItems.value.map(item => {
    const properties = item.properties;
    if (!properties) {
        return "";
    }
    const path = properties.entry.path.replace(/\\/g, "/");
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    return `${properties.root.label}${parent ? ` / ${parent}` : ""}`;
}).filter(Boolean));
const folderLabel = computed(() => {
    const values = [...new Set(folderValues.value)];
    return values.length === 1 ? values[0] : values.length > 1 ? `多个目录 (${values.length})` : "无选择";
});
const folderTitle = computed(() => availableItems.value.map(item => item.properties?.root.path).filter(Boolean).join("\n"));
const identityTitle = computed(() => availableItems.value.map(item => `${item.properties?.root.path ?? ""}\n${item.properties?.entry.path ?? ""}`).join("\n"));
const dimensionsLabel = computed(() => {
    const values = new Set(availableItems.value.map(item => {
        const width = item.properties?.width ?? 0;
        const height = item.properties?.height ?? 0;
        return width > 0 && height > 0 ? `${width} × ${height}` : "";
    }).filter(Boolean));
    return values.size === 1 ? [...values][0] : values.size > 1 ? "多种" : "无";
});
const sizeLabel = computed(() => {
    const values = availableItems.value.map(item => item.properties?.entry.size ?? 0);
    if (values.length === 0) {
        return "无";
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    return values.length > 1 ? `${formatBytes(total)}（合计）` : formatBytes(total);
});
const updatedLabel = computed(() => formatDateAggregate(item => item.properties?.entry.updated));
const createdLabel = computed(() => formatDateAggregate(item => item.properties?.created));
const metadataError = computed(() => items.value.find(item => item.metadataError)?.metadataError?.message ?? "");

function formatBytes(value: number) {
    if (value < 1024) {
        return `${value} B`;
    }
    const units = ["KB", "MB", "GB", "TB"];
    let size = value;
    let unit = "B";
    for (const next of units) {
        if (size < 1024) {
            break;
        }
        size /= 1024;
        unit = next;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

function formatDateAggregate(getter: (item: FilePropertiesItem) => number | undefined) {
    const values = new Set(availableItems.value.map(item => getter(item)).filter((value): value is number => Boolean(value)));
    if (values.size === 0) {
        return "无";
    }
    if (values.size > 1) {
        return "多种";
    }
    const timestamp = values.values().next().value;
    return timestamp === undefined ? "无" : new Date(timestamp * 1000).toLocaleString();
}

function showPreviousImage() {
    imageIndex.value = imageItems.value.length === 0 ? 0 : (imageIndex.value - 1 + imageItems.value.length) % imageItems.value.length;
}

function showNextImage() {
    imageIndex.value = imageItems.value.length === 0 ? 0 : (imageIndex.value + 1) % imageItems.value.length;
}

function setStar(value: number) {
    void applyPatch({star: value});
}

function saveAnnotation() {
    if (annotationDraft.value !== annotation.value.value || annotation.value.mixed) {
        void applyPatch({annotation: annotationDraft.value});
    }
}

function handlePreviewWheel(event: WheelEvent) {
    if (imageItems.value.length <= 1 || event.deltaY === 0) {
        return;
    }
    event.preventDefault();
    if (event.deltaY > 0) {
        showNextImage();
        return;
    }
    showPreviousImage();
}

function updateTagViewMode(mode: FileTagViewMode) {
    tagViewMode.value = mode;
}

function clearSelection() {
    fileBrowserSelection.clear();
}

watch(() => annotation.value, value => {
    if (!value.mixed) {
        annotationDraft.value = value.value;
    }
}, {immediate: true});
watch(() => selectionItems.value.map(item => item.key).join("\n"), () => {
    imageIndex.value = 0;
});
onMounted(() => void refreshTagDefinitions());
onBeforeUnmount(dispose);
</script>

<style scoped lang="scss" src="./FilePropertiesPanel.scss"></style>
