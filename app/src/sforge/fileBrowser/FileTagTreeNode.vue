<template>
    <li class="sforge-file-tag-tree__node" role="none">
        <div class="sforge-file-tag-tree__row" role="treeitem" :aria-level="level"
            :aria-expanded="node.children.length > 0 ? expanded : undefined" @click="emit('open', node.tag)"
            @contextmenu.prevent="emit('open', node.tag)">
            <button type="button" class="block__icon ariaLabel sforge-file-tag-tree__toggle"
                :class="{'fn__hidden': node.children.length === 0}" :aria-label="expanded ? '折叠标签' : '展开标签'"
                @click.stop="emit('toggle', node.tag)">
                <svg class="b3-list-item__arrow" :class="{'b3-list-item__arrow--open': expanded}">
                    <use href="#iconRight" />
                </svg>
            </button>
            <span class="sforge-file-tag-tree__swatch" :style="{backgroundColor: node.color}"
                :title="node.color" />
            <span class="sforge-file-tag-tree__name" :title="node.tag">{{ node.name }}</span>
            <span class="sforge-file-tag-tree__count">{{ node.count }}</span>
        </div>
        <ul v-if="expanded" role="group" class="sforge-file-tag-tree__children">
            <FileTagTreeNode v-for="child in node.children" :key="child.tag" :node="child"
                :expanded-keys="expandedKeys" :level="level + 1" @toggle="emit('toggle', $event)"
                @open="emit('open', $event)" />
        </ul>
    </li>
</template>

<script setup lang="ts">
/** 用途：递归标签节点渲染；使用范围：标签 Dock 的层级和结果导航。 */
import {computed} from "vue";
import type {FileTagTreeNode as TagNode} from "./FileTags.types";

defineOptions({name: "FileTagTreeNode"});

const props = defineProps<{
    node: TagNode;
    expandedKeys: ReadonlySet<string>;
    level: number;
}>();

const emit = defineEmits<{
    toggle: [tag: string];
    open: [tag: string];
}>();

const expanded = computed(() => props.expandedKeys.has(props.node.tag));
</script>

<style scoped lang="scss" src="./FileTagTree.scss"></style>
