<template>
    <div
        class="sse-stream"
        v-if="msg.status !== 'pending' && (trimmedContent || msg.status === 'loading')"
    >
        <span class="stream-content protyle-wysiwyg" v-html="renderedContent"></span>
        <span
            v-if="msg.status === 'loading'"
            class="stream-cursor"
            :style="{ color: `var(--${color}-color)` }"
        >▊</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MagiMessageView } from "../../entry/magiView.types";
import { getMagiI18nText } from "../../utils/magiI18n";
import { renderMarkdown } from "../../utils/lute";

const props = defineProps<{
    /** 消息对象 */
    msg: MagiMessageView;
    /** 贤者颜色标识（red/blue/yellow） */
    color: string;
}>();

/** 去除空白后的内容，用于判断是否有实际内容 */
const trimmedContent = computed(() => props.msg.content.trim());
const processingText = getMagiI18nText("processing");
const renderedContent = computed(() => renderMarkdown(props.msg.content || processingText));
</script>
