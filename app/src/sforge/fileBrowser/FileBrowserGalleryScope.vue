<template>
    <section class="sforge-file-gallery-scope" aria-label="当前文件夹范围">
        <div class="sforge-file-gallery-scope__bar">
            <div class="sforge-file-gallery-scope__breadcrumbs" aria-label="文件夹路径">
                <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path || 'root'">
                    <svg v-if="index > 0" class="sforge-file-gallery-scope__arrow" aria-hidden="true">
                        <use href="#iconRight" />
                    </svg>
                    <button type="button" class="sforge-file-gallery-scope__crumb"
                        :class="{'sforge-file-gallery-scope__crumb--current': crumb.path === path}"
                        :aria-current="crumb.path === path ? 'page' : undefined"
                        @click="emit('navigate', crumb.path)">
                        <svg aria-hidden="true"><use :href="index === 0 ? '#iconDatabase' : '#iconFolder'" /></svg>
                        <span>{{ crumb.label }}</span>
                    </button>
                </template>
            </div>
            <span class="fn__flex-1" />
            <label v-if="root" class="sforge-file-gallery-scope__recursive">
                <input type="checkbox" :checked="includeSubfolders" aria-label="显示子路径"
                    @change="emit('toggle-recursive', !includeSubfolders)" />
                <span>显示子路径</span>
            </label>
            <button type="button" class="block__icon ariaLabel" aria-label="刷新子目录"
                :disabled="loading" @click="emit('refresh')">
                <svg :class="{'fn__rotate': loading}"><use href="#iconRefresh" /></svg>
            </button>
        </div>

        <div v-if="root && includeSubfolders && childDirectories.length > 0"
            class="sforge-file-gallery-scope__children" aria-label="直接子目录">
            <article v-for="child in childDirectories" :key="child.path"
                class="sforge-file-gallery-scope__child"
                :class="{'sforge-file-gallery-scope__child--selected': selectedSubfolderPaths.includes(child.path)}">
                <button type="button" class="sforge-file-gallery-scope__child-open"
                    :title="child.path" @click="emit('navigate', child.path)">
                    <svg aria-hidden="true"><use href="#iconFolder" /></svg>
                    <span>{{ child.name }}</span>
                </button>
                <label class="sforge-file-gallery-scope__child-check">
                    <input type="checkbox" :checked="selectedSubfolderPaths.includes(child.path)"
                        :aria-label="`包含 ${child.name}`"
                        @change="emit('toggle-subfolder', child.path)" />
                    <span>包含</span>
                </label>
                <span class="sforge-file-gallery-scope__child-count">
                    {{ child.childFileCount ?? 0 }} 文件 / {{ child.childDirectoryCount ?? 0 }} 目录
                </span>
            </article>
        </div>
        <div v-else-if="root && includeSubfolders && loading" class="sforge-file-gallery-scope__state">
            <svg class="fn__rotate"><use href="#iconRefresh" /></svg><span>正在读取子目录</span>
        </div>
        <div v-else-if="root && includeSubfolders && error" class="sforge-file-gallery-scope__state
            sforge-file-gallery-scope__state--error">
            <span>{{ error }}</span>
            <button type="button" class="b3-button b3-button--text" @click="emit('refresh')">重试</button>
        </div>
    </section>
</template>

<script setup lang="ts">
/** 用途：画廊范围导航和子目录包含状态；使用范围：独立资源瀑布流页签。 */
import {computed} from "vue";
import type {FileBrowserEntry, FileBrowserRoot} from "./FileBrowser.types";

interface Breadcrumb {
    label: string;
    path: string;
}

const props = defineProps<{
    root: FileBrowserRoot | undefined;
    path: string;
    entries: FileBrowserEntry[];
    includeSubfolders: boolean;
    selectedSubfolderPaths: readonly string[];
    loading: boolean;
    error: string;
}>();

const emit = defineEmits<{
    navigate: [path: string];
    "toggle-recursive": [enabled: boolean];
    "toggle-subfolder": [path: string];
    refresh: [];
}>();

const breadcrumbs = computed<Breadcrumb[]>(() => {
    const result: Breadcrumb[] = [{label: props.root?.label ?? "全部文件根", path: ""}];
    let current = "";
    for (const segment of props.path.split("/").filter(Boolean)) {
        current = current ? `${current}/${segment}` : segment;
        result.push({label: segment, path: current});
    }
    return result;
});

const childDirectories = computed(() => props.entries.filter(entry => entry.isDir));
</script>

<style scoped lang="scss" src="./FileBrowserGalleryScope.scss"></style>
