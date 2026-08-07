<template>
    <li class="sforge-file-tag-tree__node" role="none">
        <div class="sforge-file-tag-tree__row" :class="{'sforge-file-tag-tree__row--removed': node.removed,
            'sforge-file-tag-tree__row--dragover': dragOver}" role="treeitem" :aria-level="level"
            :aria-expanded="node.children.length > 0 ? expanded : undefined" :draggable="true"
            @click="handleOpen" @contextmenu.prevent="handleOpen" @dragstart.stop="handleDragStart"
            @dragover.prevent.stop="handleDragOver" @dragleave.stop="handleDragLeave" @drop.stop="handleDrop">
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
            <button v-if="node.removed" type="button" class="block__icon ariaLabel sforge-file-tag-tree__delete"
                aria-label="删除未引用标签" @click.stop="emit('delete', node.tag)">
                <svg><use href="#iconTrashcan" /></svg>
            </button>
        </div>
        <ul v-if="expanded" role="group" class="sforge-file-tag-tree__children">
            <FileTagTreeNode v-for="child in node.children" :key="child.tag" :node="child"
                :expanded-keys="expandedKeys" :level="level + 1" @toggle="emit('toggle', $event)"
                @open="emit('open', $event)" @open-notes="emit('open-notes', $event)"
                @drop="emit('drop', $event)" @delete="emit('delete', $event)" />
        </ul>
    </li>
</template>

<script setup lang="ts">
/** 用途：递归标签节点渲染；使用范围：标签 Dock 的层级和结果导航。 */
import {computed, ref} from "vue";
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
    "open-notes": [tag: string];
    drop: [payload: {tag: string; event: DragEvent}];
    delete: [tag: string];
}>();

const expanded = computed(() => props.expandedKeys.has(props.node.tag));
const dragOver = ref(false);

function handleOpen(event: MouseEvent) {
    if (event.ctrlKey || event.metaKey) {
        emit("open-notes", props.node.tag);
        return;
    }
    emit("open", props.node.tag);
}

function handleDragStart(event: DragEvent) {
    if (!event.dataTransfer) {
        return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", `#${props.node.tag}#`);
    event.dataTransfer.setData("text/html", `<span data-type="tag">${escapeHtml(props.node.tag)}</span>`);
}

function handleDragOver() {
    dragOver.value = true;
}

function handleDragLeave() {
    dragOver.value = false;
}

function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragOver.value = false;
    emit("drop", {tag: props.node.tag, event});
}

function escapeHtml(value: string) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
</script>

<style scoped lang="scss" src="./FileTagTree.scss"></style>
