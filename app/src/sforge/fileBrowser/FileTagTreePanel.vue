<template>
    <section class="sforge-file-tag-tree" aria-label="文件标签树">
        <header class="block__icons sforge-file-tag-tree__header">
            <div class="block__logo">
                <svg class="block__logoicon"><use href="#iconTags" /></svg>
                <span>标签</span>
            </div>
            <span class="fn__flex-1" />
            <button type="button" class="block__icon ariaLabel" aria-label="刷新标签"
                :disabled="loading" @click="refresh">
                <svg :class="{'fn__rotate': loading}"><use href="#iconRefresh" /></svg>
            </button>
            <button type="button" class="block__icon ariaLabel" aria-label="折叠全部标签"
                :disabled="expanded.size === 0" @click="collapseAll">
                <svg><use href="#iconContract" /></svg>
            </button>
        </header>
        <div v-if="error" class="sforge-file-tag-tree__state sforge-file-tag-tree__state--error">
            <span>{{ error }}</span>
            <button type="button" class="b3-button b3-button--text" @click="refresh">重试</button>
        </div>
        <div v-else-if="loading && !hasTags" class="sforge-file-tag-tree__state">
            <svg class="fn__rotate"><use href="#iconRefresh" /></svg><span>正在读取标签</span>
        </div>
        <div v-else-if="!hasTags" class="sforge-file-tag-tree__state">没有已索引标签</div>
        <ul v-else class="b3-list b3-list--background sforge-file-tag-tree__list" role="tree">
            <FileTagTreeNode v-for="node in nodes" :key="node.tag" :node="node" :expanded-keys="expanded"
                :level="1" @toggle="toggle" @open="emit('open-tag', $event)" />
        </ul>
    </section>
</template>

<script setup lang="ts">
/** 用途：标签树刷新与根节点交互；使用范围：文件浏览 Dock 侧栏。 */
import {onBeforeUnmount, onMounted} from "vue";
import FileTagTreeNode from "./FileTagTreeNode.vue";
import {useFileTagTree} from "./useFileTagTree";
import type {FileTagCountRepository, FileTagDefinitionsRepository} from "./FileTags.types";

const props = defineProps<{
    countRepository?: FileTagCountRepository;
    definitionsRepository?: FileTagDefinitionsRepository;
}>();

const emit = defineEmits<{
    "open-tag": [tag: string];
}>();

const tree = useFileTagTree(props.countRepository, props.definitionsRepository);
const {nodes, loading, error, expanded, hasTags, refresh, toggle, dispose} = tree;

function collapseAll() {
    expanded.value = new Set();
}

onMounted(() => void refresh());
onBeforeUnmount(dispose);
</script>

<style scoped lang="scss" src="./FileTagTree.scss"></style>
