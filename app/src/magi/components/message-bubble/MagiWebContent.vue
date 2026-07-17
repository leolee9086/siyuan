<template>
  <div ref="contentRef" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { protectMagiUnverifiedWebLinks, renderMagiWebMarkdown } from "../../utils/webReferences";

const props = withDefaults(defineProps<{
    content: string;
    meta?: Record<string, unknown>;
    protectLinks?: boolean;
}>(), {
    protectLinks: true,
});

const contentRef = ref<HTMLElement | null>(null);
const renderedContent = ref("");

function render(): void {
    renderedContent.value = renderMagiWebMarkdown(props.content, props.meta);
    void nextTick(() => {
        if (props.protectLinks && contentRef.value) {
            protectMagiUnverifiedWebLinks(contentRef.value, props.meta);
        }
    });
}

watch(() => [props.content, props.meta, props.protectLinks], render, {immediate: true, deep: true});
</script>
