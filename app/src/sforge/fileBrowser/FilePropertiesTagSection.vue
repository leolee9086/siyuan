<template>
    <section class="sforge-file-properties__section sforge-file-tags">
        <div class="sforge-file-tags__heading">
            <div class="sforge-file-tags__label">标签</div>
            <div class="sforge-file-tags__modes" role="group" aria-label="标签显示模式">
                <button type="button" class="block__icon ariaLabel"
                    :class="{'sforge-file-tags__mode--active': mode === 'aggregate'}"
                    aria-label="汇总标签" :aria-pressed="mode === 'aggregate'" @click="emit('update:mode', 'aggregate')">
                    <svg><use href="#iconList" /></svg>
                </button>
                <button type="button" class="block__icon ariaLabel"
                    :class="{'sforge-file-tags__mode--active': mode === 'per-file'}"
                    aria-label="逐文件标签" :aria-pressed="mode === 'per-file'" @click="emit('update:mode', 'per-file')">
                    <svg><use href="#iconListTree" /></svg>
                </button>
            </div>
        </div>
        <div v-if="loading" class="sforge-file-tags__status">
            <svg class="fn__rotate"><use href="#iconRefresh" /></svg>
            <span>正在读取标签颜色</span>
        </div>
        <template v-if="mode === 'aggregate'">
            <div v-if="aggregateTags.length > 0" class="b3-chips sforge-file-tags__chips">
                <span v-for="tag in aggregateTags" :key="tag.name" class="b3-chip b3-chip--middle"
                    :style="{backgroundColor: tag.color, color: tag.foreground}">
                    <span>{{ tag.name }} ({{ tag.count }})</span>
                    <input class="sforge-file-tags__color" type="color" :value="tag.color"
                        :aria-label="`设置标签 ${tag.name} 的颜色`" :disabled="loading" @click.stop
                        @change="updateColor(tag.name, $event)">
                    <button type="button" class="b3-chip__close ariaLabel" :aria-label="`移除标签 ${tag.name}`"
                        @click="emit('remove', tag.name)">
                        <svg><use href="#iconCloseRound" /></svg>
                    </button>
                </span>
            </div>
            <div v-else class="sforge-file-tags__status">未添加标签</div>
        </template>
        <template v-else>
            <div v-if="fileTags.length > 0" class="sforge-file-tags__files">
                <div v-for="file in fileTags" :key="fileTagKey(file.request)" class="sforge-file-tags__file">
                    <strong :title="file.request.path">{{ file.name }}</strong>
                    <div v-if="file.tags.length > 0" class="b3-chips sforge-file-tags__chips">
                        <span v-for="tag in file.tags" :key="tag.name" class="b3-chip b3-chip--middle"
                            :style="{backgroundColor: tag.color, color: tag.foreground}">
                            <span>{{ tag.name }}</span>
                            <input class="sforge-file-tags__color" type="color" :value="tag.color"
                                :aria-label="`设置标签 ${tag.name} 的颜色`" :disabled="loading" @click.stop
                                @change="updateColor(tag.name, $event)">
                            <button type="button" class="b3-chip__close ariaLabel"
                                :aria-label="`从 ${file.name} 移除标签 ${tag.name}`"
                                @click="emit('remove', tag.name, file.request)">
                                <svg><use href="#iconCloseRound" /></svg>
                            </button>
                        </span>
                    </div>
                    <div class="sforge-file-tags__input sforge-file-tags__input--file">
                        <input v-model="fileTagDrafts[fileTagKey(file.request)]" type="text"
                            :placeholder="`为 ${file.name} 添加标签`" @keydown.enter.prevent="addFileTag(file.request)">
                        <button type="button" class="block__icon ariaLabel" aria-label="为当前文件添加标签"
                            :disabled="!(fileTagDrafts[fileTagKey(file.request)] ?? '').trim() || saving"
                            @click="addFileTag(file.request)">
                            <svg><use href="#iconAdd" /></svg>
                        </button>
                    </div>
                </div>
            </div>
            <div v-else class="sforge-file-tags__status">没有可显示的文件标签</div>
        </template>
        <div class="sforge-file-tags__input">
            <input v-model="newTag" type="text" placeholder="为当前选择批量添加标签" @keydown.enter.prevent="addBatchTag">
            <button type="button" class="block__icon ariaLabel" aria-label="添加标签"
                :disabled="!newTag.trim() || saving" @click="addBatchTag">
                <svg><use href="#iconAdd" /></svg>
            </button>
        </div>
        <p v-if="error" class="sforge-file-properties__error">{{ error }}</p>
    </section>
</template>

<script setup lang="ts">
/** 用途：标签输入草稿和文件变化清理；使用范围：本组件本地 UI 状态。 */
import {reactive, ref, watch} from "vue";
/** 用途：稳定根内地址；使用范围：逐文件命令。 */
import type {FileBrowserFileRequest} from "./FileBrowser.types";
/** 用途：声明式标签展示模型；使用范围：组件参数和模式事件。 */
import type {FileTagFilePresentation, FileTagPresentation, FileTagViewMode} from "./FileTags.types";

const props = defineProps<{
    aggregateTags: FileTagPresentation[];
    fileTags: FileTagFilePresentation[];
    mode: FileTagViewMode;
    loading: boolean;
    saving: boolean;
    error: string;
}>();
const emit = defineEmits<{
    "update:mode": [mode: FileTagViewMode];
    add: [tag: string, request?: FileBrowserFileRequest];
    remove: [tag: string, request?: FileBrowserFileRequest];
    color: [name: string, color: string];
}>();
const newTag = ref("");
const fileTagDrafts = reactive<Record<string, string>>({});

function fileTagKey(request: FileBrowserFileRequest) {
    return JSON.stringify([request.rootID, request.path]);
}

function addBatchTag() {
    const tag = newTag.value.trim();
    if (tag) {
        newTag.value = "";
        emit("add", tag);
    }
}

function addFileTag(request: FileBrowserFileRequest) {
    const key = fileTagKey(request);
    const tag = fileTagDrafts[key]?.trim() ?? "";
    if (tag) {
        fileTagDrafts[key] = "";
        emit("add", tag, request);
    }
}

function updateColor(name: string, event: Event) {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
        emit("color", name, target.value);
    }
}

watch(() => props.fileTags.map(file => fileTagKey(file.request)).join("\n"), value => {
    const current = new Set(value.split("\n").filter(Boolean));
    for (const key of Object.keys(fileTagDrafts)) {
        if (!current.has(key)) {
            delete fileTagDrafts[key];
        }
    }
});
</script>

<style scoped lang="scss" src="./FilePropertiesTagSection.scss"></style>
