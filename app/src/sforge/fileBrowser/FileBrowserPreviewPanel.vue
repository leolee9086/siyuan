<template>
    <section class="sforge-file-preview" :aria-busy="loading">
        <header class="sforge-file-preview__header">
            <svg class="sforge-file-preview__icon"><use :href="previewIcon" /></svg>
            <div class="sforge-file-preview__identity">
                <strong>{{ file.name }}</strong>
                <span :title="file.path">{{ file.path }}</span>
            </div>
            <a v-if="stat" class="block__icon block__icon--show ariaLabel" :href="contentURL"
                :download="file.name" aria-label="下载文件">
                <svg><use href="#iconDownload" /></svg>
            </a>
        </header>
        <div v-if="stat" class="sforge-file-preview__meta">
            <span>{{ stat.mediaType }}</span>
            <span>{{ describeFileBrowserEntry(stat.entry) }}</span>
            <span v-if="preview">{{ preview.encoding }}{{ preview.truncated ? " · 已截断" : "" }}</span>
        </div>
        <main class="sforge-file-preview__content">
            <div v-if="loading" class="sforge-file-preview__state">
                <svg class="fn__rotate"><use href="#iconRefresh" /></svg>
                <span>正在读取</span>
            </div>
            <div v-else-if="error" class="sforge-file-preview__state sforge-file-preview__state--error">
                <span>{{ error }}</span>
                <button type="button" class="b3-button b3-button--text" @click="loadPreview">重试</button>
            </div>
            <pre v-else-if="preview" class="sforge-file-preview__text">{{ preview.text }}</pre>
            <img v-else-if="stat?.previewKind === 'image' && !imageError" :src="contentURL" :alt="file.name"
                @error="imageError = true">
            <div v-else-if="stat?.previewKind === 'image'" class="sforge-file-preview__state">
                <svg><use href="#iconImage" /></svg>
                <span>图片预览不可用</span>
            </div>
            <audio v-else-if="stat?.previewKind === 'audio'" :src="contentURL" controls preload="metadata"></audio>
            <video v-else-if="stat?.previewKind === 'video'" :src="contentURL" controls preload="metadata"></video>
            <div v-else class="sforge-file-preview__state">
                <svg><use :href="previewIcon" /></svg>
                <span>{{ file.name }}</span>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
/** 用途：Vue 响应式状态和挂载生命周期；使用范围：只读预览加载。 */
import {computed, onMounted, ref} from "vue";
/** 用途：文件内容仓储；使用范围：统计和有界文本预览。 */
import {fileBrowserRepository} from "./FileBrowser.repository";
/** 用途：紧凑元数据展示；使用范围：预览页签头部。 */
import {describeFileBrowserEntry} from "./FileBrowser.presentation";
/** 用途：统一图片/媒体地址；使用范围：预览页签的内容和下载链接。 */
import {resolveAssetURL} from "../../asset/assetUrl";
/** 用途：预览页签参数和响应类型；使用范围：组件边界与状态。 */
import type {
    FileBrowserFileStat,
    FileBrowserPreviewPanelProps,
    FileBrowserTextPreview,
} from "./FileBrowser.types";

const props = defineProps<FileBrowserPreviewPanelProps>();
const stat = ref<FileBrowserFileStat | null>(null);
const preview = ref<FileBrowserTextPreview | null>(null);
const loading = ref(false);
const error = ref("");
const imageError = ref(false);
const previewIcon = computed(() => stat.value?.previewKind === "text" ? "#iconCode" : "#iconFile");
const contentURL = computed(() => stat.value ? resolveAssetURL(stat.value.contentURL) : "");

async function loadPreview() {
    loading.value = true;
    error.value = "";
    imageError.value = false;
    preview.value = null;
    try {
        const request = {rootID: props.file.rootID, path: props.file.path};
        stat.value = await fileBrowserRepository.statFile(request);
        if (stat.value.previewKind === "text") {
            preview.value = await fileBrowserRepository.previewText({...request, maxBytes: 256 * 1024});
        }
    } catch (reason) {
        error.value = reason instanceof Error ? reason.message : String(reason);
    } finally {
        loading.value = false;
    }
}

onMounted(() => void loadPreview());
</script>

<style scoped lang="scss" src="./FileBrowserPreviewPanel.scss"></style>
